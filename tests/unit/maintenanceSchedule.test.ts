import { describe, it, expect } from 'vitest';
import { anchorDay, nextDueDate } from '@/lib/maintenanceSchedule';

const d = (s: string) => new Date(`${s}T09:30:00.000Z`);
const day = (x: Date) => x.toISOString().slice(0, 10);

describe('recurring maintenance dates', () => {
  it('weekly adds seven days', () => {
    expect(day(nextDueDate(d('2026-12-28'), 'WEEKLY', null))).toBe('2027-01-04');
  });

  it('a monthly schedule from the 31st lands on the end of short months and comes back', () => {
    let due = d('2027-01-31');
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      due = nextDueDate(due, 'MONTHLY', 31);
      seen.push(day(due));
    }
    expect(seen).toEqual(['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30']);
  });

  it('uses 29 February in a leap year', () => {
    expect(day(nextDueDate(d('2028-01-31'), 'MONTHLY', 31))).toBe('2028-02-29');
  });

  it('quarterly, semi-annual and annual cycles keep their day and cross the year end', () => {
    expect(day(nextDueDate(d('2026-11-30'), 'QUARTERLY', 30))).toBe('2027-02-28');
    expect(day(nextDueDate(d('2026-08-31'), 'SEMI_ANNUAL', 31))).toBe('2027-02-28');
    expect(day(nextDueDate(d('2028-02-29'), 'ANNUAL', 29))).toBe('2029-02-28');
    expect(day(nextDueDate(d('2031-02-28'), 'ANNUAL', 29))).toBe('2032-02-29');
  });

  it('keeps the time of day', () => {
    expect(nextDueDate(d('2027-01-15'), 'MONTHLY', 15).toISOString()).toBe(
      '2027-02-15T09:30:00.000Z',
    );
  });

  it('falls back to the date it is given when no day was stored (old rows)', () => {
    expect(day(nextDueDate(d('2027-03-15'), 'MONTHLY', null))).toBe('2027-04-15');
  });

  it('the anchor is the first due date, and weekly has none', () => {
    expect(anchorDay(d('2027-01-31'), 'MONTHLY')).toBe(31);
    expect(anchorDay(d('2027-01-31'), 'WEEKLY')).toBeNull();
  });
});
