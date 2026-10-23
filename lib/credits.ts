import { prisma } from '@/lib/db';
import { getAccountPlan, ensureDefaultServices } from '@/lib/plans';
import { billingAccountOf } from '@/lib/team';

// "2026-10": the calendar month the monthly allowance belongs to.
export function currentPeriodKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Adds this month's allowance from the account's plan if it has not been added yet. The unique
 * (userId, periodKey) key makes it safe to call on every read: only the first call in a month
 * writes a row.
 */
export async function ensureMonthlyAllowance(userId: string): Promise<void> {
  // Credits belong to the account that pays: a company's members share their partner's.
  const { plan, billingAccountId } = await getAccountPlan(userId);
  if (plan.monthlyCredits <= 0) return;
  await prisma.creditEntry.createMany({
    data: [
      {
        userId: billingAccountId,
        delta: plan.monthlyCredits,
        reason: 'MONTHLY_ALLOWANCE',
        periodKey: currentPeriodKey(),
        note: `${plan.name} plan monthly credits`,
      },
    ],
    skipDuplicates: true,
  });
}

export async function creditBalance(userId: string): Promise<number> {
  await ensureMonthlyAllowance(userId);
  const accountId = await billingAccountOf(userId);
  const sum = await prisma.creditEntry.aggregate({
    where: { userId: accountId },
    _sum: { delta: true },
  });
  return sum._sum.delta ?? 0;
}

export class CreditError extends Error {
  constructor(
    public status: number,
    public code: 'UNKNOWN_SERVICE' | 'INSUFFICIENT_CREDITS',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Takes the credits a service costs from an account, or throws CreditError. Runs under a lock per
 * account so two spends at once cannot both use the same credits.
 */
export async function spendCredits(userId: string, serviceKey: string, note?: string) {
  await ensureDefaultServices();
  await ensureMonthlyAllowance(userId);
  const accountId = await billingAccountOf(userId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credits:${accountId}`}))`;
    const service = await tx.paidService.findUnique({ where: { key: serviceKey } });
    if (!service || !service.isActive) {
      throw new CreditError(404, 'UNKNOWN_SERVICE', 'That service is not available');
    }
    const sum = await tx.creditEntry.aggregate({
      where: { userId: accountId },
      _sum: { delta: true },
    });
    const balance = sum._sum.delta ?? 0;
    if (balance < service.creditCost) {
      throw new CreditError(
        402,
        'INSUFFICIENT_CREDITS',
        `${service.name} costs ${service.creditCost} credit(s) and you have ${balance}.`,
      );
    }
    return tx.creditEntry.create({
      data: {
        userId: accountId,
        delta: -service.creditCost,
        reason: 'SPEND',
        serviceKey,
        note,
        // Who in the company spent it.
        createdById: userId,
      },
    });
  });
}
