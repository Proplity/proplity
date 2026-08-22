import { prisma } from '@/lib/db';

// Sends exactly one PAYMENT_REMINDER per invoice, not the full "reminder ->
// call -> notice" escalation ladder PRD §6.1 describes -- that's explicitly
// scoped to "Phase 2: Advanced AI rent intelligence" (PRD line 353), beyond
// this basic worker.
export async function runOverdueFlagger(): Promise<{ flagged: number; remindersSent: number }> {
  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: { status: 'UNPAID', dueDate: { lt: now } },
  });

  let remindersSent = 0;

  for (const invoice of overdue) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'OVERDUE' } });

    if (!invoice.leaseId) continue;

    const existingReminder = await prisma.notice.findFirst({
      where: { invoiceId: invoice.id, type: 'PAYMENT_REMINDER' },
    });
    if (existingReminder) continue;

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

  return { flagged: overdue.length, remindersSent };
}
