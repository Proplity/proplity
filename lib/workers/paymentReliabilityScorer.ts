import { prisma } from '@/lib/db';
import { PaymentReliability, RiskLevel } from '@prisma/client';

// A deliberate, simple, inspectable heuristic -- NOT the "AI late payment
// prediction" the PRD describes. No formula for that is specified anywhere
// in the repo; shipping this approximation beats leaving
// paymentReliability/riskScore permanently null, but it should be swapped
// for a real model later, not mistaken for one now.
function scoreFromRatio(
  onTime: number,
  late: number,
  missed: number,
): { paymentReliability: PaymentReliability; riskScore: RiskLevel } {
  const total = onTime + late + missed;
  const ratio = onTime / total;

  const paymentReliability: PaymentReliability =
    ratio >= 0.9 ? 'EXCELLENT' : ratio >= 0.7 ? 'GOOD' : ratio >= 0.5 ? 'FAIR' : 'POOR';

  const riskScore: RiskLevel = missed >= 2 || ratio < 0.5 ? 'HIGH' : missed === 1 || ratio < 0.8 ? 'MEDIUM' : 'LOW';

  return { paymentReliability, riskScore };
}

export async function runPaymentReliabilityScorer(): Promise<{ scored: number; skippedNoHistory: number }> {
  const now = new Date();
  const leases = await prisma.lease.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRED'] } },
    include: {
      invoices: {
        where: { type: 'RENT', dueDate: { lt: now } },
        // Chronological, not insertion/DB order -- payments[0] below is
        // read as "the first payment made against this invoice."
        include: { payments: { orderBy: { paidAt: 'asc' } } },
      },
    },
  });

  let scored = 0;
  let skippedNoHistory = 0;

  for (const lease of leases) {
    if (lease.invoices.length === 0) {
      skippedNoHistory += 1;
      continue;
    }

    let onTime = 0;
    let late = 0;
    let missed = 0;

    for (const invoice of lease.invoices) {
      if (invoice.status === 'PAID') {
        const firstPayment = invoice.payments[0];
        if (firstPayment && firstPayment.paidAt <= invoice.dueDate) onTime += 1;
        else late += 1;
      } else {
        // UNPAID, OVERDUE, PARTIALLY_PAID, or CANCELLED with a past due
        // date all count as a missed cycle for reliability purposes.
        missed += 1;
      }
    }

    const { paymentReliability, riskScore } = scoreFromRatio(onTime, late, missed);
    await prisma.lease.update({
      where: { id: lease.id },
      data: { paymentReliability, riskScore, riskScoreUpdatedAt: now },
    });
    scored += 1;
  }

  return { scored, skippedNoHistory };
}
