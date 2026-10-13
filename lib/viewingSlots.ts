/**
 * Bookable viewing days, generated from today instead of a fixed list (a
 * hard-coded list silently expired and left every tenant with only past
 * dates, ISS-042). Viewings run Monday to Saturday, starting tomorrow.
 */
export const VIEWING_SLOTS = ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type ViewingDay = { date: string; day: string; slots: string[] };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` in the viewer's local calendar. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a `YYYY-MM-DD` key as a local date (not UTC, which can land on the day before). */
export function fromLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function upcomingViewingDays(from: Date = new Date(), count = 10): ViewingDay[] {
  const days: ViewingDay[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0) continue;
    days.push({
      date: toLocalDateKey(cursor),
      day: WEEKDAYS[cursor.getDay()],
      slots: VIEWING_SLOTS,
    });
  }
  return days;
}
