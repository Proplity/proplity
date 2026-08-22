import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LeaseStatus, PaymentFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

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
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const lease = await prisma.lease.findUnique({ where: { id }, include: { unit: { include: { property: true } } } });
      if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
      if (!canManageProperty(session, lease.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const { status, renew } = validated.data;

      // Renewal (rule 6): a NEW Lease row linked via renewedFromId, old
      // lease set to EXPIRED -- never a PENDING_RENEWAL status, it doesn't
      // exist. This route call represents the acceptance moment, so the
      // new lease starts ACTIVE.
      if (renew) {
        const newLease = await prisma.$transaction(async (tx) => {
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
          return created;
        });

        return NextResponse.json({ data: newLease }, { status: 201 });
      }

      if (status) {
        const updated = await prisma.lease.update({ where: { id }, data: { status } });
        return NextResponse.json({ data: updated });
      }

      return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
