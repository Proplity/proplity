import { Prisma, type Plan, type Subscription } from '@prisma/client';
import { prisma } from '@/lib/db';
import { accountMemberIds, billingAccountOf } from '@/lib/team';
import type { getSystemSettings } from '@/lib/systemSettings';
import { DEFAULT_PLANS, DEFAULT_SERVICES } from '@/lib/planDefaults';

export { priceFor } from '@/lib/planPricing';

type Db = Prisma.TransactionClient;
type Settings = Awaited<ReturnType<typeof getSystemSettings>>;

export async function ensureDefaultPlans(): Promise<void> {
  if ((await prisma.plan.count()) > 0) return;
  await prisma.plan.createMany({ data: DEFAULT_PLANS, skipDuplicates: true });
}

export async function ensureDefaultServices(): Promise<void> {
  if ((await prisma.paidService.count()) > 0) return;
  await prisma.paidService.createMany({ data: DEFAULT_SERVICES, skipDuplicates: true });
}

export async function listPlans(opts: { onlyActive?: boolean } = {}): Promise<Plan[]> {
  await ensureDefaultPlans();
  return prisma.plan.findMany({
    where: opts.onlyActive ? { isActive: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
  });
}

/** The plan everyone without a paid subscription is on (the free one). */
export async function getDefaultPlan(db: Db = prisma): Promise<Plan> {
  await ensureDefaultPlans();
  const flagged = await db.plan.findFirst({
    where: { isDefault: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (flagged) return flagged;
  // An admin who clears the flag still leaves everybody a plan: the cheapest one.
  const cheapest = await db.plan.findFirst({
    orderBy: [{ monthlyPrice: 'asc' }, { sortOrder: 'asc' }],
  });
  if (!cheapest) throw new Error('There are no plans');
  return cheapest;
}

export type AccountPlan = {
  plan: Plan;
  /** The account that pays: the person, or the managing partner when they work in a company. */
  billingAccountId: string;
  subscription: Subscription | null;
  /** A paid plan whose period ended (or was cancelled): the account is back on the default plan. */
  lapsed: boolean;
};

/**
 * The plan someone is on right now. A member of a company is on their managing partner's plan.
 */
export async function getAccountPlan(userId: string, db: Db = prisma): Promise<AccountPlan> {
  const billingAccountId = await billingAccountOf(userId, db);
  const subscription = await db.subscription.findUnique({
    where: { userId: billingAccountId },
    include: { plan: true },
  });
  const fallback = await getDefaultPlan(db);
  if (!subscription || !subscription.plan) {
    return { plan: fallback, billingAccountId, subscription, lapsed: false };
  }
  const ended =
    subscription.status === 'CANCELLED' ||
    (subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd <= new Date());
  if (ended && !subscription.plan.isDefault) {
    return { plan: fallback, billingAccountId, subscription, lapsed: true };
  }
  return { plan: subscription.plan, billingAccountId, subscription, lapsed: false };
}

type OwnerFields = {
  managerId: string | null;
  landlordId: string | null;
  createdById: string | null;
};

/** The accounts whose plan a property's units count against, under the admin's choice. */
export function billedAccounts(rule: Settings['unitBillingOwner'], p: OwnerFields): string[] {
  const managerElseLandlord = p.managerId ?? p.landlordId;
  const ids =
    rule === 'BOTH'
      ? [p.managerId, p.landlordId]
      : rule === 'CREATOR'
        ? [p.createdById ?? managerElseLandlord]
        : [managerElseLandlord];
  return [...new Set(ids.filter((id): id is string => !!id))];
}

function propertiesBilledTo(
  rule: Settings['unitBillingOwner'],
  ids: string[],
): Prisma.PropertyWhereInput {
  const managerElseLandlord: Prisma.PropertyWhereInput = {
    OR: [{ managerId: { in: ids } }, { managerId: null, landlordId: { in: ids } }],
  };
  if (rule === 'BOTH') return { OR: [{ managerId: { in: ids } }, { landlordId: { in: ids } }] };
  if (rule === 'CREATOR') {
    return { OR: [{ createdById: { in: ids } }, { createdById: null, ...managerElseLandlord }] };
  }
  return managerElseLandlord;
}

/**
 * Units that count against a billing account's plan: those of the person, or of everyone in their
 * company. A listing merged into another does not count.
 */
export async function countUnitsFor(
  rule: Settings['unitBillingOwner'],
  billingAccountId: string,
  db: Db = prisma,
): Promise<number> {
  const ids = await accountMemberIds(billingAccountId, db);
  return db.unit.count({
    where: { property: { AND: [propertiesBilledTo(rule, ids), { mergedIntoId: null }] } },
  });
}

/** The billing accounts behind some user ids: a company member's is the managing partner. */
export async function resolveBillingAccounts(ids: string[], db: Db = prisma): Promise<string[]> {
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, organisation: { select: { ownerId: true } } },
  });
  return [...new Set(users.map((u) => u.organisation?.ownerId ?? u.id))];
}

/** People on the account: everyone in the company (the partner included), or just the one person. */
export async function countUsersFor(billingAccountId: string, db: Db = prisma): Promise<number> {
  return (await accountMemberIds(billingAccountId, db)).length;
}

export type PlanUsage = {
  units: number;
  unitsIncluded: number;
  extraUnits: number;
  /** Naira per month the extra units come to; 0 when the plan has no overage price. */
  overageMonthly: number;
  users: number;
  usersIncluded: number;
};

export async function getUsage(userId: string, settings: Settings): Promise<PlanUsage> {
  const { plan, billingAccountId } = await getAccountPlan(userId);
  const [units, users] = await Promise.all([
    countUnitsFor(settings.unitBillingOwner, billingAccountId),
    countUsersFor(billingAccountId),
  ]);
  const extraUnits = Math.max(0, units - plan.unitsIncluded);
  return {
    units,
    unitsIncluded: plan.unitsIncluded,
    extraUnits,
    overageMonthly: plan.overagePerUnit ? extraUnits * plan.overagePerUnit : 0,
    users,
    usersIncluded: plan.usersIncluded,
  };
}

export class PlanLimitError extends Error {
  constructor(
    public status: number,
    public code: 'PLAN_LIMIT' | 'OVERAGE_NEEDS_CONFIRMATION',
    message: string,
    public details: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Throws PlanLimitError when adding `adding` units to a property would go past what the paying
 * account's plan includes, under the admin's overage rule. Call it inside the transaction that
 * creates the units: it takes a lock per paying account, so two requests at once cannot both
 * squeeze under the limit. Does nothing while limits are switched off, for an admin, or during a
 * downgrade grace period.
 */
export async function assertUnitCapacity(
  tx: Db,
  opts: {
    settings: Settings;
    property: OwnerFields;
    adding: number;
    actor: { id: string; role: string };
    confirmOverage?: boolean;
  },
): Promise<void> {
  const { settings, property, adding, actor } = opts;
  if (!settings.enforcePlanLimits || adding <= 0 || actor.role === 'ADMIN') return;

  const accounts = (
    await resolveBillingAccounts(billedAccounts(settings.unitBillingOwner, property), tx)
  ).sort();
  const actorAccount = await billingAccountOf(actor.id, tx);
  for (const id of accounts) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan-units:${id}`}))`;
  }

  for (const id of accounts) {
    const account = await tx.user.findUnique({ where: { id }, select: { role: true, name: true } });
    if (!account || account.role === 'ADMIN') continue;
    const { plan, subscription } = await getAccountPlan(id, tx);
    if (subscription?.graceEndsAt && subscription.graceEndsAt > new Date()) continue;

    const used = await countUnitsFor(settings.unitBillingOwner, id, tx);
    const after = used + adding;
    if (after <= plan.unitsIncluded) continue;

    const whose =
      id === actor.id
        ? 'Your'
        : id === actorAccount
          ? "Your company's"
          : `${account.name ?? 'The property owner'}'s`;
    if (plan.overagePerUnit === null || settings.overageMode === 'HARD_STOP') {
      throw new PlanLimitError(
        403,
        'PLAN_LIMIT',
        `${whose} ${plan.name} plan includes ${plan.unitsIncluded} units and ${used} are in use. Move to a bigger plan to add more.`,
        { plan: plan.name, limit: plan.unitsIncluded, used, adding },
      );
    }
    const extraAfter = after - plan.unitsIncluded;
    if (settings.overageMode === 'CONFIRM_EACH_TIME' && !opts.confirmOverage) {
      const extraBefore = Math.max(0, used - plan.unitsIncluded);
      throw new PlanLimitError(
        409,
        'OVERAGE_NEEDS_CONFIRMATION',
        `${whose} ${plan.name} plan includes ${plan.unitsIncluded} units. Adding ${adding} more makes ${extraAfter} extra, ₦${(extraAfter * plan.overagePerUnit).toLocaleString()} a month in total.`,
        {
          plan: plan.name,
          limit: plan.unitsIncluded,
          used,
          adding,
          extraUnits: extraAfter,
          monthlyCost: extraAfter * plan.overagePerUnit,
          addedMonthlyCost: (extraAfter - extraBefore) * plan.overagePerUnit,
        },
      );
    }
  }
}

export type DowngradeCheck =
  | { allowed: true; graceDays: number | null }
  | { allowed: false; message: string; details: Record<string, unknown> };

/**
 * Whether an account may move to `target` given how much it uses, under the admin's downgrade
 * rule. Moving to a plan that includes at least what the account uses is always fine.
 */
export async function checkDowngrade(
  userId: string,
  target: Pick<Plan, 'name' | 'unitsIncluded' | 'usersIncluded'>,
  settings: Settings,
): Promise<DowngradeCheck> {
  if (!settings.enforcePlanLimits) return { allowed: true, graceDays: null };
  const [units, users] = await Promise.all([
    countUnitsFor(settings.unitBillingOwner, userId),
    countUsersFor(userId),
  ]);
  const tooManyUnits = units > target.unitsIncluded;
  const tooManyUsers = users > target.usersIncluded;
  if (!tooManyUnits && !tooManyUsers) return { allowed: true, graceDays: null };

  if (settings.downgradeRule === 'BLOCK') {
    const parts = [
      tooManyUnits
        ? `${units - target.unitsIncluded} unit(s) over its ${target.unitsIncluded}`
        : '',
      tooManyUsers
        ? `${users - target.usersIncluded} user(s) over its ${target.usersIncluded}`
        : '',
    ].filter(Boolean);
    return {
      allowed: false,
      message: `The ${target.name} plan cannot hold what you have now: ${parts.join(' and ')}. Remove the extra before switching.`,
      details: {
        plan: target.name,
        units,
        unitsIncluded: target.unitsIncluded,
        users,
        usersIncluded: target.usersIncluded,
      },
    };
  }
  return {
    allowed: true,
    graceDays: settings.downgradeRule === 'GRACE_PERIOD' ? settings.downgradeGraceDays : null,
  };
}

export function graceEndsAtFrom(graceDays: number | null, now = new Date()): Date | null {
  if (graceDays === null) return null;
  return new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
}
