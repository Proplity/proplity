import { humanDays, termMonths } from '@/lib/agreementFields';

// The legal rules of a jurisdiction, applied to a tenancy someone is setting up. The rules are rows
// an admin edits (Admin > Rent agreements), so this file only reads them. Pure: no database.

export type RuleMode = 'OFF' | 'WARN' | 'BLOCK';

export type JurisdictionRules = {
  key: string;
  name: string;
  states: string[];
  isDefault: boolean;
  advanceRentMaxMonths: number | null;
  advanceRentMode: RuleMode;
  noticeDays: unknown;
  excludedAreas: string[];
  excludedAreasMode: RuleMode;
  registrationThresholdYears: number | null;
  lawyerReviewed: boolean;
};

export type PaymentFrequencyKey = 'ANNUAL' | 'BI_ANNUAL' | 'QUARTERLY' | 'MONTHLY';

export const MONTHS_PER_CYCLE: Record<PaymentFrequencyKey, number> = {
  ANNUAL: 12,
  BI_ANNUAL: 6,
  QUARTERLY: 3,
  MONTHLY: 1,
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** The jurisdiction whose rules cover a property's state, else the default one, else none. */
export function jurisdictionFor<T extends JurisdictionRules>(
  property: { state: string | null },
  jurisdictions: T[],
): T | null {
  const state = norm(property.state);
  if (state) {
    const match = jurisdictions.find((j) => j.states.some((s) => norm(s) === state));
    if (match) return match;
  }
  return jurisdictions.find((j) => j.isDefault) ?? null;
}

/** The notice to end a tenancy of this payment frequency, in days; null when the rules give none. */
export function noticeDaysFor(
  jurisdiction: Pick<JurisdictionRules, 'noticeDays'>,
  frequency: PaymentFrequencyKey,
): number | null {
  const table = jurisdiction.noticeDays;
  if (!table || typeof table !== 'object') return null;
  const value = (table as Record<string, unknown>)[frequency];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function noticePeriodText(
  jurisdiction: Pick<JurisdictionRules, 'noticeDays'>,
  frequency: PaymentFrequencyKey,
): string {
  const days = noticeDaysFor(jurisdiction, frequency);
  return days === null ? 'the period the law requires' : humanDays(days);
}

export type RuleFinding = {
  rule: 'ADVANCE_RENT' | 'EXCLUDED_AREA' | 'REGISTRATION';
  /** WARN is shown and the work goes ahead; BLOCK stops it. */
  mode: 'WARN' | 'BLOCK';
  message: string;
};

export type TenancyForRules = {
  paymentFrequency: PaymentFrequencyKey;
  startDate: Date;
  endDate: Date;
  address: string;
  city: string;
  /** Months of rent collected at once when it is more than one payment cycle (for example advance rent on top). */
  upfrontMonths?: number;
};

/** What a jurisdiction's rules say about a tenancy. Empty means nothing to flag. */
export function checkTenancyRules(
  jurisdiction: JurisdictionRules,
  tenancy: TenancyForRules,
): RuleFinding[] {
  const findings: RuleFinding[] = [];

  const max = jurisdiction.advanceRentMaxMonths;
  if (max !== null && jurisdiction.advanceRentMode !== 'OFF') {
    const upfront = Math.max(
      MONTHS_PER_CYCLE[tenancy.paymentFrequency],
      tenancy.upfrontMonths ?? 0,
    );
    if (upfront > max) {
      findings.push({
        rule: 'ADVANCE_RENT',
        mode: jurisdiction.advanceRentMode,
        message: `${jurisdiction.name} limits rent collected in advance to ${max} month${max === 1 ? '' : 's'}, and this tenancy collects ${upfront}.`,
      });
    }
  }

  if (jurisdiction.excludedAreasMode !== 'OFF' && jurisdiction.excludedAreas.length > 0) {
    const place = norm(`${tenancy.address} ${tenancy.city}`);
    const area = jurisdiction.excludedAreas.find((a) => norm(a) && place.includes(norm(a)));
    if (area) {
      findings.push({
        rule: 'EXCLUDED_AREA',
        mode: jurisdiction.excludedAreasMode,
        message: `${jurisdiction.name}'s tenancy law may not cover ${area}, so the usual limits and notice periods may not apply. Get legal advice before relying on this agreement.`,
      });
    }
  }

  const years = jurisdiction.registrationThresholdYears;
  if (years !== null && years > 0) {
    if (termMonths(tenancy.startDate, tenancy.endDate) >= years * 12) {
      findings.push({
        rule: 'REGISTRATION',
        mode: 'WARN',
        message: `A tenancy of ${years} years or more may need a registered deed in ${jurisdiction.name}. Check with a lawyer.`,
      });
    }
  }

  return findings;
}

export const blockingFindings = (findings: RuleFinding[]) =>
  findings.filter((f) => f.mode === 'BLOCK');
