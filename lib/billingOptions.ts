// The choices behind the plan and billing settings, with the wording the admin screen shows. Kept
// apart from the database code so the screen can import it. The first value of each list is the
// default.
export const UNIT_BILLING_OWNERS = [
  {
    value: 'MANAGER_ELSE_LANDLORD',
    label: 'The manager, else the landlord',
    hint: 'Units count against the manager running the property; with no manager they count against the landlord.',
  },
  {
    value: 'CREATOR',
    label: 'Whoever added the property',
    hint: 'Units count against the account that created the listing. Older listings with no creator follow the first choice.',
  },
  {
    value: 'BOTH',
    label: 'Both the manager and the landlord',
    hint: 'Each account counts the units against its own plan, so a unit can count twice when both have accounts.',
  },
] as const;

export const OVERAGE_MODES = [
  {
    value: 'ALLOW_AND_BILL',
    label: 'Allow it and bill the extra units',
    hint: 'They can keep adding units; the extra units are added to the next plan payment. Plans with no overage price stop at the limit.',
  },
  {
    value: 'HARD_STOP',
    label: 'Stop at the included units',
    hint: 'Nobody can go past the units their plan includes until they move to a bigger plan.',
  },
  {
    value: 'CONFIRM_EACH_TIME',
    label: 'Ask them to confirm each time',
    hint: 'Before a unit over the limit is added, they are told what the extra units cost per month and must confirm.',
  },
] as const;

export const DOWNGRADE_RULES = [
  {
    value: 'BLOCK',
    label: 'Block until they are within the new limit',
    hint: 'Moving to a smaller plan is refused while they have more units than it includes. Nothing is deleted for them.',
  },
  {
    value: 'GRACE_PERIOD',
    label: 'Allow it, with a grace period',
    hint: 'They keep and can add units for the number of days below, then the plan limits apply.',
  },
  {
    value: 'ALLOW_AND_BILL',
    label: 'Allow it and bill the extra units',
    hint: 'They move at once; units over the new limit are billed as overage where the plan has an overage price.',
  },
] as const;

export const DOWNGRADE_GRACE_DAYS = { min: 1, max: 365, default: 30 } as const;

export type UnitBillingOwner = (typeof UNIT_BILLING_OWNERS)[number]['value'];
export type OverageMode = (typeof OVERAGE_MODES)[number]['value'];
export type DowngradeRule = (typeof DOWNGRADE_RULES)[number]['value'];
