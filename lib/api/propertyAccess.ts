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
