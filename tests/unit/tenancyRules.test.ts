import { describe, expect, it } from 'vitest';
import {
  blockingFindings,
  checkTenancyRules,
  jurisdictionFor,
  noticeDaysFor,
  noticePeriodText,
  type JurisdictionRules,
} from '@/lib/tenancyRules';
import { DEFAULT_JURISDICTIONS } from '@/lib/agreementDefaults';

const rules = (over: Partial<JurisdictionRules> = {}): JurisdictionRules => ({
  key: 'lagos',
  name: 'Lagos State',
  states: ['Lagos'],
  isDefault: false,
  advanceRentMaxMonths: 12,
  advanceRentMode: 'WARN',
  noticeDays: { MONTHLY: 30, ANNUAL: 180 },
  excludedAreas: ['Ikoyi', 'Victoria Island'],
  excludedAreasMode: 'WARN',
  registrationThresholdYears: 3,
  lawyerReviewed: false,
  ...over,
});

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const tenancy = {
  paymentFrequency: 'ANNUAL' as const,
  startDate: d('2026-09-01'),
  endDate: d('2027-08-31'),
  address: '12 Admiralty Way',
  city: 'Lekki',
};

describe('which jurisdiction applies', () => {
  const lagos = rules();
  const abuja = rules({ key: 'abuja', name: 'FCT', states: ['FCT', 'Abuja'] });
  const general = rules({ key: 'ng', name: 'Nigeria', states: [], isDefault: true });

  it('matches a state ignoring case and spaces, else the default, else none', () => {
    expect(jurisdictionFor({ state: ' lagos ' }, [lagos, abuja, general])).toBe(lagos);
    expect(jurisdictionFor({ state: 'ABUJA' }, [lagos, abuja, general])).toBe(abuja);
    expect(jurisdictionFor({ state: 'Kano' }, [lagos, abuja, general])).toBe(general);
    expect(jurisdictionFor({ state: null }, [lagos, abuja, general])).toBe(general);
    expect(jurisdictionFor({ state: 'Kano' }, [lagos, abuja])).toBeNull();
  });

  it('the starting jurisdictions cover Lagos and the FCT and fall back to a general one', () => {
    const all = DEFAULT_JURISDICTIONS.map((j) => ({
      ...j,
      states: [...j.states],
      excludedAreas: [...j.excludedAreas],
    })) as unknown as JurisdictionRules[];
    expect(jurisdictionFor({ state: 'Lagos' }, all)?.key).toBe('lagos');
    expect(jurisdictionFor({ state: 'FCT' }, all)?.key).toBe('abuja');
    expect(jurisdictionFor({ state: 'Enugu' }, all)?.key).toBe('nigeria-general');
    expect(DEFAULT_JURISDICTIONS.every((j) => !j.lawyerReviewed)).toBe(true);
  });
});

describe('notice periods', () => {
  it('reads the day count for a frequency and says it in words', () => {
    const j = rules();
    expect(noticeDaysFor(j, 'ANNUAL')).toBe(180);
    expect(noticePeriodText(j, 'ANNUAL')).toBe('6 months');
    expect(noticePeriodText(j, 'MONTHLY')).toBe('1 month');
    expect(noticeDaysFor(j, 'QUARTERLY')).toBeNull();
    expect(noticePeriodText(j, 'QUARTERLY')).toBe('the period the law requires');
    expect(noticeDaysFor(rules({ noticeDays: 'broken' }), 'ANNUAL')).toBeNull();
    expect(noticeDaysFor(rules({ noticeDays: { ANNUAL: -5 } }), 'ANNUAL')).toBeNull();
  });
});

describe('checking a tenancy against the rules', () => {
  it('flags nothing for an ordinary yearly tenancy', () => {
    expect(checkTenancyRules(rules(), tenancy)).toEqual([]);
  });

  it('flags rent collected beyond the cap, using the mode the admin set', () => {
    const over = { ...tenancy, upfrontMonths: 18 };
    const warn = checkTenancyRules(rules(), over);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ rule: 'ADVANCE_RENT', mode: 'WARN' });
    expect(warn[0].message).toContain('12 months');
    expect(warn[0].message).toContain('18');

    const block = checkTenancyRules(rules({ advanceRentMode: 'BLOCK' }), over);
    expect(blockingFindings(block)).toHaveLength(1);

    expect(checkTenancyRules(rules({ advanceRentMode: 'OFF' }), over)).toEqual([]);
    expect(checkTenancyRules(rules({ advanceRentMaxMonths: null }), over)).toEqual([]);
  });

  it('counts a single payment cycle as the advance, so a cap of 3 months stops a yearly payment', () => {
    const strict = rules({ advanceRentMaxMonths: 3, advanceRentMode: 'BLOCK' });
    expect(checkTenancyRules(strict, tenancy)[0].rule).toBe('ADVANCE_RENT');
    expect(checkTenancyRules(strict, { ...tenancy, paymentFrequency: 'QUARTERLY' })).toEqual([]);
    expect(checkTenancyRules(strict, { ...tenancy, paymentFrequency: 'MONTHLY' })).toEqual([]);
  });

  it('flags a property in an area the law does not cover', () => {
    const f = checkTenancyRules(rules(), { ...tenancy, address: '5 Bourdillon Road, Ikoyi' });
    expect(f.map((x) => x.rule)).toEqual(['EXCLUDED_AREA']);
    expect(f[0].message).toContain('Ikoyi');
    expect(
      checkTenancyRules(rules({ excludedAreasMode: 'OFF' }), {
        ...tenancy,
        address: '5 Bourdillon Road, Ikoyi',
      }),
    ).toEqual([]);
  });

  it('warns about a long tenancy that may need a registered deed', () => {
    const long = { ...tenancy, endDate: d('2029-08-31') };
    const f = checkTenancyRules(rules(), long);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'REGISTRATION', mode: 'WARN' });
    expect(checkTenancyRules(rules({ registrationThresholdYears: null }), long)).toEqual([]);
  });
});
