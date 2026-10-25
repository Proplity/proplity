import type { Prisma } from '@prisma/client';
import { reopenThreadsWhenTenancyResumes } from '@/lib/conversationAccess';

type Tx = Prisma.TransactionClient;

/**
 * Thrown from inside a $transaction so the whole activation rolls back -- returning a plain
 * NextResponse from within the callback would commit the rent update that already ran.
 */
export class UnitAlreadyOccupiedError extends Error {
  constructor(public readonly conflictingRentId: string) {
    super('Unit already has an active rent');
  }
}

type RentForOccupancy = {
  id: string;
  unitId: string;
  tenantId: string;
  unit: { propertyId: string };
};

/**
 * The unit side of a rent becoming ACTIVE: refuses when another rent already occupies the unit,
 * marks the unit occupied and lets the tenant back into their message threads. The caller has
 * already set the rent's status and holds the unit's row lock. Creating a rent on an occupied unit
 * is allowed (next year's rent is signed before this year's ends), so activation is where the line
 * is drawn (ISS-139).
 */
export async function occupyUnitForRent(tx: Tx, rent: RentForOccupancy): Promise<void> {
  const conflicting = await tx.rent.findFirst({
    where: { unitId: rent.unitId, status: 'ACTIVE', id: { not: rent.id } },
    select: { id: true },
  });
  if (conflicting) throw new UnitAlreadyOccupiedError(conflicting.id);
  await tx.unit.update({ where: { id: rent.unitId }, data: { status: 'OCCUPIED' } });
  await reopenThreadsWhenTenancyResumes(tx, {
    id: rent.id,
    tenantId: rent.tenantId,
    propertyId: rent.unit.propertyId,
  });
}

/**
 * Starts a PENDING rent once its agreement is signed by both sides, when the admin's rule is
 * "after both sign". Signing never fails because of this: a rent whose unit is taken by another
 * active rent stays pending and the result says so.
 */
export async function activateRentAfterSigning(
  tx: Tx,
  rentId: string,
): Promise<'ACTIVATED' | 'NOT_PENDING' | 'UNIT_OCCUPIED'> {
  const rent = await tx.rent.findUnique({
    where: { id: rentId },
    select: {
      id: true,
      unitId: true,
      tenantId: true,
      status: true,
      unit: { select: { propertyId: true } },
    },
  });
  if (!rent || rent.status !== 'PENDING') return 'NOT_PENDING';
  await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${rent.unitId} FOR UPDATE`;
  const taken = await tx.rent.findFirst({
    where: { unitId: rent.unitId, status: 'ACTIVE', id: { not: rent.id } },
    select: { id: true },
  });
  if (taken) return 'UNIT_OCCUPIED';
  await tx.rent.update({ where: { id: rent.id }, data: { status: 'ACTIVE' } });
  await occupyUnitForRent(tx, rent);
  return 'ACTIVATED';
}
