import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { validateCSRF } from '@/lib/auth/csrf';
import { RETENTION_LIMITS, deploymentAllows, getSystemSettings } from '@/lib/systemSettings';
import { INVITE_LIMITS } from '@/lib/inviteLimits';
import { DOWNGRADE_GRACE_DAYS } from '@/lib/billingOptions';
import { WITNESS_LINK_DAYS } from '@/lib/agreementWitness';
import {
  DowngradeRule,
  OverageMode,
  RentActivationRule,
  TeamMemberAccess,
  UnitBillingOwner,
} from '@prisma/client';

// Admin-only platform toggles, backed by the same SystemSettings singleton
// row the /setup wizard uses. GET never writes (findUnique + defaults, via
// getSystemSettings()) so it's a plain read even on a deployment that's
// never run /setup or the seed script; PATCH upserts. Both answer with the settings plus what
// the deployment allows, so the screen can say when a switch is held shut by the environment.
async function settingsResponse() {
  return { ...(await getSystemSettings()), deploymentAllows: deploymentAllows() };
}

export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await settingsResponse() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

// Each setting is optional so a screen can change one without restating the others, but an empty
// body is rejected so a typo cannot silently do nothing. The retention periods have a floor
// (RETENTION_LIMITS): identity documents are deleted for good, so a mistyped period is refused.
const { tenancyDays, rejectionDays } = RETENTION_LIMITS;
const updateSchema = z
  .object({
    autoCompleteMaintenanceOnInvoice: z.boolean().optional(),
    requireTenantRepairConfirmation: z.boolean().optional(),
    requireSecondPersonForTenantPayments: z.boolean().optional(),
    requireSecondPersonForVendorPayments: z.boolean().optional(),
    autopayChargingEnabled: z.boolean().optional(),
    retentionEnabled: z.boolean().optional(),
    retentionAfterTenancyDays: z
      .number()
      .int('Enter a whole number of days')
      .min(
        tenancyDays.min,
        `Keep ID documents at least ${tenancyDays.min} days after a tenancy ends`,
      )
      .max(tenancyDays.max, `At most ${tenancyDays.max} days`)
      .optional(),
    retentionAfterRejectionDays: z
      .number()
      .int('Enter a whole number of days')
      .min(
        rejectionDays.min,
        `Keep ID documents at least ${rejectionDays.min} days after an application is rejected`,
      )
      .max(rejectionDays.max, `At most ${rejectionDays.max} days`)
      .optional(),
    tenantInvitesPerDay: z
      .number()
      .int('Enter a whole number')
      .min(INVITE_LIMITS.perDay.min, `At least ${INVITE_LIMITS.perDay.min}`)
      .max(INVITE_LIMITS.perDay.max, `At most ${INVITE_LIMITS.perDay.max} a day`)
      .optional(),
    inviteTenantsToManagementOnly: z.boolean().optional(),
    enforcePlanLimits: z.boolean().optional(),
    unitBillingOwner: z.nativeEnum(UnitBillingOwner).optional(),
    overageMode: z.nativeEnum(OverageMode).optional(),
    downgradeRule: z.nativeEnum(DowngradeRule).optional(),
    teamMemberAccess: z.nativeEnum(TeamMemberAccess).optional(),
    agreementTemplatesNeedApproval: z.boolean().optional(),
    agreementLandlordNameByManager: z.boolean().optional(),
    agreementAgencyFee: z.boolean().optional(),
    agreementLegalFee: z.boolean().optional(),
    agreementCautionFee: z.boolean().optional(),
    rentActivationRule: z.nativeEnum(RentActivationRule).optional(),
    chargeForAgreements: z.boolean().optional(),
    chargeForUploads: z.boolean().optional(),
    creditPurchaseEnabled: z.boolean().optional(),
    witnessEsignEnabled: z.boolean().optional(),
    witnessesMustSign: z.boolean().optional(),
    witnessLinkDays: z
      .number()
      .int('Enter a whole number of days')
      .min(WITNESS_LINK_DAYS.min, `At least ${WITNESS_LINK_DAYS.min} day`)
      .max(WITNESS_LINK_DAYS.max, `At most ${WITNESS_LINK_DAYS.max} days`)
      .optional(),
    downgradeGraceDays: z
      .number()
      .int('Enter a whole number of days')
      .min(DOWNGRADE_GRACE_DAYS.min, `At least ${DOWNGRADE_GRACE_DAYS.min} day`)
      .max(DOWNGRADE_GRACE_DAYS.max, `At most ${DOWNGRADE_GRACE_DAYS.max} days`)
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Send at least one setting to change',
  });

export const PATCH = withAuth(
  async (req, { session }) => {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    try {
      const validated = await validateBody(req, updateSchema);
      if (!validated.success) return validated.response;

      const before = await getSystemSettings();
      await prisma.systemSettings.upsert({
        where: { id: 'global' },
        update: validated.data,
        create: { id: 'global', ...validated.data },
      });

      // A setting that moves money or deletes records is worth a trail: who changed what.
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, to] of Object.entries(validated.data)) {
        const from = before[key as keyof typeof before];
        if (to !== undefined && from !== to) changes[key] = { from, to };
      }
      if (Object.keys(changes).length > 0) {
        await prisma.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'SETTINGS_CHANGED',
            entityType: 'SystemSettings',
            entityId: 'global',
            metadata: { changes } as object,
          },
        });
      }

      return NextResponse.json({ data: await settingsResponse() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
