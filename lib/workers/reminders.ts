import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENT_DUE_SOON_DAYS = 3;
const LEASE_ENDING_DAYS = 60;

// One reminder per invoice and one per lease, however many times the daily job runs: the title
// carries the invoice number or the end date, and a reminder is skipped when the recipient
// already has a notification with that title.
async function alreadyTold(recipientId: string, title: string) {
  const existing = await prisma.notification.findFirst({
    where: { recipientId, title },
    select: { id: true },
  });
  return !!existing;
}

export async function runReminders(): Promise<{ dueSoon: number; leasesEnding: number }> {
  const now = new Date();
  let dueSoon = 0;
  let leasesEnding = 0;

  // Unpaid rent and charges falling due in the next few days.
  const soon = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      leaseId: { not: null },
      dueDate: { gt: now, lte: new Date(now.getTime() + RENT_DUE_SOON_DAYS * MS_PER_DAY) },
    },
    include: { lease: { select: { tenantId: true } } },
  });
  for (const invoice of soon) {
    if (!invoice.lease) continue;
    const title = `Payment due soon: ${invoice.invoiceNumber}`;
    if (await alreadyTold(invoice.lease.tenantId, title)) continue;
    await notifyAndEmail(invoice.lease.tenantId, {
      title,
      body: `Invoice ${invoice.invoiceNumber} for ₦${invoice.amount.toLocaleString()} is due on ${invoice.dueDate.toDateString()}.`,
      link: '/dashboard',
    });
    dueSoon += 1;
  }

  // Active leases ending within two months: the tenant and the property team both need to act.
  const ending = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gt: now, lte: new Date(now.getTime() + LEASE_ENDING_DAYS * MS_PER_DAY) },
    },
    include: { unit: { include: { property: true } } },
  });
  for (const lease of ending) {
    const where = `unit ${lease.unit.unitNumber} at ${lease.unit.property.name}`;
    const title = `Lease ending ${lease.endDate.toDateString()}: unit ${lease.unit.unitNumber}`;
    if (await alreadyTold(lease.tenantId, title)) continue;
    await notifyAndEmail(lease.tenantId, {
      title,
      body: `Your lease for ${where} ends on ${lease.endDate.toDateString()}. Talk to the property team about renewing.`,
      link: '/dashboard',
    });
    await notifyPropertyTeam(
      lease.unit.property,
      {
        title,
        body: `The lease for ${where} ends on ${lease.endDate.toDateString()}. Decide whether to renew it.`,
        link: `/dashboard/tenants/${lease.id}`,
      },
      { email: false },
    );
    leasesEnding += 1;
  }

  return { dueSoon, leasesEnding };
}
