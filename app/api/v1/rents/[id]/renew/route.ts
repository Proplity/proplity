import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAndEmail } from '@/lib/notifications';
import { getSystemSettings } from '@/lib/systemSettings';
import { termMonths } from '@/lib/agreementFields';
import { defaultRenewalTerms, renewRent, renewalEndDate } from '@/lib/rentRenewal';

type RouteCtx = { params: Promise<{ id: string }> };

// What a renewal changes. Everything is optional: with nothing the renewal is the next term of the
// same length, the day after this one ends, at the same rent. `increasePercent` raises the rent.
const renewSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    termMonths: z.number().int().min(1).max(600).optional(),
    rentAmount: z.number().positive().optional(),
    increasePercent: z.number().min(0).max(1000).optional(),
    deposit: z.number().nonnegative().optional(),
    paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
    copyAgreement: z.boolean().optional(),
  })
  .strict();

/**
 * Renews a running rent by making the next one: a pending rent linked to this one, its first
 * invoice, and (unless switched off) a draft agreement copied from this rent's, for the property
 * team to review and send. The tenant signs the new agreement as before; the new rent takes the
 * unit over on its start date, once signed. The old one-step renewal (PATCH with `renew`) stays.
 */
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, renewSchema);
      if (!validated.success) return validated.response;
      const body = validated.data;

      const settings = await getSystemSettings();
      if (!settings.agreementRenewalEnabled) {
        return NextResponse.json(
          { error: 'Renewing with a new agreement is switched off', code: 'RENEWAL_OFF' },
          { status: 403 },
        );
      }
      const rent = await prisma.rent.findUnique({
        where: { id },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // A length and an increase fill in what the dates and the amount leave out.
      const defaults = defaultRenewalTerms(rent, {
        increasePercent: body.increasePercent ?? rent.autoRenewIncreasePercent,
        termMonths: body.termMonths ?? rent.autoRenewTermMonths,
      });
      const result = await renewRent({
        rentId: id,
        actor: session,
        settings,
        copyAgreement: body.copyAgreement ?? true,
        terms: {
          startDate: body.startDate ?? defaults.startDate,
          endDate:
            body.endDate ??
            (body.startDate
              ? renewalEndDate(
                  body.startDate,
                  body.termMonths ??
                    rent.autoRenewTermMonths ??
                    termMonths(rent.startDate, rent.endDate),
                )
              : defaults.endDate),
          rentAmount: body.rentAmount ?? defaults.rentAmount,
          deposit: body.deposit,
          paymentFrequency: body.paymentFrequency,
        },
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code, findings: result.findings },
          { status: result.status },
        );
      }

      await notifyAndEmail(
        rent.tenantId,
        {
          title: 'Your rent is being renewed',
          body: `Your rent for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} is being renewed. You will be asked to sign the new agreement.`,
          link: '/dashboard',
        },
        { req },
      );
      return NextResponse.json(
        { data: { rent: result.rent, agreement: result.agreement, warnings: result.findings } },
        { status: 201 },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
