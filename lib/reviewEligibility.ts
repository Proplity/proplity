import { prisma } from '@/lib/db';

export type ReviewerKind = 'TENANT' | 'VISITOR';

/**
 * Why this person may review a property (ISS-149): they have held a rent on one of its units
 * (any status, so a past tenant counts), or a viewing there was confirmed and its time has passed.
 * A requested, cancelled or no-show viewing does not count. `rentId` is set for a tenant and is
 * what later marks the review as verified; a visitor has none.
 */
export async function findReviewBasis(
  userId: string,
  propertyId: string,
): Promise<{ kind: ReviewerKind; rentId: string | null } | null> {
  const rent = await prisma.rent.findFirst({
    where: { tenantId: userId, unit: { propertyId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (rent) return { kind: 'TENANT', rentId: rent.id };

  const viewing = await prisma.propertyViewing.findFirst({
    where: {
      requestedById: userId,
      propertyId,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
  });
  return viewing ? { kind: 'VISITOR', rentId: null } : null;
}

/** A review written by a rent-holder is a tenant's; every other review is a visitor's. */
export function reviewerKind(review: { rentId: string | null }): ReviewerKind {
  return review.rentId !== null ? 'TENANT' : 'VISITOR';
}
