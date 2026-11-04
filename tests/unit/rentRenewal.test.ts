import { describe, expect, it } from 'vitest';
import { addMonthsUtc, defaultRenewalTerms, renewalEndDate } from '../../lib/rentRenewal';
import { parseReminderDays } from '../../lib/renewalOptions';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const day = (date: Date) => date.toISOString().slice(0, 10);

describe('adding months to a date', () => {
  it('keeps the day of the month', () => {
    expect(day(addMonthsUtc(d('2026-03-15'), 12))).toBe('2027-03-15');
  });

  it('falls back to the last day of a shorter month', () => {
    expect(day(addMonthsUtc(d('2026-01-31'), 1))).toBe('2026-02-28');
    expect(day(addMonthsUtc(d('2028-01-31'), 1))).toBe('2028-02-29');
  });

  it('crosses a year end', () => {
    expect(day(addMonthsUtc(d('2026-11-10'), 3))).toBe('2027-02-10');
  });
});

describe('the end of a renewed tenancy', () => {
  it('is the day before the same date a term later', () => {
    expect(day(renewalEndDate(d('2027-01-01'), 12))).toBe('2027-12-31');
    expect(day(renewalEndDate(d('2027-03-15'), 6))).toBe('2027-09-14');
  });
});

describe('the terms a renewal starts with', () => {
  const rent = {
    startDate: d('2026-01-01'),
    endDate: d('2026-12-31'),
    rentAmount: 2_000_000,
    deposit: 200_000,
    paymentFrequency: 'ANNUAL' as const,
  };

  it('start the day after and run for the same length at the same rent', () => {
    const t = defaultRenewalTerms(rent);
    expect(day(t.startDate)).toBe('2027-01-01');
    expect(day(t.endDate)).toBe('2027-12-31');
    expect(t).toMatchObject({
      rentAmount: 2_000_000,
      deposit: 200_000,
      paymentFrequency: 'ANNUAL',
    });
  });

  it('apply an increase to the rent, rounded to a whole naira, and a different length', () => {
    const t = defaultRenewalTerms(rent, { increasePercent: 7.5, termMonths: 24 });
    expect(t.rentAmount).toBe(2_150_000);
    expect(day(t.endDate)).toBe('2028-12-31');
    expect(
      defaultRenewalTerms({ ...rent, rentAmount: 1_000_001 }, { increasePercent: 1 }).rentAmount,
    ).toBe(1_010_001);
  });
});

describe('reminder days as the admin types them', () => {
  it('are whole days, largest first, each once', () => {
    expect(parseReminderDays('30, 90 60;60  45')).toEqual([90, 60, 45, 30]);
  });

  it('is empty for nothing', () => {
    expect(parseReminderDays('')).toEqual([]);
    expect(parseReminderDays(' , ')).toEqual([]);
  });
});
