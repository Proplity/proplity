// The limits behind the renewal and reminder settings. No database code, so the admin screen and
// the settings route share them. The first (default) values match the schema defaults.
export const REMINDER_DAYS = { min: 1, max: 365, maxCount: 6, default: [90, 60, 30] } as const;
export const UNSIGNED_REMINDER_DAYS = { min: 0, max: 30, default: 3 } as const;
export const AUTO_RENEWAL_DAYS = { min: 7, max: 365, default: 60 } as const;

/** Reminder days as the admin types them ("90, 60, 30"), cleaned: whole days, largest first, no repeats. */
export function parseReminderDays(text: string): number[] {
  const days = text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  return [...new Set(days)].sort((a, b) => b - a);
}
