import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';
import { canManageProperty, isPrivateUnit } from '@/lib/api/propertyAccess';

type ListedProperty = {
  id: string;
  managerId: string | null;
  landlordId: string | null;
  isPublished: boolean;
  moderationStatus: string;
  mergedIntoId: string | null;
};

/**
 * Whether the caller may apply for a unit, or book or look up a viewing of a property (ISS-143).
 * The same rule as reading the listing: it is public (published, approved, not merged away, and
 * the unit not marked private), or the caller runs the property or already lives in it. Anything
 * else answers "not found", so the answer does not confirm that an id exists.
 *
 * Pass the unit when the request names one; without it, a building whose units are all private
 * has nothing to apply for or view.
 */
export async function listingOpenTo(
  session: { sub: string; role: Role },
  property: ListedProperty,
  unit?: { amenities: string[] | null } | null,
): Promise<boolean> {
  if (canManageProperty(session, property)) return true;
  const lives = await prisma.lease.findFirst({
    where: { tenantId: session.sub, unit: { propertyId: property.id } },
    select: { id: true },
  });
  if (lives) return true;

  if (
    !property.isPublished ||
    property.moderationStatus !== 'APPROVED' ||
    property.mergedIntoId !== null
  ) {
    return false;
  }
  if (unit) return !isPrivateUnit(unit);
  const units = await prisma.unit.findMany({
    where: { propertyId: property.id },
    select: { amenities: true },
  });
  return units.length === 0 || units.some((u) => !isPrivateUnit(u));
}
