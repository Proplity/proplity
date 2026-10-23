import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENT_DUE_SOON_DAYS = 3;
const RENT_ENDING_DAYS = 60;

// One reminder per invoice and one per rent, however many times the daily job runs: the title
// carries the invoice number or the end date, and a reminder is skipped when the recipient
// already has a notification with that title.
async function alreadyTold(recipientId: string, title: string) {
  const existing = await prisma.notification.findFirst({
    where: { recipientId, title },
    select: { id: true },
  });
  return !!existing;
}

export async function runReminders(): Promise<{ dueSoon: number; rentsEnding: number }> {
  const now = new Date();
  let dueSoon = 0;
  let rentsEnding = 0;

  // Unpaid rent and charges falling due in the next few days.
  const soon = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      rentId: { not: null },
      dueDate: { gt: now, lte: new Date(now.getTime() + RENT_DUE_SOON_DAYS * MS_PER_DAY) },
    },
    include: { rent: { select: { tenantId: true } } },
  });
  for (const invoice of soon) {
    if (!invoice.rent) continue;
    const title = `Payment due soon: ${invoice.invoiceNumber}`;
    if (await alreadyTold(invoice.rent.tenantId, title)) continue;
    await notifyAndEmail(invoice.rent.tenantId, {
      title,
      body: `Invoice ${invoice.invoiceNumber} for ₦${invoice.amount.toLocaleString()} is due on ${invoice.dueDate.toDateString()}.`,
      link: '/dashboard',
    });
    dueSoon += 1;
  }

  // Active rents ending within two months: the tenant and the property team both need to act.
  const ending = await prisma.rent.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gt: now, lte: new Date(now.getTime() + RENT_ENDING_DAYS * MS_PER_DAY) },
    },
    include: { unit: { include: { property: true } } },
  });
  for (const rent of ending) {
    const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
    const title = `Rent ending ${rent.endDate.toDateString()}: unit ${rent.unit.unitNumber}`;
    if (await alreadyTold(rent.tenantId, title)) continue;
    await notifyAndEmail(rent.tenantId, {
      title,
      body: `Your rent for ${where} ends on ${rent.endDate.toDateString()}. Talk to the property team about renewing.`,
      link: '/dashboard',
    });
    await notifyPropertyTeam(
      rent.unit.property,
      {
        title,
        body: `The rent for ${where} ends on ${rent.endDate.toDateString()}. Decide whether to renew it.`,
        link: `/dashboard/tenants/${rent.id}`,
      },
      { email: false },
    );
    rentsEnding += 1;
  }

  return { dueSoon, rentsEnding };
}
