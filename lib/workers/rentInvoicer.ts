import { prisma } from '@/lib/db';
import { PaymentFrequency } from '@prisma/client';

function addCycle(date: Date, frequency: PaymentFrequency): Date {
  const next = new Date(date);
  const monthsToAdd = { ANNUAL: 12, BI_ANNUAL: 6, QUARTERLY: 3, MONTHLY: 1 }[frequency];
  next.setMonth(next.getMonth() + monthsToAdd);
  return next;
}

// Idempotent by construction: always checks for an existing RENT invoice at
// the computed dueDate before creating one, so re-running (daily, or twice
// by accident) never double-bills a cycle.
export async function runRentInvoicer(): Promise<{ created: number; leasesChecked: number }> {
  const activeLeases = await prisma.lease.findMany({ where: { status: 'ACTIVE' } });
  let created = 0;

  for (const lease of activeLeases) {
    const latestInvoice = await prisma.invoice.findFirst({
      where: { leaseId: lease.id, type: 'RENT' },
      orderBy: { dueDate: 'desc' },
    });

    // Every lease gets an initial RENT invoice at creation (see
    // app/api/v1/leases/route.ts), so this should always exist -- but a
    // lease somehow missing one is skipped rather than guessed at.
    if (!latestInvoice) continue;

    const nextDueDate = addCycle(latestInvoice.dueDate, lease.paymentFrequency);
    const now = new Date();
    if (nextDueDate > now || nextDueDate > lease.endDate) continue;

    const existing = await prisma.invoice.findFirst({
      where: { leaseId: lease.id, type: 'RENT', dueDate: nextDueDate },
    });
    if (existing) continue;

    await prisma.invoice.create({
      data: {
        leaseId: lease.id,
        type: 'RENT',
        amount: lease.rentAmount,
        dueDate: nextDueDate,
        description: 'Recurring rent invoice',
      },
    });
    created += 1;
  }

  return { created, leasesChecked: activeLeases.length };
}
