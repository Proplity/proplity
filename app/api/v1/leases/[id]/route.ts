import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LeaseStatus, PaymentFrequency, LateFeeType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Thrown from inside a $transaction so the whole activation rolls back --
 * returning a plain NextResponse from within the callback would commit the
 * lease.update that already ran. Caught below and mapped to a 409.
 */
class UnitAlreadyOccupiedError extends Error {
  constructor(public readonly conflictingLeaseId: string) {
    super('Unit already has an active lease');
  }
}

// There is no nested "emergency contact" object in the schema -- these are
// 3 flat fields on User already, selected explicitly here to keep
// passwordHash out of the response.
const tenantSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  avatarUrl: true,
  emergencyContactName: true,
  emergencyContactRelationship: true,
  emergencyContactPhone: true,
} as const;

function loadLease(id: string) {
  return prisma.lease.findUnique({
    where: { id },
    include: {
      unit: { include: { property: true } },
      tenant: { select: tenantSelect },
      notices: { orderBy: { createdAt: 'desc' } },
      invoices: {
        include: { payments: { orderBy: { paidAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
      renewedFrom: true,
      renewedInto: true,
      signatures: {
        include: { signer: { select: { id: true, name: true, role: true } } },
        orderBy: { signedAt: 'asc' },
      },
    },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const lease = await loadLease(id);
    if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && lease.tenantId === session.sub;
    if (!isOwnerTenant && !canManageProperty(session, lease.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: lease });
  } catch (err) {
    return handleApiError(err);
  }
});

const patchSchema = z.object({
  status: z.nativeEnum(LeaseStatus).optional(),
  renew: z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      rentAmount: z.number().positive(),
      paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
      deposit: z.number().nonnegative(),
    })
    .optional(),
  // Landlord/manager autonomy over an existing lease's late-fee terms,
  // deliberately unbounded -- no platform-imposed min/max.
  gracePeriodDays: z.number().int().nonnegative().optional(),
  lateFeeType: z.nativeEnum(LateFeeType).optional(),
  lateFeePercentage: z.number().nonnegative().optional(),
  lateFeeFlatAmount: z.number().nonnegative().optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const lease = await prisma.lease.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
      if (!canManageProperty(session, lease.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const { status, renew, gracePeriodDays, lateFeeType, lateFeePercentage, lateFeeFlatAmount } =
        validated.data;

      // Renewal (rule 6): a NEW Lease row linked via renewedFromId, old
      // lease set to EXPIRED -- never a PENDING_RENEWAL status, it doesn't
      // exist. This route call represents the acceptance moment, so the
      // new lease starts ACTIVE. Same unit stays occupied throughout, but
      // set it explicitly anyway rather than assuming it was already right.
      if (renew) {
        const newLease = await prisma.$transaction(async (tx) => {
          // Same guard, minus the lease being renewed FROM -- that one is set
          // to EXPIRED a few lines down, so it is not a real conflict. Any
          // OTHER active lease on the unit is.
          const conflicting = await tx.lease.findFirst({
            where: { unitId: lease.unitId, status: 'ACTIVE', id: { not: lease.id } },
            select: { id: true },
          });
          if (conflicting) {
            throw new UnitAlreadyOccupiedError(conflicting.id);
          }

          const created = await tx.lease.create({
            data: {
              unitId: lease.unitId,
              tenantId: lease.tenantId,
              startDate: renew.startDate,
              endDate: renew.endDate,
              rentAmount: renew.rentAmount,
              paymentFrequency: renew.paymentFrequency ?? lease.paymentFrequency,
              deposit: renew.deposit,
              status: 'ACTIVE',
              renewedFromId: lease.id,
            },
          });
          await tx.lease.update({ where: { id: lease.id }, data: { status: 'EXPIRED' } });
          await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'OCCUPIED' } });
          return created;
        });

        return NextResponse.json({ data: newLease }, { status: 201 });
      }

      const termsUpdate = {
        ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
        ...(lateFeeType !== undefined ? { lateFeeType } : {}),
        ...(lateFeePercentage !== undefined ? { lateFeePercentage } : {}),
        ...(lateFeeFlatAmount !== undefined ? { lateFeeFlatAmount } : {}),
      };

      if (status || Object.keys(termsUpdate).length > 0) {
        const updated = await prisma.$transaction(async (tx) => {
          const result = await tx.lease.update({
            where: { id },
            data: { ...(status ? { status } : {}), ...termsUpdate },
          });

          // Unit.status was previously never touched by a lease's own
          // lifecycle (documented gap in CLAUDE.md) -- ACTIVE occupies the
          // unit; TERMINATED/EXPIRED frees it back up, but only once no
          // other ACTIVE lease remains on the same unit (defensive, since
          // nothing in the schema prevents more than one lease per unit).
          if (status === 'ACTIVE') {
            // Occupancy guard, the mirror of the release check below. The
            // freeing path was already defensive about a second ACTIVE lease;
            // the occupying path was not, so a unit could be handed to a
            // second tenant while the first was still in it. Creating a lease
            // is deliberately still allowed on an occupied unit -- next
            // year's lease is normally signed before this year's ends -- so
            // ACTIVATION, not creation, is the right place to draw the line.
            const conflicting = await tx.lease.findFirst({
              where: { unitId: lease.unitId, status: 'ACTIVE', id: { not: id } },
              select: { id: true, tenantId: true },
            });
            if (conflicting) {
              throw new UnitAlreadyOccupiedError(conflicting.id);
            }
            await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'OCCUPIED' } });
          } else if (status === 'TERMINATED' || status === 'EXPIRED') {
            const stillActive = await tx.lease.findFirst({
              where: { unitId: lease.unitId, status: 'ACTIVE', id: { not: lease.id } },
            });
            if (!stillActive) {
              await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'VACANT' } });
            }
          }

          return result;
        });
        return NextResponse.json({ data: updated });
      }

      return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
    } catch (err) {
      if (err instanceof UnitAlreadyOccupiedError) {
        return NextResponse.json(
          {
            error: 'This unit already has an active lease',
            code: 'UNIT_OCCUPIED',
            conflictingLeaseId: err.conflictingLeaseId,
          },
          { status: 409 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
