import type { ScheduleFrequency } from '@prisma/client';

// Dates for recurring maintenance schedules. No imports besides the enum type, so the schedule
// screen and the daily worker use the same rule.

const MONTHS: Record<Exclude<ScheduleFrequency, 'WEEKLY'>, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** The day of the month a schedule is meant to fall on: that of its first due date (none for weekly). */
export function anchorDay(firstDue: Date, frequency: ScheduleFrequency): number | null {
  return frequency === 'WEEKLY' ? null : firstDue.getUTCDate();
}

/**
 * The due date after `from`. Weekly adds seven days. Longer cycles add whole months and land on the
 * schedule's own day of the month, or on the last day of a month too short for it, so a schedule
 * that starts on the 31st goes 31 Jan, 28 Feb, 31 Mar, 30 Apr and does not drift to the 28th.
 * Working only from the previous date (plain "add a month") loses the 31st for good.
 */
export function nextDueDate(
  from: Date,
  frequency: ScheduleFrequency,
  dayOfMonth: number | null,
): Date {
  const next = new Date(from);
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const months = from.getUTCMonth() + MONTHS[frequency];
  const year = from.getUTCFullYear() + Math.floor(months / 12);
  const month = months % 12;
  const day = Math.min(dayOfMonth ?? from.getUTCDate(), daysInMonth(year, month));
  next.setUTCFullYear(year, month, day);
  return next;
}
