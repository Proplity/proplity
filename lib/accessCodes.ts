import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * A tenant's gate codes belong to their tenancy (ISS-138). When a rent ends (terminated or expired)
 * the codes that tenant made for that unit are revoked, unless they still hold another active rent
 * on it (a renewal starts the new rent before the old one ends). Revoked, never deleted: the
 * access log hangs off the code.
 */
export async function revokeCodesWhenTenancyEnds(
  tx: Tx,
  rent: { id: string; unitId: string; tenantId: string },
): Promise<number> {
  const stillHolds = await tx.rent.findFirst({
    where: {
      unitId: rent.unitId,
      tenantId: rent.tenantId,
      status: 'ACTIVE',
      id: { not: rent.id },
    },
    select: { id: true },
  });
  if (stillHolds) return 0;
  const result = await tx.accessCode.updateMany({
    where: { unitId: rent.unitId, createdById: rent.tenantId, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  return result.count;
}
