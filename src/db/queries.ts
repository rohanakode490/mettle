import { SQLiteDatabase } from 'expo-sqlite';
import { Routine, DayPlan, SetLog } from '@/types/database';

// --- Routines ---
export async function getRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  const result = await db.getAllAsync<{ id: string; name: string; created_at: number }>(
    'SELECT * FROM routines ORDER BY created_at DESC'
  );
  return result.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

export async function insertRoutine(
  db: SQLiteDatabase,
  routine: Routine
): Promise<void> {
  await db.runAsync(
    'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
    [routine.id, routine.name, routine.createdAt]
  );
}

export async function createRoutine(
  db: SQLiteDatabase,
  name: string
): Promise<Routine> {
  const routineId = `routine-${Math.random().toString(36).substring(2, 11)}`;
  const now = Date.now();
  
  await db.runAsync(
    'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
    [routineId, name, now]
  );
  
  // Create 7 empty day plans (Monday = 0, Sunday = 6)
  for (let i = 0; i < 7; i++) {
    const dayPlanId = `dp-${routineId}-${i}`;
    await db.runAsync(
      'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
      [dayPlanId, routineId, i, 1, '[]']
    );
  }
  
  return {
    id: routineId,
    name,
    createdAt: now,
  };
}

export async function deleteRoutine(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM routines WHERE id = ?', [id]);
}

// --- Day Plans ---
export async function getDayPlans(
  db: SQLiteDatabase,
  routineId: string
): Promise<DayPlan[]> {
  const result = await db.getAllAsync<{
    id: string;
    routine_id: string;
    day_index: number;
    is_rest: number;
    exercise_plans: string;
  }>('SELECT * FROM day_plans WHERE routine_id = ? ORDER BY day_index ASC', [routineId]);

  return result.map(row => ({
    id: row.id,
    routineId: row.routine_id,
    dayIndex: row.day_index,
    isRest: row.is_rest === 1,
    exercisePlans: JSON.parse(row.exercise_plans),
  }));
}

export async function insertDayPlan(
  db: SQLiteDatabase,
  dayPlan: DayPlan
): Promise<void> {
  await db.runAsync(
    'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
    [
      dayPlan.id,
      dayPlan.routineId,
      dayPlan.dayIndex,
      dayPlan.isRest ? 1 : 0,
      JSON.stringify(dayPlan.exercisePlans),
    ]
  );
}

// --- Set Logs ---
export async function getSetLogs(
  db: SQLiteDatabase,
  routineId: string,
  dayIndex: number
): Promise<SetLog[]> {
  const result = await db.getAllAsync<{
    id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    timestamp: number;
    routine_id: string;
    day_index: number;
    set_type: string;
    superset_id: string | null;
  }>(
    'SELECT * FROM set_logs WHERE routine_id = ? AND day_index = ? ORDER BY timestamp ASC',
    [routineId, dayIndex]
  );

  return result.map(row => ({
    id: row.id,
    exerciseName: row.exercise_name,
    weightKg: row.weight_kg,
    reps: row.reps,
    timestamp: row.timestamp,
    routineId: row.routine_id,
    dayIndex: row.day_index,
    setType: row.set_type as 'work' | 'warmup' | 'dropset',
    supersetId: row.superset_id ?? undefined,
  }));
}

export async function getAllSetLogs(db: SQLiteDatabase): Promise<SetLog[]> {
  const result = await db.getAllAsync<{
    id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    timestamp: number;
    routine_id: string;
    day_index: number;
    set_type: string;
    superset_id: string | null;
  }>('SELECT * FROM set_logs ORDER BY timestamp DESC');

  return result.map(row => ({
    id: row.id,
    exerciseName: row.exercise_name,
    weightKg: row.weight_kg,
    reps: row.reps,
    timestamp: row.timestamp,
    routineId: row.routine_id,
    dayIndex: row.day_index,
    setType: row.set_type as 'work' | 'warmup' | 'dropset',
    supersetId: row.superset_id ?? undefined,
  }));
}

