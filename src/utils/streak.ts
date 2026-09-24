import { SetLog } from '@/types/database';

export interface StreakInfo {
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  targetWorkoutsPerWeek: number;
  workoutsThisWeek: number;
  isCurrentWeekMet: boolean;
  isCurrentWeekViable: boolean;
  totalWorkoutsAllTime: number;
}

/**
 * Formats a Date object to YYYY-MM-DD using local time.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the Monday of the week for a given date (00:00:00 local time).
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculates weekly workout streak, handling rest days gracefully.
 * A streak increments for every consecutive week where the user completes
 * at least their target number of workout days. Scheduled rest days
 * do not break the streak.
 */
export function calculateWeeklyStreak(
  logs: SetLog[],
  targetWorkoutsPerWeek = 3,
  referenceDate = new Date()
): StreakInfo {
  if (!logs || logs.length === 0) {
    return {
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      targetWorkoutsPerWeek,
      workoutsThisWeek: 0,
      isCurrentWeekMet: false,
      isCurrentWeekViable: true,
      totalWorkoutsAllTime: 0,
    };
  }

  // 1. Group logs into distinct workout dates (YYYY-MM-DD)
  const workoutDates = new Set<string>();
  logs.forEach(log => {
    workoutDates.add(formatDateKey(new Date(log.timestamp)));
  });

  // 2. Count distinct workout days per week (identified by Monday's YYYY-MM-DD)
  const workoutsPerWeek: Record<string, number> = {};
  for (const dateStr of workoutDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const mondayKey = formatDateKey(getMondayOfWeek(date));
    workoutsPerWeek[mondayKey] = (workoutsPerWeek[mondayKey] || 0) + 1;
  }

  // 3. Current week status
  const currentMonday = getMondayOfWeek(referenceDate);
  const currentMondayKey = formatDateKey(currentMonday);
  const workoutsThisWeek = workoutsPerWeek[currentMondayKey] || 0;
  const isCurrentWeekMet = workoutsThisWeek >= targetWorkoutsPerWeek;

  const currentDayIndex = referenceDate.getDay() === 0 ? 6 : referenceDate.getDay() - 1; // 0=Mon, 6=Sun
  const daysRemainingInWeek = 6 - currentDayIndex;
  const isCurrentWeekViable = (workoutsThisWeek + daysRemainingInWeek) >= targetWorkoutsPerWeek;

  // 4. Trace past consecutive completed weeks
  let pastStreak = 0;
  const cursor = new Date(currentMonday);
  cursor.setDate(cursor.getDate() - 7); // Step to previous week

  while (true) {
    const key = formatDateKey(cursor);
    const count = workoutsPerWeek[key] || 0;
    if (count >= targetWorkoutsPerWeek) {
      pastStreak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  let currentStreakWeeks = 0;
  if (isCurrentWeekMet) {
    currentStreakWeeks = pastStreak + 1;
  } else if (isCurrentWeekViable) {
    currentStreakWeeks = pastStreak;
  } else {
    currentStreakWeeks = 0;
  }

  // 5. Calculate all-time longest streak
  const sortedMondays = Object.keys(workoutsPerWeek).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let prevMondayTime: number | null = null;
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  for (const mondayStr of sortedMondays) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const mondayDate = new Date(y, m - 1, d);
    const count = workoutsPerWeek[mondayStr] || 0;

    if (count >= targetWorkoutsPerWeek) {
      if (prevMondayTime !== null && (mondayDate.getTime() - prevMondayTime) <= ONE_WEEK_MS + 86400000) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
      prevMondayTime = mondayDate.getTime();
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 0;
      prevMondayTime = null;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreakWeeks);

  return {
    currentStreakWeeks,
    longestStreakWeeks: longestStreak,
    targetWorkoutsPerWeek,
    workoutsThisWeek,
    isCurrentWeekMet,
    isCurrentWeekViable,
    totalWorkoutsAllTime: workoutDates.size,
  };
}
