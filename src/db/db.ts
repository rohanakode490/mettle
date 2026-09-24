import { SQLiteDatabase } from 'expo-sqlite';
import { seedDatabase } from './seed';
import { KNOWN_EXERCISES } from '@/constants/exercises';

export async function initializeDatabase(db: SQLiteDatabase) {
  try {
    // Enable WAL journal mode and foreign keys
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    // Create exercises table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE
      );
    `);

    // Create routines table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Create day_plans table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS day_plans (
        id TEXT PRIMARY KEY NOT NULL,
        routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        day_index INTEGER NOT NULL,
        is_rest INTEGER NOT NULL DEFAULT 0,
        exercise_plans TEXT NOT NULL
      );
    `);

    // Create set_logs table with integer weight_kg (multiplied by 100 to avoid floats/doubles)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS set_logs (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_name TEXT NOT NULL,
        weight_kg INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        day_index INTEGER NOT NULL,
        set_type TEXT NOT NULL,
        superset_id TEXT
      );
    `);

    // Migration: If existing set_logs contains unscaled floats (< 1000) and user_version is 0,
    // scale them up to integers (*100) and set user_version to 1.
    const versionResult = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (versionResult && versionResult.user_version < 1) {
      await db.execAsync(`
        UPDATE set_logs SET weight_kg = ROUND(weight_kg * 100) WHERE weight_kg > 0 AND weight_kg < 1000;
        PRAGMA user_version = 1;
      `);
    }

    // Insert all known exercises (INSERT OR IGNORE preserves custom ones and avoids duplicates)
    for (const name of KNOWN_EXERCISES) {
      const id = `ex-def-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      await db.runAsync('INSERT OR IGNORE INTO exercises (id, name) VALUES (?, ?)', [id, name]);
    }

    // Migrate existing exercise names from day_plans and set_logs if any
    try {
      const existingPlans = await db.getAllAsync<{ exercise_plans: string }>('SELECT exercise_plans FROM day_plans');
      const existingNames = new Set<string>();
      for (const plan of existingPlans) {
        try {
          const list = JSON.parse(plan.exercise_plans);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && typeof item.name === 'string' && item.name.trim()) {
                existingNames.add(item.name.trim());
              }
            }
          }
        } catch (e) {
          console.error('[SQLite] Error parsing plan exercises for migration:', e);
        }
      }

      // Migrate existing exercise names from set_logs
      const existingLogs = await db.getAllAsync<{ exercise_name: string }>('SELECT DISTINCT exercise_name FROM set_logs');
      for (const log of existingLogs) {
        if (log.exercise_name && log.exercise_name.trim()) {
          existingNames.add(log.exercise_name.trim());
        }
      }

      // Insert unique existing exercises
      for (const name of existingNames) {
        const id = `ex-mig-${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync('INSERT OR IGNORE INTO exercises (id, name) VALUES (?, ?)', [id, name]);
      }
    } catch (e) {
      console.error('[SQLite] Error during migration of exercises:', e);
    }

    console.log('[SQLite] Database tables initialized successfully.');

    // Seed default data if database is empty
    await seedDatabase(db);
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}
