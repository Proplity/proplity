import { prisma } from '@/lib/db';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    include: { lease: true },
  });

  let flagged = 0;
  let remindersSent = 0;
  let lateFeesCreated = 0;

  for (const invoice of candidates) {
    // Lease.gracePeriodDays (default 7) was accepted at lease creation and
    // never read anywhere else until now -- an invoice with no lease (a
    // MAINTENANCE or direct userId invoice) has no grace concept, so it's
    // overdue right at its due date, same as before this fix.
    const gracePeriodDays = invoice.lease?.gracePeriodDays ?? 0;
    const graceDeadline = new Date(invoice.dueDate.getTime() + gracePeriodDays * MS_PER_DAY);
    if (graceDeadline > now) continue; // still within grace period -- not overdue yet

    if (invoice.status === 'UNPAID') {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'OVERDUE' } });
      flagged += 1;

      if (invoice.leaseId) {
        const existingReminder = await prisma.notice.findFirst({
          where: { invoiceId: invoice.id, type: 'PAYMENT_REMINDER' },
        });
        if (!existingReminder) {
          await prisma.notice.create({
            data: {
              leaseId: invoice.leaseId,
              invoiceId: invoice.id,
              type: 'PAYMENT_REMINDER',
              status: 'SENT',
              sentAt: now,
              content: `Your payment of ${invoice.amount} for invoice ${invoice.invoiceNumber} was due on ${invoice.dueDate.toDateString()} and is now overdue. Please make payment as soon as possible.`,
            },
          });
          remindersSent += 1;
        }
      }
    }

    // Late fee: one-time per overdue invoice, RENT only (a late fee on a
    // SECURITY_DEPOSIT or MAINTENANCE invoice doesn't map to what
    // Lease.lateFeePercentage means), and never on a LATE_FEE invoice
    // itself -- without that exclusion, a late fee's own dueDate (set to
    // "now" at creation, so immediately overdue) would make it a candidate
    // next run and compound indefinitely.
    if (invoice.type === 'RENT' && invoice.lease && invoice.lease.lateFeePercentage > 0) {
      // No FK from a LATE_FEE invoice back to the RENT invoice it's for --
      // encoded into the description instead (same convention as
      // subscriptions/checkout's tier/cycle encoding) so this stays
      // idempotent across runs without a schema change.
      const marker = `[late-fee-for:${invoice.id}]`;
      const existingLateFee = await prisma.invoice.findFirst({
        where: { type: 'LATE_FEE', description: { contains: marker } },
      });
      if (!existingLateFee) {
        const lateFeeAmount = Math.round(invoice.amount * (invoice.lease.lateFeePercentage / 100) * 100) / 100;
        if (lateFeeAmount > 0) {
          await prisma.invoice.create({
            data: {
              leaseId: invoice.leaseId!,
              type: 'LATE_FEE',
              amount: lateFeeAmount,
              dueDate: now,
              description: `Late fee (${invoice.lease.lateFeePercentage}%) for overdue invoice ${invoice.invoiceNumber} ${marker}`,
            },
          });
          lateFeesCreated += 1;
        }
      }
    }
  }

  return { flagged, remindersSent, lateFeesCreated };
}
