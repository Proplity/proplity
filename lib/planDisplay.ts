import type { Plan } from '@/lib/api/types';

export const naira = (n: number) => `₦${n.toLocaleString()}`;

/** The lines shown on a plan card: what it includes, from the plan's own numbers, then the admin's own bullets. */
export function planBullets(plan: Plan): string[] {
  const lines = [
    `${plan.unitsIncluded} unit${plan.unitsIncluded === 1 ? '' : 's'} included`,
    `${plan.usersIncluded} user${plan.usersIncluded === 1 ? '' : 's'}`,
  ];
  if (plan.overagePerUnit !== null) {
    lines.push(`Then ${naira(plan.overagePerUnit)} per unit per month`);
  }
  if (plan.monthlyCredits > 0) lines.push(`${plan.monthlyCredits} credits every month`);
  return [...lines, ...plan.features];
}

/** The most a yearly payment saves against twelve monthly ones, as a whole percent (0 when none does). */
export function bestYearlySavingPct(plans: Plan[]): number {
  let best = 0;
  for (const p of plans) {
    if (p.yearlyPrice !== null && p.monthlyPrice > 0) {
      best = Math.max(best, Math.round((1 - p.yearlyPrice / (p.monthlyPrice * 12)) * 100));
    }
  }
  return best;
}

/** What to print as a plan's price: the per-month figure, or "Free". */
export function planPriceLabel(plan: Plan, yearly: boolean): { amount: string; per: string } {
  if (plan.monthlyPrice === 0) return { amount: 'Free', per: '' };
  if (yearly && plan.yearlyPrice !== null) {
    return { amount: naira(Math.round(plan.yearlyPrice / 12)), per: '/month, billed yearly' };
  }
  return { amount: naira(plan.monthlyPrice), per: '/month' };
}
