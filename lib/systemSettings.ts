import { prisma } from '@/lib/db';

// Reads the SystemSettings singleton, returning the schema's own defaults
// when the row doesn't exist yet (a deployment that's never run /setup or
// the seed script). Read-only -- writes go through PATCH
// /api/v1/admin/settings, which upserts the row.
export async function getSystemSettings() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  return {
    setupComplete: settings?.setupComplete ?? false,
    autoCompleteMaintenanceOnInvoice: settings?.autoCompleteMaintenanceOnInvoice ?? true,
  };
}
