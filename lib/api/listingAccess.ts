import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';
import { canManageProperty, isPublicUnit } from '@/lib/api/propertyAccess';
import { getServerSession } from '@/lib/auth/session';

/** The signed-in caller of a public route, or null for a visitor. */
export async function sessionOrNull(): Promise<{ sub: string; role: Role } | null> {
  const jwt = await getServerSession();
  return jwt ? { sub: jwt.sub, role: jwt.role as Role } : null;
}

type ListedProperty = {
  id: string;
  managerId: string | null;
  landlordId: string | null;
  isPublished: boolean;
  moderationStatus: string;
  mergedIntoId: string | null;
};

/**
 * What a caller may see of a property's listing (ISS-143, ISS-146). The property team, admins and
 * people who hold or held a rent there see everything. Everyone else, signed in or not, sees it
 * only while it is public: published, approved and not merged away, and then without the units
 * marked private or still awaiting an admin's approval.
 */
export async function listingViewer(
  session: { sub: string; role: Role } | null,
  property: ListedProperty,
): Promise<{ seesAll: boolean; visible: boolean }> {
  if (session) {
    if (canManageProperty(session, property)) return { seesAll: true, visible: true };
    const lives = await prisma.rent.findFirst({
      where: { tenantId: session.sub, unit: { propertyId: property.id } },
      select: { id: true },
    });
    if (lives) return { seesAll: true, visible: true };
  }
  const isPublic =
    property.isPublished &&
    property.moderationStatus === 'APPROVED' &&
    property.mergedIntoId === null;
  return { seesAll: false, visible: isPublic };
}

/**
 * Whether the caller may apply for a unit, or book or look up a viewing of a property (ISS-143).
 * The same rule as reading the listing; anything else answers "not found", so the answer does not
 * confirm that an id exists.
 *
 * Pass the unit when the request names one; without it, a building whose units are all private
 * has nothing to apply for or view.
 */
export async function listingOpenTo(
  session: { sub: string; role: Role },
  property: ListedProperty,
  unit?: { amenities: string[] | null } | null,
): Promise<boolean> {
  const { seesAll, visible } = await listingViewer(session, property);
  if (seesAll) return true;
  if (!visible) return false;
  if (unit) return isPublicUnit(unit);
  const units = await prisma.unit.findMany({
    where: { propertyId: property.id },
    select: { amenities: true },
  });
  return units.length === 0 || units.some(isPublicUnit);
}
