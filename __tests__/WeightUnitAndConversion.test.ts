import {
  weightToStored,
  storedToWeight,
  formatStoredWeight,
  formatWeight,
  convertWeight,
  KG_TO_LB,
  LB_TO_KG,
} from '@/utils/weight';
import { KNOWN_EXERCISES } from '@/constants/exercises';
import { convertAllSetLogsWeightUnit } from '@/db/queries';
import { SQLiteDatabase } from 'expo-sqlite';

describe('Weight Utility, Precision Storage, and Conversion Tests', () => {
  describe('Integer Weight Storage (Multiplied by 100, No Float/Double)', () => {
    test('Converts standard weights to integer (*100)', () => {
      expect(weightToStored(60)).toBe(6000);
      expect(weightToStored(100)).toBe(10000);
      expect(weightToStored(0)).toBe(0);
    });

    test('Converts decimal weights to integer (*100) correctly', () => {
      expect(weightToStored(60.5)).toBe(6050);
      expect(weightToStored(22.25)).toBe(2225);
      expect(weightToStored(135.75)).toBe(13575);
      expect(weightToStored(0.05)).toBe(5);
    });

    test('Guarantees stored values are always integers', () => {
      const stored = weightToStored(67.89);
      expect(Number.isInteger(stored)).toBe(true);
      expect(stored).toBe(6789);
    });

    test('Handles invalid numbers safely', () => {
      expect(weightToStored(NaN)).toBe(0);
      expect(weightToStored(Infinity)).toBe(0);
    });
  });

  describe('Stored Weight to Display Number (Divided by 100)', () => {
    test('Divides integer stored weight by 100', () => {
      expect(storedToWeight(6000)).toBe(60);
      expect(storedToWeight(6050)).toBe(60.5);
      expect(storedToWeight(2225)).toBe(22.25);
      expect(storedToWeight(5)).toBe(0.05);
      expect(storedToWeight(0)).toBe(0);
    });
  });

  describe('String Formatting via Dot Placement without Float Inaccuracies', () => {
    test('Formats integers without decimals', () => {
      expect(formatStoredWeight(6000)).toBe('60');
      expect(formatStoredWeight(10000)).toBe('100');
      expect(formatStoredWeight(0)).toBe('0');
    });

    test('Formats decimal weights by placing "." correctly', () => {
      expect(formatStoredWeight(6050)).toBe('60.5');
      expect(formatStoredWeight(6025)).toBe('60.25');
      expect(formatStoredWeight(50)).toBe('0.5');
      expect(formatStoredWeight(5)).toBe('0.05');
    });

    test('formatWeight formats standard display values cleanly', () => {
      expect(formatWeight(60)).toBe('60');
      expect(formatWeight(60.5)).toBe('60.5');
      expect(formatWeight(135.25)).toBe('135.25');
      expect(formatWeight(0)).toBe('0');
    });
  });

  describe('Weight Unit Conversion (KG <-> LB)', () => {
    test('Converts KG to LB accurately', () => {
      // 100 kg is ~220.46 lb
      const lb = convertWeight(100, 'kg', 'lb');
      expect(lb).toBe(220.46);
    });

    test('Converts LB to KG accurately', () => {
      // 220.46 lb is ~100 kg
      const kg = convertWeight(220.46, 'lb', 'kg');
      expect(kg).toBe(100);
    });

    test('Returns identical value when from and to units match', () => {
      expect(convertWeight(100, 'kg', 'kg')).toBe(100);
      expect(convertWeight(225, 'lb', 'lb')).toBe(225);
    });

    test('Handles zero and edge cases', () => {
      expect(convertWeight(0, 'kg', 'lb')).toBe(0);
      expect(convertWeight(NaN, 'kg', 'lb')).toBeNaN();
    });
  });

  describe('Database convertAllSetLogsWeightUnit Query', () => {
    test('Executes SQL UPDATE with correct rounding factor for LB', async () => {
      const mockRunAsync = jest.fn().mockResolvedValue({ changes: 15 });
      const mockDb = { runAsync: mockRunAsync } as unknown as SQLiteDatabase;

      const changes = await convertAllSetLogsWeightUnit(mockDb, 'lb');
      expect(changes).toBe(15);
      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE set_logs SET weight_kg = ROUND(weight_kg * ?)',
        [KG_TO_LB]
      );
    });

    test('Executes SQL UPDATE with correct rounding factor for KG', async () => {
      const mockRunAsync = jest.fn().mockResolvedValue({ changes: 8 });
      const mockDb = { runAsync: mockRunAsync } as unknown as SQLiteDatabase;

      const changes = await convertAllSetLogsWeightUnit(mockDb, 'kg');
      expect(changes).toBe(8);
      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE set_logs SET weight_kg = ROUND(weight_kg * ?)',
        [LB_TO_KG]
      );
    });
  });

  describe('Known Exercises List Expansion', () => {
    test('KNOWN_EXERCISES contains a comprehensive list across muscle groups', () => {
      expect(KNOWN_EXERCISES.length).toBeGreaterThanOrEqual(50);

      // Verify key exercises across different muscle groups are present
      expect(KNOWN_EXERCISES).toContain('Barbell Bench Press');
      expect(KNOWN_EXERCISES).toContain('Incline Barbell Bench Press');
      expect(KNOWN_EXERCISES).toContain('Flat Dumbbell Press');
      expect(KNOWN_EXERCISES).toContain('Push-ups');

      expect(KNOWN_EXERCISES).toContain('Barbell Deadlift');
      expect(KNOWN_EXERCISES).toContain('Romanian Deadlift');
      expect(KNOWN_EXERCISES).toContain('Barbell Row');
      expect(KNOWN_EXERCISES).toContain('Pull-ups');
      expect(KNOWN_EXERCISES).toContain('Lat Pulldown');

      expect(KNOWN_EXERCISES).toContain('Barbell Squat');
      expect(KNOWN_EXERCISES).toContain('Front Squat');
      expect(KNOWN_EXERCISES).toContain('Leg Press');
      expect(KNOWN_EXERCISES).toContain('Hip Thrust');

      expect(KNOWN_EXERCISES).toContain('Overhead Press');
      expect(KNOWN_EXERCISES).toContain('Lateral Raises');
      expect(KNOWN_EXERCISES).toContain('Face Pull');

      expect(KNOWN_EXERCISES).toContain('Bicep Curl');
      expect(KNOWN_EXERCISES).toContain('Hammer Curl');
      expect(KNOWN_EXERCISES).toContain('Tricep Pushdown');
      expect(KNOWN_EXERCISES).toContain('Skull Crushers');

      expect(KNOWN_EXERCISES).toContain('Plank');
      expect(KNOWN_EXERCISES).toContain('Ab Wheel Rollout');
      expect(KNOWN_EXERCISES).toContain('Hanging Leg Raise');
    });

    test('No duplicate exercise names in KNOWN_EXERCISES', () => {
      const uniqueNames = new Set(KNOWN_EXERCISES);
      expect(uniqueNames.size).toBe(KNOWN_EXERCISES.length);
    });
  });
});
