import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';
import { viewingDateKey, viewingDayBounds } from '@/lib/viewingSlots';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Telling people must never stop the sweep, so a failure here is logged and the worker carries on.
async function tellOverdue(invoice: {
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  rent: {
    tenantId: string;
    unit: {
      unitNumber: string;
      property: { name: string; managerId: string | null; landlordId: string | null };
    };
  } | null;
}) {
  const rent = invoice.rent;
  if (!rent?.unit?.property) return;
  try {
    await notifyAndEmail(rent.tenantId, {
      title: `Invoice ${invoice.invoiceNumber} is overdue`,
      body: `Your payment of ₦${invoice.amount.toLocaleString()} was due on ${invoice.dueDate.toDateString()} and is now overdue. Please pay as soon as you can to avoid late fees.`,
      link: '/dashboard',
    });
    await notifyPropertyTeam(
      rent.unit.property,
      {
        title: `Rent overdue: ${invoice.invoiceNumber}`,
        body: `Invoice ${invoice.invoiceNumber} (₦${invoice.amount.toLocaleString()}) for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} is overdue.`,
        link: '/dashboard/breakdown/rent',
      },
      { email: false },
    );
  } catch (err) {
    console.error('Failed to announce an overdue invoice', err);
  }
}

// Sends exactly one PAYMENT_REMINDER per invoice, not the full "reminder ->
// call -> notice" escalation ladder PRD §6.1 describes -- that's explicitly
// scoped to "Phase 2: Advanced AI rent intelligence" (PRD line 353), beyond
// this basic worker.
export async function runOverdueFlagger(): Promise<{
  flagged: number;
  remindersSent: number;
  lateFeesCreated: number;
}> {
  const now = new Date();
  // Re-examines already-OVERDUE invoices too, not just UNPAID ones -- this
  // is also the pass that assesses late fees, and an invoice flagged
  // OVERDUE on a prior run (before this fee logic existed, or simply
  // because the fee hasn't been created yet) still needs one.
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ['UNPAID', 'OVERDUE'] }, dueDate: { lt: now } },
    include: { rent: { include: { unit: { include: { property: true } } } } },
  });

  let flagged = 0;
  let remindersSent = 0;
  let lateFeesCreated = 0;

  for (const invoice of candidates) {
    // Rent.gracePeriodDays (default 7) was accepted at rent creation and
    // never read anywhere else until now -- an invoice with no rent (a
    // MAINTENANCE or direct userId invoice) has no grace concept, so it's
    // overdue right at its due date, same as before this fix.
    const gracePeriodDays = invoice.rent?.gracePeriodDays ?? 0;
    const graceDeadline = new Date(invoice.dueDate.getTime() + gracePeriodDays * MS_PER_DAY);
    // "Due on the 1st" means pay by the end of the 1st in Lagos, so the invoice is only overdue
    // once that Lagos day is over (ISS-141). Without this a no-grace rent was flagged, and the
    // late fee charged, at 03:00 Lagos time on the due date itself.
    const overdueFrom = viewingDayBounds(viewingDateKey(graceDeadline)).end;
    if (overdueFrom > now) continue; // still within grace period -- not overdue yet

    if (invoice.status === 'UNPAID') {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'OVERDUE' } });
      flagged += 1;

      if (invoice.rentId) {
        const existingReminder = await prisma.notice.findFirst({
          where: { invoiceId: invoice.id, type: 'PAYMENT_REMINDER' },
        });
        if (!existingReminder) {
          await prisma.notice.create({
            data: {
              rentId: invoice.rentId,
              invoiceId: invoice.id,
              type: 'PAYMENT_REMINDER',
              status: 'SENT',
              sentAt: now,
              content: `Your payment of ${invoice.amount} for invoice ${invoice.invoiceNumber} was due on ${invoice.dueDate.toDateString()} and is now overdue. Please make payment as soon as possible.`,
            },
          });
          remindersSent += 1;
          await tellOverdue(invoice);
        }
      }
    }

    // Late fee: one-time per overdue invoice, RENT only (a late fee on a
    // SECURITY_DEPOSIT or MAINTENANCE invoice doesn't map to what a rent's
    // late-fee terms mean), and never on a LATE_FEE invoice itself --
    // without that exclusion, a late fee's own dueDate (set to "now" at
    // creation, so immediately overdue) would make it a candidate next run
    // and compound indefinitely. Landlord/manager picks exactly one mode
    // per rent (lateFeeType) -- percentage-of-rent or a flat amount --
    // never both stacked together.
    if (invoice.type === 'RENT' && invoice.rent) {
      const rent = invoice.rent;
      const lateFeeAmount =
        rent.lateFeeType === 'FIXED'
          ? rent.lateFeeFlatAmount
          : Math.round(invoice.amount * (rent.lateFeePercentage / 100) * 100) / 100;

      if (lateFeeAmount > 0) {
        // No FK from a LATE_FEE invoice back to the RENT invoice it's for --
        // encoded into the description instead (same convention as
        // subscriptions/checkout's tier/cycle encoding) so this stays
        // idempotent across runs without a schema change.
        const marker = `[late-fee-for:${invoice.id}]`;
        const existingLateFee = await prisma.invoice.findFirst({
          where: { type: 'LATE_FEE', description: { contains: marker } },
        });
        if (!existingLateFee) {
          const label = rent.lateFeeType === 'FIXED' ? `flat fee` : `${rent.lateFeePercentage}%`;
          await prisma.invoice.create({
            data: {
              rentId: invoice.rentId!,
              type: 'LATE_FEE',
              amount: lateFeeAmount,
              dueDate: now,
              description: `Late fee (${label}) for overdue invoice ${invoice.invoiceNumber} ${marker}`,
            },
          });
          lateFeesCreated += 1;
        }
      }
    }
  }

  return { flagged, remindersSent, lateFeesCreated };
}
