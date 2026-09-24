import { formatDateKey } from './streak';

export interface CalendarGridDay {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0 (Mon) to 6 (Sun)
}

/**
 * Generates an array of days representing a monthly calendar grid (Monday-first).
 * Includes padding days from adjacent months so every week row has 7 cells.
 */
export function getMonthCalendarGrid(year: number, month: number): CalendarGridDay[] {
  const todayKey = formatDateKey(new Date());
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Mon, ..., 6 = Sun)
  const firstDayJs = firstDayOfMonth.getDay();
  const leadingPadding = firstDayJs === 0 ? 6 : firstDayJs - 1;

  const days: CalendarGridDay[] = [];

  // 1. Leading padding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = leadingPadding - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    const dateKey = formatDateKey(d);
    days.push({
      date: d,
      dateKey,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      dayOfWeek: d.getDay() === 0 ? 6 : d.getDay() - 1,
    });
  }

  // 2. Days of the current month
  const totalDays = lastDayOfMonth.getDate();
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    const dateKey = formatDateKey(date);
    days.push({
      date,
      dateKey,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      dayOfWeek: date.getDay() === 0 ? 6 : date.getDay() - 1,
    });
  }

  // 3. Trailing padding days to fill the final week row (multiples of 7)
  const trailingNeeded = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= trailingNeeded; d++) {
    const date = new Date(year, month + 1, d);
    const dateKey = formatDateKey(date);
    days.push({
      date,
      dateKey,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      dayOfWeek: date.getDay() === 0 ? 6 : date.getDay() - 1,
    });
  }

  return days;
}

/**
 * Returns formatted month and year string, e.g. "September 2026"
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
