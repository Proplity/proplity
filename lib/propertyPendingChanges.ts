import { Prisma } from '@prisma/client';
import { listingHash } from '@/lib/propertyFingerprint';
import { pendingChangesPropertySchema, pendingChangesUnitSchema } from '@/lib/api/propertySchemas';

// Staged ("pending") edits to a listing live in Property.metadata.pendingChanges.
// Only the server writes that field (the PATCH schema does not accept `metadata`),
// so everything in it was validated when it was staged. It is still re-validated
// here when applied, and every unit id is checked against the property (ISS-060).

export type PropertyMeta = Record<string, unknown>;

// Fields of a listing that go through admin review when an owner edits an approved one.
export const STAGED_PROPERTY_FIELDS = [
  'name',
  'address',
  'city',
  'state',
  'zipCode',
  'type',
  'description',
  'imageUrl',
  'exteriorPhotoUrl',
  'video360Url',
  'photoUrls',
] as const;

// Edits to identity or location unpublish the listing until an admin re-approves it.
export const CRITICAL_PROPERTY_FIELDS = ['name', 'address', 'city', 'state', 'type'] as const;

// The moderation state to go back to if the owner cancels the review request. Recorded
// by the server when an edit first leaves an approved listing; cancelling never
// raises a listing above the state it had (ISS-059).
export type RestoreTo = { moderationStatus: 'APPROVED'; isPublished: boolean };

export function readRestoreTo(pending: Record<string, unknown> | null): RestoreTo | null {
  const r = pending?.restoreTo as Partial<RestoreTo> | undefined;
  if (r && r.moderationStatus === 'APPROVED' && typeof r.isPublished === 'boolean') {
    return { moderationStatus: 'APPROVED', isPublished: r.isPublished };
  }
  return null;
}

export function pickStaged(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of STAGED_PROPERTY_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export function touchesCritical(fields: Record<string, unknown>): boolean {
  return CRITICAL_PROPERTY_FIELDS.some((k) => fields[k] !== undefined);
}

// Applies an approved property's staged edits inside the approval transaction.
export async function applyPendingChanges(
  tx: Prisma.TransactionClient,
  property: { id: string; address: string; city: string },
  pending: Record<string, unknown> | undefined,
) {
  if (!pending) return;

  const propertyEdits = pendingChangesPropertySchema.safeParse(pending.property ?? {});
  if (propertyEdits.success && Object.keys(propertyEdits.data).length > 0) {
    const edits = propertyEdits.data;
    const addressChanged = edits.address !== undefined || edits.city !== undefined;
    await tx.property.update({
      where: { id: property.id },
      data: {
        ...edits,
        ...(addressChanged
          ? {
              listingHash: listingHash(
                edits.address ?? property.address,
                edits.city ?? property.city,
              ),
            }
          : {}),
      },
    });
  }

  const unitsDict = pending.units;
  if (unitsDict && typeof unitsDict === 'object') {
    const ids = Object.keys(unitsDict);
    const owned = await tx.unit.findMany({
      where: { id: { in: ids }, propertyId: property.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((u) => u.id));
    for (const [unitId, raw] of Object.entries(unitsDict as Record<string, unknown>)) {
      if (!ownedIds.has(unitId)) continue; // never touch a unit of another property
      const parsed = pendingChangesUnitSchema.safeParse(raw);
      if (!parsed.success) continue;
      const { sqft, ...fields } = parsed.data;
      await tx.unit.update({
        where: { id: unitId },
        data: { ...fields, ...(sqft !== undefined ? { squareFeet: sqft } : {}) },
      });
    }
  }
}
