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

export function validateBackupData(backup: any): void {
  if (typeof backup !== 'object' || backup === null || Array.isArray(backup)) {
    throw new Error('Root of the backup file must be a JSON object.');
  }

  if (backup.version !== undefined && typeof backup.version !== 'number') {
    throw new Error('"version" must be a number.');
  }

  // Check routines array
  if (!('routines' in backup)) {
    throw new Error('Missing "routines" array in the backup.');
  }
  if (!Array.isArray(backup.routines)) {
    throw new Error('"routines" must be an array.');
  }
  backup.routines.forEach((r: any, idx: number) => {
    if (typeof r !== 'object' || r === null) {
      throw new Error(`Routine at index ${idx} must be an object.`);
    }
    if (!r.id || typeof r.id !== 'string') {
      throw new Error(`Routine at index ${idx} is missing a valid string "id".`);
    }
    if (!r.name || typeof r.name !== 'string') {
      throw new Error(`Routine "${r.id || idx}" is missing a valid string "name".`);
    }
  });

  // Check dayPlans array
  if (!('dayPlans' in backup)) {
    throw new Error('Missing "dayPlans" array in the backup.');
  }
  if (!Array.isArray(backup.dayPlans)) {
    throw new Error('"dayPlans" must be an array.');
  }
  backup.dayPlans.forEach((dp: any, idx: number) => {
    if (typeof dp !== 'object' || dp === null) {
      throw new Error(`Day plan at index ${idx} must be an object.`);
    }
    if (!dp.id || typeof dp.id !== 'string') {
      throw new Error(`Day plan at index ${idx} is missing a valid string "id".`);
    }
    const routineId = dp.routineId || dp.routine_id;
    if (!routineId || typeof routineId !== 'string') {
      throw new Error(`Day plan "${dp.id || idx}" is missing a valid string "routineId".`);
    }
    const dayIndex = dp.dayIndex ?? dp.day_index;
    if (typeof dayIndex !== 'number' || dayIndex < 0 || dayIndex > 6) {
      throw new Error(`Day plan "${dp.id || idx}" must have a "dayIndex" between 0 (Monday) and 6 (Sunday).`);
    }
    const isRest = dp.isRest ?? dp.is_rest;
    if (isRest !== undefined && typeof isRest !== 'boolean' && isRest !== 0 && isRest !== 1) {
      throw new Error(`Day plan "${dp.id || idx}" must have a boolean "isRest".`);
    }
    const exercisePlans = dp.exercisePlans || dp.exercise_plans;
    if (exercisePlans) {
      const parsedPlans = typeof exercisePlans === 'string' ? JSON.parse(exercisePlans) : exercisePlans;
      if (!Array.isArray(parsedPlans)) {
        throw new Error(`Day plan "${dp.id || idx}" has "exercisePlans" which is not an array.`);
      }
      parsedPlans.forEach((ep: any, epIdx: number) => {
        if (typeof ep !== 'object' || ep === null) {
          throw new Error(`Exercise plan at index ${epIdx} of Day plan "${dp.id || idx}" must be an object.`);
        }
        if (!ep.id || typeof ep.id !== 'string') {
          throw new Error(`Exercise plan at index ${epIdx} of Day plan "${dp.id || idx}" is missing a valid string "id".`);
        }
        if (!ep.name || typeof ep.name !== 'string') {
          throw new Error(`Exercise plan "${ep.id || epIdx}" of Day plan "${dp.id || idx}" is missing a valid string "name".`);
        }
      });
    }
  });

  // Check setLogs array
  if (!('setLogs' in backup)) {
    throw new Error('Missing "setLogs" array in the backup.');
  }
  if (!Array.isArray(backup.setLogs)) {
    throw new Error('"setLogs" must be an array.');
  }
  backup.setLogs.forEach((sl: any, idx: number) => {
    if (typeof sl !== 'object' || sl === null) {
      throw new Error(`Set log at index ${idx} must be an object.`);
    }
    if (!sl.id || typeof sl.id !== 'string') {
      throw new Error(`Set log at index ${idx} is missing a valid string "id".`);
    }
    const exerciseName = sl.exerciseName || sl.exercise_name;
    if (!exerciseName || typeof exerciseName !== 'string') {
      throw new Error(`Set log "${sl.id || idx}" is missing a valid string "exerciseName".`);
    }
    const routineId = sl.routineId || sl.routine_id;
    if (!routineId || typeof routineId !== 'string') {
      throw new Error(`Set log "${sl.id || idx}" is missing a valid string "routineId".`);
    }
    const weight = sl.weightKg ?? sl.weight_kg;
    if (typeof weight !== 'number' || isNaN(weight) || weight < 0) {
      throw new Error(`Set log "${sl.id || idx}" has an invalid "weightKg" (must be a non-negative number).`);
    }
    const reps = sl.reps;
    if (typeof reps !== 'number' || !Number.isInteger(reps) || reps <= 0) {
      throw new Error(`Set log "${sl.id || idx}" has invalid "reps" (must be a positive integer).`);
    }
    const timestamp = sl.timestamp;
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
      throw new Error(`Set log "${sl.id || idx}" has invalid "timestamp" (must be a valid unix timestamp).`);
    }
    const dayIndex = sl.dayIndex ?? sl.day_index;
    if (typeof dayIndex !== 'number' || dayIndex < 0 || dayIndex > 6) {
      throw new Error(`Set log "${sl.id || idx}" has invalid "dayIndex" (must be between 0 and 6).`);
    }
    const setType = sl.setType || sl.set_type;
    if (setType && typeof setType !== 'string') {
      throw new Error(`Set log "${sl.id || idx}" has invalid "setType" (must be string).`);
    }
  });
}

export async function importBackupData(
  db: SQLiteDatabase,
  backupJson: string
): Promise<{ routinesImported: number; dayPlansImported: number; setLogsImported: number }> {
  let backup;
  try {
    backup = JSON.parse(backupJson);
  } catch (err: any) {
    throw new Error('Invalid JSON syntax: ' + err.message);
  }

  validateBackupData(backup);

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
