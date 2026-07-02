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
