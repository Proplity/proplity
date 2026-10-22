import { prisma } from '@/lib/db';

export type ReviewerKind = 'TENANT' | 'VISITOR';

/**
 * Why this person may review a property (ISS-149): they have held a lease on one of its units
 * (any status, so a past tenant counts), or a viewing there was confirmed and its time has passed.
 * A requested, cancelled or no-show viewing does not count. `leaseId` is set for a tenant and is
 * what later marks the review as verified; a visitor has none.
 */
export async function findReviewBasis(
  userId: string,
  propertyId: string,
): Promise<{ kind: ReviewerKind; leaseId: string | null } | null> {
  const lease = await prisma.lease.findFirst({
    where: { tenantId: userId, unit: { propertyId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (lease) return { kind: 'TENANT', leaseId: lease.id };

  const viewing = await prisma.propertyViewing.findFirst({
    where: {
      requestedById: userId,
      propertyId,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
  });
  return viewing ? { kind: 'VISITOR', leaseId: null } : null;
}

/** A review written by a lease-holder is a tenant's; every other review is a visitor's. */
export function reviewerKind(review: { leaseId: string | null }): ReviewerKind {
  return review.leaseId !== null ? 'TENANT' : 'VISITOR';
}