export async function insertSetLog(
  db: SQLiteDatabase,
  setLog: SetLog
): Promise<void> {
  await db.runAsync(
    `INSERT INTO set_logs (
      id, exercise_name, weight_kg, reps, timestamp, routine_id, day_index, set_type, superset_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      setLog.id,
      setLog.exerciseName,
      setLog.weightKg,
      setLog.reps,
      setLog.timestamp,
      setLog.routineId,
      setLog.dayIndex,
      setLog.setType,
      setLog.supersetId ?? null,
    ]
  );
}

export async function updateSetLog(
  db: SQLiteDatabase,
  id: string,
  weightKg: number,
  reps: number
): Promise<void> {
  await db.runAsync(
    'UPDATE set_logs SET weight_kg = ?, reps = ? WHERE id = ?',
    [weightKg, reps, id]
  );
}

export async function deleteSetLog(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM set_logs WHERE id = ?', [id]);
}

export async function getLastSetLogForExercise(
  db: SQLiteDatabase,
  exerciseName: string
): Promise<{ weightKg: number; reps: number } | null> {
  const result = await db.getFirstAsync<{ weight_kg: number; reps: number }>(
    'SELECT weight_kg, reps FROM set_logs WHERE exercise_name = ? ORDER BY timestamp DESC LIMIT 1',
    [exerciseName]
  );
  if (!result) return null;
  return {
    weightKg: result.weight_kg,
    reps: result.reps,
  };
}

// --- Backup & Restore ---

export async function getAllDayPlans(db: SQLiteDatabase): Promise<DayPlan[]> {
  const result = await db.getAllAsync<{
    id: string;
    routine_id: string;
    day_index: number;
    is_rest: number;
    exercise_plans: string;
  }>('SELECT * FROM day_plans');

  return result.map(row => ({
    id: row.id,
    routineId: row.routine_id,
    dayIndex: row.day_index,
    isRest: row.is_rest === 1,
    exercisePlans: JSON.parse(row.exercise_plans),
  }));
}

export async function exportBackupData(db: SQLiteDatabase): Promise<string> {
  const routines = await getRoutines(db);
  const dayPlans = await getAllDayPlans(db);
  const setLogs = await getAllSetLogs(db);

  const backup = {
    version: 1,
    exportedAt: Date.now(),
    routines,
    dayPlans,
    setLogs,
  };

  return JSON.stringify(backup, null, 2);
}

export async function importBackupData(
  db: SQLiteDatabase,
  backupJson: string
): Promise<{ routinesImported: number; dayPlansImported: number; setLogsImported: number }> {
  const backup = JSON.parse(backupJson);

  if (typeof backup !== 'object' || backup === null) {
    throw new Error('Invalid backup format: root must be an object');
  }
  if (!Array.isArray(backup.routines) || !Array.isArray(backup.dayPlans) || !Array.isArray(backup.setLogs)) {
    throw new Error('Invalid backup format: routines, dayPlans, and setLogs must be arrays');
  }

  let routinesImported = 0;
  let dayPlansImported = 0;
  let setLogsImported = 0;

  await db.withTransactionAsync(async () => {
    // Insert/Replace Routines
    for (const r of backup.routines) {
      if (!r.id || !r.name) continue;
      await db.runAsync(
        'INSERT OR REPLACE INTO routines (id, name, created_at) VALUES (?, ?, ?)',
        [r.id, r.name, r.createdAt || r.created_at || Date.now()]
      );
      routinesImported++;
    }

    // Insert/Replace Day Plans
    for (const dp of backup.dayPlans) {
      if (!dp.id || !dp.routineId) continue;
      await db.runAsync(
        'INSERT OR REPLACE INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
        [
          dp.id,
          dp.routineId,
          dp.dayIndex,
          dp.isRest ? 1 : 0,
          JSON.stringify(dp.exercisePlans || []),
        ]
      );
      dayPlansImported++;
    }

    // Insert/Replace Set Logs
    for (const sl of backup.setLogs) {
      if (!sl.id || !sl.exerciseName || !sl.routineId) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO set_logs (
          id, exercise_name, weight_kg, reps, timestamp, routine_id, day_index, set_type, superset_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sl.id,
          sl.exerciseName,
          sl.weightKg ?? sl.weight_kg,
          sl.reps,
          sl.timestamp,
          sl.routineId,
          sl.dayIndex,
          sl.setType || sl.set_type || 'work',
          sl.supersetId || sl.superset_id || null,
        ]
      );
      setLogsImported++;
    }
  });

  return { routinesImported, dayPlansImported, setLogsImported };
}
