import { prisma } from '@/lib/db';
import { RETENTION_LIMITS } from '@/lib/retentionLimits';
import { INVITE_LIMITS } from '@/lib/inviteLimits';
import { DOWNGRADE_GRACE_DAYS } from '@/lib/billingOptions';

export { RETENTION_LIMITS };

// Reads the SystemSettings singleton, returning the schema's own defaults
// when the row doesn't exist yet (a deployment that's never run /setup or
// the seed script). Read-only -- writes go through PATCH
// /api/v1/admin/settings, which upserts the row.
export async function getSystemSettings() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  return {
    setupComplete: settings?.setupComplete ?? false,
    autoCompleteMaintenanceOnInvoice: settings?.autoCompleteMaintenanceOnInvoice ?? true,
    requireTenantRepairConfirmation: settings?.requireTenantRepairConfirmation ?? true,
    requireSecondPersonForTenantPayments: settings?.requireSecondPersonForTenantPayments ?? true,
    requireSecondPersonForVendorPayments: settings?.requireSecondPersonForVendorPayments ?? true,
    autopayChargingEnabled: settings?.autopayChargingEnabled ?? false,
    retentionEnabled: settings?.retentionEnabled ?? false,
    retentionAfterTenancyDays:
      settings?.retentionAfterTenancyDays ?? RETENTION_LIMITS.tenancyDays.default,
    retentionAfterRejectionDays:
      settings?.retentionAfterRejectionDays ?? RETENTION_LIMITS.rejectionDays.default,
    tenantInvitesPerDay: settings?.tenantInvitesPerDay ?? INVITE_LIMITS.perDay.default,
    enforcePlanLimits: settings?.enforcePlanLimits ?? false,
    unitBillingOwner: settings?.unitBillingOwner ?? 'MANAGER_ELSE_LANDLORD',
    overageMode: settings?.overageMode ?? 'ALLOW_AND_BILL',
    downgradeRule: settings?.downgradeRule ?? 'BLOCK',
    downgradeGraceDays: settings?.downgradeGraceDays ?? DOWNGRADE_GRACE_DAYS.default,
  };
}

// Automatic charging and identity-document deletion each need BOTH gates open (ADR-0015): the
// deployment allows it (the environment flag, a lock only whoever runs the deployment can open)
// and an admin has switched it on in Platform Settings. Either one closed means the job only
// reports what it would do.
export function deploymentAllows() {
  return {
    autopay: process.env.AUTOPAY_WORKER_ENABLED === 'true',
    retention: process.env.RETENTION_ENABLED === 'true',
  };
}

export function autopayChargingOn(settings: { autopayChargingEnabled: boolean }): boolean {
  return deploymentAllows().autopay && settings.autopayChargingEnabled;
}

export function retentionOn(settings: { retentionEnabled: boolean }): boolean {
  return deploymentAllows().retention && settings.retentionEnabled;
}
