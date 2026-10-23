import { prisma } from '@/lib/db';

// Property.trustScore (ISS-013). It used to default to 100 and never change,
// so the "high trust" filters meant nothing. This is a plain, documented
// formula over signals the platform really records, recomputed daily. It is a
// heuristic, not a model, and the weights below are the single place to tune.
//
//   40  base (every listed property starts here)
//   20  owner verification: +10 for a KYC-verified landlord, +10 for a
//       KYC-verified manager (a property with only one of them can reach 10)
//   15  maintenance follow-through: completed / (all non-cancelled) requests;
//       needs at least 3 requests, otherwise a neutral 7
//   15  rent reliability: share of scored rents rated GOOD or EXCELLENT;
//       needs at least 1 scored rent, otherwise a neutral 7
//   10  occupancy: occupied units / all units (0 with no units)
export const TRUST_WEIGHTS = {
  base: 40,
  verifiedOwner: 10,
  verifiedManager: 10,
  maintenance: 15,
  rent: 15,
  occupancy: 10,
  neutral: 7,
  minRequests: 3,
} as const;

export function computeTrustScore(input: {
  landlordVerified: boolean;
  managerVerified: boolean;
  requests: { completed: number; total: number };
  rents: { reliable: number; scored: number };
  units: { occupied: number; total: number };
}): number {
  const w = TRUST_WEIGHTS;
  let score = w.base;
  if (input.landlordVerified) score += w.verifiedOwner;
  if (input.managerVerified) score += w.verifiedManager;
  score +=
    input.requests.total >= w.minRequests
      ? (input.requests.completed / input.requests.total) * w.maintenance
      : w.neutral;
  score +=
    input.rents.scored >= 1 ? (input.rents.reliable / input.rents.scored) * w.rent : w.neutral;
  score += input.units.total > 0 ? (input.units.occupied / input.units.total) * w.occupancy : 0;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export async function runPropertyTrustScorer(): Promise<{ scored: number; changed: number }> {
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      trustScore: true,
      landlord: { select: { kycStatus: true } },
      manager: { select: { kycStatus: true } },
      units: {
        select: {
          status: true,
          maintenanceRequests: { select: { status: true } },
          rents: { select: { paymentReliability: true } },
        },
      },
    },
  });

  let changed = 0;
  for (const p of properties) {
    const requests = p.units
      .flatMap((u) => u.maintenanceRequests)
      .filter((r) => r.status !== 'CANCELLED');
    const scoredRents = p.units.flatMap((u) => u.rents).filter((l) => l.paymentReliability);
    const score = computeTrustScore({
      landlordVerified: p.landlord?.kycStatus === 'VERIFIED',
      managerVerified: p.manager?.kycStatus === 'VERIFIED',
      requests: {
        completed: requests.filter((r) => r.status === 'COMPLETED').length,
        total: requests.length,
      },
      rents: {
        reliable: scoredRents.filter(
          (l) => l.paymentReliability === 'EXCELLENT' || l.paymentReliability === 'GOOD',
        ).length,
        scored: scoredRents.length,
      },
      units: {
        occupied: p.units.filter((u) => u.status === 'OCCUPIED').length,
        total: p.units.length,
      },
    });
    if (score !== p.trustScore) {
      await prisma.property.update({ where: { id: p.id }, data: { trustScore: score } });
      changed += 1;
    }
  }
  return { scored: properties.length, changed };
}
