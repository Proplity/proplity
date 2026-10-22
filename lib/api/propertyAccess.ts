import { Property, Role } from '@prisma/client';

/**
 * True if the session belongs to the property's own manager/landlord, or an
 * ADMIN. Reused across properties/[id], properties/[id]/units, and
 * properties/[id]/units/[unitId] — every route that lets an owner edit their
 * own listing rather than just any authenticated user of the right role.
 */
export function canManageProperty(
  session: { sub: string; role: Role },
  property: Pick<Property, 'managerId' | 'landlordId'>,
) {
  return (
    session.role === 'ADMIN' ||
    property.managerId === session.sub ||
    property.landlordId === session.sub
  );
}

export function serializeUnit<T extends { squareFeet: number | null }>(unit: T) {
  const { squareFeet, ...rest } = unit;
  return { ...rest, sqft: squareFeet };
}

// A unit the owner side marked "Make Private" carries this amenity flag; it is
// the only place the private/public choice is stored.
export const PRIVATE_UNIT_FLAG = 'visibility:private';

export function isPrivateUnit(unit: { amenities?: string[] | null }) {
  return !!unit.amenities?.includes(PRIVATE_UNIT_FLAG);
}

// A unit added or changed by a manager or landlord carries this flag until an admin approves it
// (ISS-153). It is set and cleared by the server only.
export const PENDING_UNIT_FLAG = 'approval:pending';

export function isPendingUnit(unit: { amenities?: string[] | null }) {
  return !!unit.amenities?.includes(PENDING_UNIT_FLAG);
}

/** A unit the public may see: not marked private and not waiting for an admin's approval. */
export function isPublicUnit(unit: { amenities?: string[] | null }) {
  return !isPrivateUnit(unit) && !isPendingUnit(unit);
}

/**
 * Fields of a property that only the property team and admins read: the moderator's notes (which
 * can name other listings) and the staged edits. A tenant, vendor or applicant who gets the
 * property inside a lease, repair, invoice or application never needs them (ISS-148).
 */
export const PROPERTY_OMIT_INTERNAL = { moderationNotes: true, metadata: true } as const;

/** `include: { property: PUBLIC_PROPERTY }` -- the whole property row without its internal fields. */
export const PUBLIC_PROPERTY = { omit: PROPERTY_OMIT_INTERNAL } as const;
