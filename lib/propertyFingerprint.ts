import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

// ISS-025: two listings for the same building should share a fingerprint.
// The key is the lower-cased address and city with everything except a-z and
// 0-9 removed, hashed with SHA-256. The backfill in migration
// 20261014180000_listing_hash_backfill computes the same value in SQL, so keep
// the two in step.
export function listingHash(address: string, city: string): string {
  const key = `${address}|${city}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
  return createHash('sha256').update(key).digest('hex');
}

// Other live properties that share this fingerprint. Merged-away listings
// are excluded.
export function findPossibleDuplicates(hash: string, excludeId?: string) {
  return prisma.property.findMany({
    where: {
      listingHash: hash,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      mergedIntoId: null,
    },
    select: { id: true, name: true },
  });
}
