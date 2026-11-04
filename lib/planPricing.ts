// What one payment for a plan comes to. Pure, so the checkout screen shows exactly the figure the
// server charges (the server works it out again from the same rule).
export type PricedPlan = {
  monthlyPrice: number;
  yearlyPrice: number | null;
  unitsIncluded: number;
  overagePerUnit: number | null;
};

/** The plan price plus any extra units for the whole period; null when the plan has no price for that cycle. */
export function priceFor(
  plan: PricedPlan,
  cycle: 'MONTHLY' | 'YEARLY',
  units: number,
): { base: number; overage: number; total: number; extraUnits: number } | null {
  const base = cycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
  if (base === null) return null;
  const extraUnits = Math.max(0, units - plan.unitsIncluded);
  const months = cycle === 'YEARLY' ? 12 : 1;
  const overage = plan.overagePerUnit ? extraUnits * plan.overagePerUnit * months : 0;
  return { base, overage, total: base + overage, extraUnits };
}
