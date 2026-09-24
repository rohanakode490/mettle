import {
  calculateWeeklyStreak,
  formatDateKey,
  getMondayOfWeek,
} from '@/utils/streak';
import { getMonthCalendarGrid, formatMonthYear } from '@/utils/calendar';
import { SetLog } from '@/types/database';

describe('Streak Calculation & Rest Day Handling Tests', () => {
  const createMockLog = (dateString: string, id: string): SetLog => {
    const timestamp = new Date(dateString + 'T12:00:00').getTime();
    return {
      id,
      exerciseName: 'Bench Press',
      weightKg: 80,
      reps: 10,
      timestamp,
      routineId: 'r-1',
      dayIndex: 0,
      setType: 'work',
    };
  };

  test('formatDateKey formats dates as YYYY-MM-DD correctly', () => {
    const d = new Date(2026, 8, 24); // Sept 24, 2026
    expect(formatDateKey(d)).toBe('2026-09-24');
  });

  test('getMondayOfWeek correctly finds Monday for any day of the week', () => {
    // Thursday Sep 24, 2026 -> Monday is Sep 21, 2026
    const thursday = new Date(2026, 8, 24);
    const monday = getMondayOfWeek(thursday);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(8);
    expect(monday.getDate()).toBe(21);
    expect(monday.getDay()).toBe(1); // 1 = Monday
  });

  test('Returns 0 streak when no logs exist', () => {
    const streak = calculateWeeklyStreak([], 3);
    expect(streak.currentStreakWeeks).toBe(0);
    expect(streak.longestStreakWeeks).toBe(0);
    expect(streak.workoutsThisWeek).toBe(0);
    expect(streak.isCurrentWeekMet).toBe(false);
  });

  test('Handles rest days: User taking 4 rest days in a 3-day split retains and extends streak', () => {
    // Reference date: Sunday Sep 27, 2026 (end of week starting Monday Sep 21)
    const refDate = new Date(2026, 8, 27);

    // Week 1 (Sep 14 - Sep 20): User worked out Mon, Wed, Fri (took Tue, Thu, Sat, Sun as rest)
    // Week 2 (Sep 21 - Sep 27): User worked out Mon, Wed, Sat (took Tue, Thu, Fri, Sun as rest)
    const logs: SetLog[] = [
      // Week 1
      createMockLog('2026-09-14', 'l-1'),
      createMockLog('2026-09-16', 'l-2'),
      createMockLog('2026-09-18', 'l-3'),
      // Week 2
      createMockLog('2026-09-21', 'l-4'),
      createMockLog('2026-09-23', 'l-5'),
      createMockLog('2026-09-26', 'l-6'),
    ];

    const streak = calculateWeeklyStreak(logs, 3, refDate);
    // Both weeks achieved the 3-day workout target despite taking 4 rest days each week!
    expect(streak.currentStreakWeeks).toBe(2);
    expect(streak.longestStreakWeeks).toBe(2);
    expect(streak.workoutsThisWeek).toBe(3);
    expect(streak.isCurrentWeekMet).toBe(true);
  });

  test('Current week in progress: preserves streak while still viable', () => {
    // Reference date: Wednesday Sep 23, 2026
    const refDate = new Date(2026, 8, 23);

    // Week 1 (Sep 14 - Sep 20): Target 3 met
    // Week 2 (Sep 21 - Sep 27): 1 workout completed so far (on Mon), 4 days left (Thu, Fri, Sat, Sun)
    const logs: SetLog[] = [
      // Week 1
      createMockLog('2026-09-14', 'l-1'),
      createMockLog('2026-09-16', 'l-2'),
      createMockLog('2026-09-18', 'l-3'),
      // Week 2
      createMockLog('2026-09-21', 'l-4'),
    ];

    const streak = calculateWeeklyStreak(logs, 3, refDate);
    // 1 workout completed this week, 4 days remaining -> total possible is 5 >= 3, so viable!
    expect(streak.isCurrentWeekViable).toBe(true);
    expect(streak.isCurrentWeekMet).toBe(false);
    expect(streak.currentStreakWeeks).toBe(1); // Carries over past completed week
    expect(streak.workoutsThisWeek).toBe(1);
  });

  test('Streak breaks if previous week missed the workout target', () => {
    // Reference date: Sunday Sep 27, 2026
    const refDate = new Date(2026, 8, 27);

    // Week 1 (Sep 7 - Sep 13): 3 workouts (target met)
    // Week 2 (Sep 14 - Sep 20): 1 workout (MISSED target of 3)
    // Week 3 (Sep 21 - Sep 27): 3 workouts (target met)
    const logs: SetLog[] = [
      // Week 1
      createMockLog('2026-09-07', 'l-1'),
      createMockLog('2026-09-09', 'l-2'),
      createMockLog('2026-09-11', 'l-3'),
      // Week 2 (only 1 workout)
      createMockLog('2026-09-15', 'l-4'),
      // Week 3
      createMockLog('2026-09-21', 'l-5'),
      createMockLog('2026-09-23', 'l-6'),
      createMockLog('2026-09-25', 'l-7'),
    ];

    const streak = calculateWeeklyStreak(logs, 3, refDate);
    // Week 2 missed, so current streak restarted at Week 3 = 1 week
    expect(streak.currentStreakWeeks).toBe(1);
    // Longest streak was 1
    expect(streak.longestStreakWeeks).toBe(1);
  });
});

describe('Calendar Grid Generation Tests', () => {
  test('Generates month calendar grid starting on Monday with 35 or 42 cells', () => {
    // September 2026: starts on Tuesday, Sep 1 (1 padding day Monday Aug 31)
    // 30 days in September. 1 + 30 = 31 days. 4 trailing padding days -> 35 cells.
    const grid = getMonthCalendarGrid(2026, 8); // month 8 is September (0-indexed)

    expect(grid.length).toBe(35);
    expect(grid.length % 7).toBe(0);

    // First cell is Monday Aug 31
    expect(grid[0].dateKey).toBe('2026-08-31');
    expect(grid[0].isCurrentMonth).toBe(false);
    expect(grid[0].dayOfWeek).toBe(0); // Monday

    // Second cell is Tuesday Sep 1
    expect(grid[1].dateKey).toBe('2026-09-01');
    expect(grid[1].isCurrentMonth).toBe(true);
    expect(grid[1].dayNumber).toBe(1);
    expect(grid[1].dayOfWeek).toBe(1); // Tuesday

    // Last day of September is Wednesday Sep 30 (grid[30])
    expect(grid[30].dateKey).toBe('2026-09-30');
    expect(grid[30].isCurrentMonth).toBe(true);
    expect(grid[30].dayNumber).toBe(30);

    // Trailing cells are in October
    expect(grid[31].dateKey).toBe('2026-10-01');
    expect(grid[31].isCurrentMonth).toBe(false);
  });

  test('formatMonthYear formats month and year correctly', () => {
    const d = new Date(2026, 8, 1);
    const formatted = formatMonthYear(d);
    expect(formatted).toContain('September');
    expect(formatted).toContain('2026');
  });
});
