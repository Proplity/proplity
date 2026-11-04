import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';
import { getSystemSettings } from '@/lib/systemSettings';
import { claimReminder } from '@/lib/workers/renewals';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENT_DUE_SOON_DAYS = 3;

// One reminder per invoice (its number is in the title, and a reminder is skipped when the tenant
// already has a notification with that title) and one per step of a rent's ending ladder (the
// RentReminderLog row is the claim).
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

  // Active rents nearing their end: the tenant and the property team both need to act. The admin's
  // ladder of days before the end (default 90, 60 and 30) says when: a rent is told once for the
  // nearest step it has reached, however often this job runs. Off with the admin's reminders switch.
  const settings = await getSystemSettings();
  const steps = [...settings.renewalReminderDays].sort((x, y) => x - y);
  if (settings.agreementRemindersEnabled && steps.length > 0) {
    const widest = steps[steps.length - 1];
    const ending = await prisma.rent.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gt: now, lte: new Date(now.getTime() + widest * MS_PER_DAY) },
      },
      include: { unit: { include: { property: true } } },
    });
    for (const rent of ending) {
      const daysLeft = Math.ceil((rent.endDate.getTime() - now.getTime()) / MS_PER_DAY);
      const step = steps.find((s) => daysLeft <= s);
      if (step === undefined) continue;
      if (!(await claimReminder(rent.id, 'ENDING', String(step)))) continue;
      const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
      const title = `Rent ending ${rent.endDate.toDateString()}: unit ${rent.unit.unitNumber}`;
      await notifyAndEmail(rent.tenantId, {
        title,
        body: `Your rent for ${where} ends on ${rent.endDate.toDateString()}. Talk to the property team about renewing.`,
        link: '/dashboard',
      });
      await notifyPropertyTeam(
        rent.unit.property,
        {
          title,
          body: `The rent for ${where} ends on ${rent.endDate.toDateString()}. Decide whether to renew it: Renew on the rent's page prepares the new rent and agreement.`,
          link: `/dashboard/tenants/${rent.id}`,
        },
        { email: false },
      );
      rentsEnding += 1;
    }
  }

  return { dueSoon, rentsEnding };
}
