import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * A tenant's gate codes belong to their tenancy (ISS-138). When a lease ends (terminated or expired)
 * the codes that tenant made for that unit are revoked, unless they still hold another active lease
 * on it (a renewal starts the new lease before the old one ends). Revoked, never deleted: the
 * access log hangs off the code.
 */
export async function revokeCodesWhenTenancyEnds(
  tx: Tx,
  lease: { id: string; unitId: string; tenantId: string },
): Promise<number> {
  const stillHolds = await tx.lease.findFirst({
    where: {
      unitId: lease.unitId,
      tenantId: lease.tenantId,
      status: 'ACTIVE',
      id: { not: lease.id },
    },
    select: { id: true },
  });
  if (stillHolds) return 0;
  const result = await tx.accessCode.updateMany({
    where: { unitId: lease.unitId, createdById: lease.tenantId, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  return result.count;
}
