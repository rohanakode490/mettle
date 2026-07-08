import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './client';
import { Routine, DayPlan, SetLog } from '@/types/database';
import {
  getRoutines,
  getDayPlans,
  getAllSetLogs,
  insertRoutine,
  insertDayPlan,
  insertSetLog,
} from '@/db/queries';

export interface SyncResult {
  success: boolean;
  message: string;
  pushedRoutines?: number;
  pushedDayPlans?: number;
  pushedSetLogs?: number;
  pulledRoutines?: number;
  pulledDayPlans?: number;
  pulledSetLogs?: number;
}

/**
 * SyncService handles bidirectional sync between local SQLite and remote Supabase database.
 * Offline-first: SQLite is the source of truth when offline.
 */
export const SyncService = {
  /**
   * Performs full synchronization (Push then Pull).
   */
  async sync(db: SQLiteDatabase): Promise<SyncResult> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return { success: false, message: 'User must be authenticated to sync.' };
      }

      const userId = user.id;

      // 1. Push local changes to Supabase
      const pushStats = await this.pushLocalData(db, userId);

      // 2. Pull remote changes from Supabase
      const pullStats = await this.pullRemoteData(db, userId);

      return {
        success: true,
        message: 'Sync completed successfully.',
        ...pushStats,
        ...pullStats,
      };
    } catch (error: any) {
      console.error('[SyncService] Sync failed:', error);
      return {
        success: false,
        message: error.message || 'An error occurred during sync.',
      };
    }
  },

  /**
   * Push all local data from SQLite to Supabase.
   */
  async pushLocalData(db: SQLiteDatabase, userId: string) {
    // A. Push Routines
    const localRoutines = await getRoutines(db);
    if (localRoutines.length > 0) {
      const supabaseRoutines = localRoutines.map(r => ({
        id: r.id,
        user_id: userId,
        name: r.name,
        created_at: r.createdAt,
      }));

      const { error } = await supabase
        .from('routines')
        .upsert(supabaseRoutines, { onConflict: 'id' });

      if (error) throw new Error(`Pushing routines failed: ${error.message}`);
    }

    // B. Push Day Plans
    // Fetch day plans for all local routines
    const allLocalDayPlans: DayPlan[] = [];
    for (const routine of localRoutines) {
      const plans = await getDayPlans(db, routine.id);
      allLocalDayPlans.push(...plans);
    }

    if (allLocalDayPlans.length > 0) {
      const supabaseDayPlans = allLocalDayPlans.map(dp => ({
        id: dp.id,
        user_id: userId,
        routine_id: dp.routineId,
        day_index: dp.dayIndex,
        is_rest: dp.isRest ? 1 : 0,
        exercise_plans: JSON.stringify(dp.exercisePlans),
      }));

      const { error } = await supabase
        .from('day_plans')
        .upsert(supabaseDayPlans, { onConflict: 'id' });

      if (error) throw new Error(`Pushing day plans failed: ${error.message}`);
    }

    // C. Push Set Logs
    const localSetLogs = await getAllSetLogs(db);
    if (localSetLogs.length > 0) {
      const supabaseSetLogs = localSetLogs.map(log => ({
        id: log.id,
        user_id: userId,
        exercise_name: log.exerciseName,
        weight_kg: log.weightKg,
        reps: log.reps,
        timestamp: log.timestamp,
        routine_id: log.routineId,
        day_index: log.dayIndex,
        set_type: log.setType,
        superset_id: log.supersetId || null,
      }));

      const { error } = await supabase
        .from('set_logs')
        .upsert(supabaseSetLogs, { onConflict: 'id' });

      if (error) throw new Error(`Pushing set logs failed: ${error.message}`);
    }

    return {
      pushedRoutines: localRoutines.length,
      pushedDayPlans: allLocalDayPlans.length,
      pushedSetLogs: localSetLogs.length,
    };
  },

  /**
   * Pull all remote data from Supabase and merge with SQLite.
   */
  async pullRemoteData(db: SQLiteDatabase, userId: string) {
    let pulledRoutinesCount = 0;
    let pulledDayPlansCount = 0;
    let pulledSetLogsCount = 0;

    // A. Pull Routines
    const { data: remoteRoutines, error: routinesError } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', userId);

    if (routinesError) throw new Error(`Pulling routines failed: ${routinesError.message}`);

    if (remoteRoutines && remoteRoutines.length > 0) {
      for (const row of remoteRoutines) {
        // Check if exists locally
        const localExists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM routines WHERE id = ?',
          [row.id]
        );

        if (!localExists) {
          await insertRoutine(db, {
            id: row.id,
            name: row.name,
            createdAt: row.created_at,
          });
          pulledRoutinesCount++;
        } else {
          // Update local name if changed
          await db.runAsync(
            'UPDATE routines SET name = ? WHERE id = ?',
            [row.name, row.id]
          );
        }
      }
    }

    // B. Pull Day Plans
    const { data: remoteDayPlans, error: dayPlansError } = await supabase
      .from('day_plans')
      .select('*')
      .eq('user_id', userId);

    if (dayPlansError) throw new Error(`Pulling day plans failed: ${dayPlansError.message}`);

    if (remoteDayPlans && remoteDayPlans.length > 0) {
      for (const row of remoteDayPlans) {
        const localExists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM day_plans WHERE id = ?',
          [row.id]
        );

        const mappedDayPlan: DayPlan = {
          id: row.id,
          routineId: row.routine_id,
          dayIndex: row.day_index,
          isRest: row.is_rest === 1,
          exercisePlans: typeof row.exercise_plans === 'string' 
            ? JSON.parse(row.exercise_plans) 
            : row.exercise_plans,
        };

        if (!localExists) {
          await insertDayPlan(db, mappedDayPlan);
          pulledDayPlansCount++;
        } else {
          await db.runAsync(
            'UPDATE day_plans SET is_rest = ?, exercise_plans = ? WHERE id = ?',
            [mappedDayPlan.isRest ? 1 : 0, JSON.stringify(mappedDayPlan.exercisePlans), row.id]
          );
        }
      }
    }

    // C. Pull Set Logs
    const { data: remoteSetLogs, error: setLogsError } = await supabase
      .from('set_logs')
      .select('*')
      .eq('user_id', userId);

    if (setLogsError) throw new Error(`Pulling set logs failed: ${setLogsError.message}`);

    if (remoteSetLogs && remoteSetLogs.length > 0) {
      for (const row of remoteSetLogs) {
        const localExists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM set_logs WHERE id = ?',
          [row.id]
        );

        const mappedSetLog: SetLog = {
          id: row.id,
          exerciseName: row.exercise_name,
          weightKg: row.weight_kg,
          reps: row.reps,
          timestamp: row.timestamp,
          routineId: row.routine_id,
          dayIndex: row.day_index,
          setType: row.set_type as 'work' | 'warmup' | 'dropset',
          supersetId: row.superset_id || undefined,
        };

        if (!localExists) {
          await insertSetLog(db, mappedSetLog);
          pulledSetLogsCount++;
        } else {
          // Update weight/reps/timestamp if modified
          await db.runAsync(
            'UPDATE set_logs SET weight_kg = ?, reps = ?, timestamp = ?, set_type = ?, superset_id = ? WHERE id = ?',
            [
              mappedSetLog.weightKg,
              mappedSetLog.reps,
              mappedSetLog.timestamp,
              mappedSetLog.setType,
              mappedSetLog.supersetId || null,
              row.id
            ]
          );
        }
      }
    }

    return {
      pulledRoutines: pulledRoutinesCount,
      pulledDayPlans: pulledDayPlansCount,
      pulledSetLogs: pulledSetLogsCount,
    };
  },

  /**
   * Helper to delete a remote set log immediately if online.
   */
  async deleteRemoteSetLog(logId: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // Silent return if offline or not logged in

      await supabase
        .from('set_logs')
        .delete()
        .eq('id', logId);
    } catch (err) {
      console.warn('[SyncService] Could not delete remote set log (offline or server error):', err);
    }
  }
};
