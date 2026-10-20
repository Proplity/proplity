/**
 * Property viewing times. A tenant picks a date and a start time; the server
 * enforces the same window so the form and the API cannot disagree.
 *
 * Viewings run Monday to Saturday, 9:00 AM to 5:00 PM (last start), in
 * Lagos time (WAT, UTC+1, no daylight saving). The form builds the timestamp
 * in that zone rather than the browser's, so a tenant booking from another
 * country still lands inside the property team's working day.
 *
 * A property can be viewed by one person at a time: only one live booking per property and start
 * time (ISS-104). A request waits for the property team, so `REQUESTED` and `CONFIRMED` both hold
 * the time; a declined or cancelled booking gives it back.
 *
 * History: the form used to list a fixed set of days, generated from today,
 * because a hard-coded list silently expired (ISS-042).
 */
export const VIEWING_TIME_ZONE = 'Africa/Lagos';
const VIEWING_UTC_OFFSET = '+01:00';
const VIEWING_FIRST_MINUTE = 9 * 60;
const VIEWING_LAST_MINUTE = 17 * 60;
const VIEWING_STEP_MINUTES = 30;
/** How far ahead a viewing can be booked. */
export const VIEWING_MAX_DAYS_AHEAD = 60;

export type ViewingTime = { value: string; label: string };

/** The statuses that hold a start time; the others (cancelled, done, no-show) do not. */
export const VIEWING_HOLDING_STATUSES = ['REQUESTED', 'CONFIRMED'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The start times a tenant can choose from, every 30 minutes: `09:00` ... `17:00`. */
export const VIEWING_TIMES: ViewingTime[] = (() => {
  const times: ViewingTime[] = [];
  for (let m = VIEWING_FIRST_MINUTE; m <= VIEWING_LAST_MINUTE; m += VIEWING_STEP_MINUTES) {
    const h = Math.floor(m / 60);
    const label = `${h % 12 === 0 ? 12 : h % 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`;
    times.push({ value: `${pad(h)}:${pad(m % 60)}`, label });
  }
  return times;
})();

/** `YYYY-MM-DD` in the viewer's local calendar. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a `YYYY-MM-DD` key as a local date (not UTC, which can land on the day before). */
export function fromLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Earliest bookable day (tomorrow) and the latest, as `YYYY-MM-DD` keys for the date input. */
export function viewingDateRange(from: Date = new Date()): { min: string; max: string } {
  const min = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  const max = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + VIEWING_MAX_DAYS_AHEAD,
  );
  return { min: toLocalDateKey(min), max: toLocalDateKey(max) };
}

/** True when the `YYYY-MM-DD` key is a Sunday, when no viewings are held. */
export function isSunday(dateKey: string): boolean {
  // Read the key as a calendar date: the weekday does not depend on a time zone.
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

/** The Lagos calendar day (`YYYY-MM-DD`) an instant falls on. */
export function viewingDateKey(when: Date): string {
  return new Date(when.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The Lagos wall-clock start time (`HH:MM`) of an instant, as in `VIEWING_TIMES`. */
export function viewingTimeKey(when: Date): string {
  return new Date(when.getTime() + 60 * 60 * 1000).toISOString().slice(11, 16);
}

/** The instants a Lagos calendar day starts at and ends before. */
export function viewingDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = viewingInstant(dateKey, '00:00');
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** The instant for a date key and a `HH:MM` start time in Lagos time. */
export function viewingInstant(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00${VIEWING_UTC_OFFSET}`);
}

/**
 * Why a timestamp is not a bookable viewing time, or null when it is.
 * Used by the API; the form prevents these choices up front.
 */
export function viewingTimeProblem(when: Date): string | null {
  // Shift to Lagos wall-clock time, then read it with the UTC getters.
  const lagos = new Date(when.getTime() + 60 * 60 * 1000);
  if (lagos.getUTCDay() === 0) return 'Viewings are not held on Sundays';
  const minute = lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
  if (minute < VIEWING_FIRST_MINUTE || minute > VIEWING_LAST_MINUTE) {
    return 'Viewings run between 9:00 AM and 5:00 PM (Lagos time)';
  }
  // Only the form's half-hour starts, so "one booking per start time" cannot be dodged by asking
  // for 10:00:30 (ISS-104).
  if (
    minute % VIEWING_STEP_MINUTES !== 0 ||
    lagos.getUTCSeconds() !== 0 ||
    lagos.getUTCMilliseconds() !== 0
  ) {
    return 'Viewings start on the hour or the half hour';
  }
  return null;
}

/** A viewing time as people read it, always in Lagos time so everyone sees the same hour. */
export function formatViewingTime(
  when: string | Date,
  style: 'medium' | 'full' = 'medium',
): string {
  return new Date(when).toLocaleString('en-US', {
    dateStyle: style,
    timeStyle: 'short',
    timeZone: VIEWING_TIME_ZONE,
  });
}
