import { NextResponse } from 'next/server';
import { PUBLIC_PAYMENT_SELECT } from '@/lib/api/paymentSelect';
import { z } from 'zod';
import { RentStatus, PaymentFrequency, LateFeeType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { notifyAndEmail } from '@/lib/notifications';
import { revokeCodesWhenTenancyEnds } from '@/lib/accessCodes';
import { closeThreadsWhenTenancyEnds } from '@/lib/conversationAccess';
import { UnitAlreadyOccupiedError, occupyUnitForRent } from '@/lib/rentLifecycle';
import { canManageProperty, PUBLIC_PROPERTY } from '@/lib/api/propertyAccess';
import { safeUrl } from '@/lib/api/urlField';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { getSystemSettings } from '@/lib/systemSettings';

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

function loadRent(id: string) {
  return prisma.rent.findUnique({
    where: { id },
    include: {
      unit: { include: { property: PUBLIC_PROPERTY } },
      tenant: { select: tenantSelect },
      notices: { orderBy: { createdAt: 'desc' } },
      invoices: {
        include: { payments: { select: PUBLIC_PAYMENT_SELECT, orderBy: { paidAt: 'desc' } } },
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
    const rent = await loadRent(id);
    if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
    if (!isOwnerTenant && !canManageProperty(session, rent.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Drafts are the property team's work in progress (ISS-145).
    if (isOwnerTenant) {
      rent.notices = rent.notices.filter((n) => n.status !== 'DRAFT');
    }

    const settings = await getSystemSettings();
    return NextResponse.json({
      data: {
        ...rent,
        renewal: {
          enabled: settings.agreementRenewalEnabled,
          autoEnabled: settings.autoRenewalEnabled,
          autoDaysBefore: settings.autoRenewalDaysBefore,
        },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});

const patchSchema = z.object({
  status: z.nativeEnum(RentStatus).optional(),
  renew: z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      rentAmount: z.number().positive(),
      paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
      deposit: z.number().nonnegative(),
    })
    .optional(),
  // Landlord/manager autonomy over an existing rent's late-fee terms,
  // deliberately unbounded -- no platform-imposed min/max.
  gracePeriodDays: z.number().int().nonnegative().optional(),
  lateFeeType: z.nativeEnum(LateFeeType).optional(),
  lateFeePercentage: z.number().nonnegative().optional(),
  lateFeeFlatAmount: z.number().nonnegative().optional(),
  signedAgreementUrl: safeUrl.nullable().optional(),
  // Renew automatically when the admin has switched automatic renewal on (see lib/workers/renewals).
  autoRenew: z.boolean().optional(),
  autoRenewIncreasePercent: z.number().min(0).max(100).optional(),
  autoRenewTermMonths: z.number().int().min(1).max(120).optional(),
});

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const {
        status,
        renew,
        gracePeriodDays,
        lateFeeType,
        lateFeePercentage,
        lateFeeFlatAmount,
        signedAgreementUrl,
        autoRenew,
        autoRenewIncreasePercent,
        autoRenewTermMonths,
      } = validated.data;

      if (signedAgreementUrl) {
        await assertOwnsFileUrls([signedAgreementUrl], session.sub, 'rents');
      }

      // Renewal (rule 6): a NEW Rent row linked via renewedFromId, old
      // rent set to EXPIRED -- never a PENDING_RENEWAL status, it doesn't
      // exist. This route call represents the acceptance moment, so the
      // new rent starts ACTIVE. Same unit stays occupied throughout, but
      // set it explicitly anyway rather than assuming it was already right.
      if (renew) {
        const newRent = await prisma.$transaction(async (tx) => {
          // Two requests for the same unit must take turns: without the lock both could pass the
          // check below and the unit would end up with two active rents (ISS-139).
          await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${rent.unitId} FOR UPDATE`;
          // Same guard, minus the rent being renewed FROM -- that one is set
          // to EXPIRED a few lines down, so it is not a real conflict. Any
          // OTHER active rent on the unit is.
          const conflicting = await tx.rent.findFirst({
            where: { unitId: rent.unitId, status: 'ACTIVE', id: { not: rent.id } },
            select: { id: true },
          });
          if (conflicting) {
            throw new UnitAlreadyOccupiedError(conflicting.id);
          }

          const created = await tx.rent.create({
            data: {
              unitId: rent.unitId,
              tenantId: rent.tenantId,
              startDate: renew.startDate,
              endDate: renew.endDate,
              rentAmount: renew.rentAmount,
              paymentFrequency: renew.paymentFrequency ?? rent.paymentFrequency,
              deposit: renew.deposit,
              status: 'ACTIVE',
              renewedFromId: rent.id,
            },
          });
          await tx.rent.update({ where: { id: rent.id }, data: { status: 'EXPIRED' } });
          await tx.unit.update({ where: { id: rent.unitId }, data: { status: 'OCCUPIED' } });
          return created;
        });

        await notifyAndEmail(
          rent.tenantId,
          {
            title: 'Your rent was renewed',
            body: `Your rent for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} was renewed: ${renew.startDate.toDateString()} to ${renew.endDate.toDateString()}, rent ₦${renew.rentAmount.toLocaleString()}.`,
            link: '/dashboard',
          },
          { req },
        );
        return NextResponse.json({ data: newRent }, { status: 201 });
      }

      const termsUpdate = {
        ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
        ...(lateFeeType !== undefined ? { lateFeeType } : {}),
        ...(lateFeePercentage !== undefined ? { lateFeePercentage } : {}),
        ...(lateFeeFlatAmount !== undefined ? { lateFeeFlatAmount } : {}),
        ...(signedAgreementUrl !== undefined ? { signedAgreementUrl } : {}),
      };
      // Only the automatic-renewal choice changing is the team's own bookkeeping: nothing the
      // tenant agreed to moves, so the tenant is not told.
      const renewalChoice = {
        ...(autoRenew !== undefined ? { autoRenew } : {}),
        ...(autoRenewIncreasePercent !== undefined ? { autoRenewIncreasePercent } : {}),
        ...(autoRenewTermMonths !== undefined ? { autoRenewTermMonths } : {}),
      };
      const hasRenewalChoice = Object.keys(renewalChoice).length > 0;
      if (autoRenew) {
        const settings = await getSystemSettings();
        if (!settings.autoRenewalEnabled) {
          return NextResponse.json(
            { error: 'Automatic renewal is switched off', code: 'AUTO_RENEWAL_OFF' },
            { status: 403 },
          );
        }
      }

      // With the admin's "after both sign" rule a pending rent cannot be started by hand before
      // both sides have signed; signing starts it. An admin may still override.
      if (status === 'ACTIVE' && rent.status === 'PENDING' && session.role !== 'ADMIN') {
        const settings = await getSystemSettings();
        if (settings.rentActivationRule === 'AFTER_BOTH_SIGN' && !rent.agreementSignedAt) {
          return NextResponse.json(
            {
              error: 'This rent starts once the tenant and the landlord side have both signed',
              code: 'AGREEMENT_NOT_SIGNED',
            },
            { status: 409 },
          );
        }
      }

      if (!status && Object.keys(termsUpdate).length === 0 && hasRenewalChoice) {
        const updated = await prisma.rent.update({ where: { id }, data: renewalChoice });
        return NextResponse.json({ data: updated });
      }

      if (status || Object.keys(termsUpdate).length > 0) {
        const updated = await prisma.$transaction(async (tx) => {
          // Serialise changes to one unit's rents: the occupancy check below reads the other
          // rents, so two activations at once must not both pass it (ISS-139).
          await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${rent.unitId} FOR UPDATE`;
          const result = await tx.rent.update({
            where: { id },
            data: { ...(status ? { status } : {}), ...termsUpdate, ...renewalChoice },
          });

          // Unit.status was previously never touched by a rent's own
          // lifecycle (documented gap in CLAUDE.md) -- ACTIVE occupies the
          // unit; TERMINATED/EXPIRED frees it back up, but only once no
          // other ACTIVE rent remains on the same unit (defensive, since
          // nothing in the schema prevents more than one rent per unit).
          if (status === 'ACTIVE') {
            await occupyUnitForRent(tx, rent);
          } else if (status === 'TERMINATED' || status === 'EXPIRED') {
            const stillActive = await tx.rent.findFirst({
              where: { unitId: rent.unitId, status: 'ACTIVE', id: { not: rent.id } },
            });
            if (!stillActive) {
              await tx.unit.update({ where: { id: rent.unitId }, data: { status: 'VACANT' } });
            }
            // The tenant's gate codes end with the tenancy (ISS-138).
            await revokeCodesWhenTenancyEnds(tx, {
              id: rent.id,
              unitId: rent.unitId,
              tenantId: rent.tenantId,
            });
            // ...and so does their say in the rent and community threads (ISS-142).
            await closeThreadsWhenTenancyEnds(tx, {
              id: rent.id,
              unitId: rent.unitId,
              tenantId: rent.tenantId,
              propertyId: rent.unit.propertyId,
            });
          }

          return result;
        });
        const unitLabel = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
        const statusNote: Record<string, string> = {
          ACTIVE: `Your rent for ${unitLabel} is now active.`,
          TERMINATED: `Your rent for ${unitLabel} was terminated.`,
          EXPIRED: `Your rent for ${unitLabel} has ended.`,
        };
        await notifyAndEmail(
          rent.tenantId,
          {
            title:
              status && statusNote[status] ? `Rent ${status.toLowerCase()}` : 'Rent terms updated',
            body:
              status && statusNote[status]
                ? statusNote[status]
                : `The terms of your rent for ${unitLabel} were updated. Open it to see what changed.`,
            link: '/dashboard',
          },
          { req },
        );
        return NextResponse.json({ data: updated });
      }

      return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
    } catch (err) {
      if (err instanceof UnitAlreadyOccupiedError) {
        return NextResponse.json(
          {
            error: 'This unit already has an active rent',
            code: 'UNIT_OCCUPIED',
            conflictingRentId: err.conflictingRentId,
          },
          { status: 409 },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
