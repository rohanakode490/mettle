import { exportBackupData, importBackupData } from '@/db/queries';
import { SQLiteDatabase } from 'expo-sqlite';
import { Routine, DayPlan, SetLog } from '@/types/database';

// Mock Reanimated & Worklets for test environment safety
jest.mock('react-native-reanimated', () => ({}));
jest.mock('react-native-worklets', () => ({}));

// Simulates the expo-sqlite SQLiteDatabase client behavior in memory for integration testing
class MockSQLiteDatabase {
  routines = new Map<string, any>();
  day_plans = new Map<string, any>();
  set_logs = new Map<string, any>();

  async runAsync(sql: string, params: any[] = []): Promise<any> {
    if (sql.includes('INSERT INTO routines') || sql.includes('INSERT OR REPLACE INTO routines')) {
      const [id, name, created_at] = params;
      this.routines.set(id, { id, name, created_at });
    } else if (sql.includes('INSERT INTO day_plans') || sql.includes('INSERT OR REPLACE INTO day_plans')) {
      const [id, routine_id, day_index, is_rest, exercise_plans] = params;
      this.day_plans.set(id, { id, routine_id, day_index, is_rest, exercise_plans });
    } else if (sql.includes('INSERT OR REPLACE INTO set_logs')) {
      const [id, exercise_name, weight_kg, reps, timestamp, routine_id, day_index, set_type, superset_id] = params;
      this.set_logs.set(id, {
        id,
        exercise_name,
        weight_kg,
        reps,
        timestamp,
        routine_id,
        day_index,
        set_type,
        superset_id
      });
    }
    return { lastInsertRowId: 1, changes: 1 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (sql.includes('FROM routines')) {
      const rows = Array.from(this.routines.values()).sort((a, b) => b.created_at - a.created_at);
      return rows as unknown as T[];
    } else if (sql.includes('FROM day_plans')) {
      let rows = Array.from(this.day_plans.values());
      if (params.length > 0) {
        const routineId = params[0];
        rows = rows.filter(dp => dp.routine_id === routineId);
      }
      rows.sort((a, b) => a.day_index - b.day_index);
      return rows as unknown as T[];
    } else if (sql.includes('FROM set_logs')) {
      const rows = Array.from(this.set_logs.values()).sort((a, b) => b.timestamp - a.timestamp);
      return rows as unknown as T[];
    }
    return [] as T[];
  }

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    await callback();
  }
}

describe('Database Export & Import Round-trip Integration Tests', () => {
  let sourceDb: MockSQLiteDatabase;
  let targetDb: MockSQLiteDatabase;

  beforeEach(() => {
    sourceDb = new MockSQLiteDatabase();
    targetDb = new MockSQLiteDatabase();
  });

  test('Should perform a complete round-trip export and import of user data', async () => {
    // 1. Seed source mock database with valid test data
    const routineId = 'routine-test-123';
    
    // Insert a routine
    await sourceDb.runAsync(
      'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
      [routineId, 'Push Day Workout', 1700000000]
    );

    // Insert 2 day plans (one workout, one rest)
    const exercisePlans = [
      { id: 'ex-plan-1', name: 'Barbell Bench Press' },
      { id: 'ex-plan-2', name: 'Overhead Press' }
    ];
    await sourceDb.runAsync(
      'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
      ['dp-1', routineId, 0, 0, JSON.stringify(exercisePlans)]
    );
    await sourceDb.runAsync(
      'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
      ['dp-2', routineId, 1, 1, '[]']
    );

    // Insert 2 set logs (weight_kg stored as integer * 100)
    await sourceDb.runAsync(
      `INSERT OR REPLACE INTO set_logs (
        id, exercise_name, weight_kg, reps, timestamp, routine_id, day_index, set_type, superset_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['log-1', 'Barbell Bench Press', 8000, 8, 1700000100, routineId, 0, 'work', null]
    );
    await sourceDb.runAsync(
      `INSERT OR REPLACE INTO set_logs (
        id, exercise_name, weight_kg, reps, timestamp, routine_id, day_index, set_type, superset_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['log-2', 'Overhead Press', 5000, 10, 1700000200, routineId, 0, 'warmup', 'superset-abc']
    );

    // 2. Export database backup JSON
    // We cast sourceDb as unknown then SQLiteDatabase for type compatibility
    const backupJson = await exportBackupData(sourceDb as unknown as SQLiteDatabase);
    
    // Parse to verify validity
    const backup = JSON.parse(backupJson);
    expect(backup.version).toBe(1);
    expect(backup.routines).toHaveLength(1);
    expect(backup.dayPlans).toHaveLength(2);
    expect(backup.setLogs).toHaveLength(2);

    // Verify object formats in the export JSON (divided by 100 for display/export)
    expect(backup.routines[0]).toEqual({
      id: 'routine-test-123',
      name: 'Push Day Workout',
      createdAt: 1700000000
    });
    expect(backup.dayPlans[0].exercisePlans).toHaveLength(2);
    expect(backup.dayPlans[0].isRest).toBe(false);
    expect(backup.setLogs[0].weightKg).toBe(50.0);
    expect(backup.setLogs[0].setType).toBe('warmup');
    expect(backup.setLogs[0].supersetId).toBe('superset-abc');
    expect(backup.setLogs[1].weightKg).toBe(80.0);
    expect(backup.setLogs[1].setType).toBe('work');
    expect(backup.setLogs[1].supersetId).toBe(undefined);

    // 3. Import data into the target database
    const importResult = await importBackupData(targetDb as unknown as SQLiteDatabase, backupJson);
    
    // Verify count of imported items reported
    expect(importResult.routinesImported).toBe(1);
    expect(importResult.dayPlansImported).toBe(2);
    expect(importResult.setLogsImported).toBe(2);

    // 4. Verify that target database contents are identical to source database
    expect(targetDb.routines.size).toBe(1);
    expect(targetDb.day_plans.size).toBe(2);
    expect(targetDb.set_logs.size).toBe(2);

    const routineInTarget = targetDb.routines.get(routineId);
    expect(routineInTarget.name).toBe('Push Day Workout');
    expect(routineInTarget.created_at).toBe(1700000000);

    const dpInTarget = targetDb.day_plans.get('dp-1');
    expect(JSON.parse(dpInTarget.exercise_plans)).toEqual(exercisePlans);
    expect(dpInTarget.is_rest).toBe(0);

    const logInTarget = targetDb.set_logs.get('log-1');
    expect(logInTarget.exercise_name).toBe('Barbell Bench Press');
    expect(logInTarget.weight_kg).toBe(8000);
    expect(logInTarget.set_type).toBe('work');

    const log2InTarget = targetDb.set_logs.get('log-2');
    expect(log2InTarget.exercise_name).toBe('Overhead Press');
    expect(log2InTarget.superset_id).toBe('superset-abc');
  });

  test('Should reject invalid backup formats during import', async () => {
    const invalidJson = '{"version":1,"routines":[]}'; // Missing dayPlans and setLogs arrays
    
    await expect(
      importBackupData(targetDb as unknown as SQLiteDatabase, invalidJson)
    ).rejects.toThrow('Missing "dayPlans" array in the backup.');
  });
});
