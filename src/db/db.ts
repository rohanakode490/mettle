import { SQLiteDatabase } from 'expo-sqlite';
import { seedDatabase } from './seed';

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

    // Create set_logs table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS set_logs (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_name TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        reps INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        day_index INTEGER NOT NULL,
        set_type TEXT NOT NULL,
        superset_id TEXT
      );
    `);

    // Seed/migrate exercises if table is empty
    const countExResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
    if (countExResult && countExResult.count === 0) {
      const DEFAULT_EXERCISES = [
        'Barbell Bench Press',
        'Overhead Press',
        'Incline Dumbbell Fly',
        'Lateral Raises',
        'Barbell Row',
        'Lat Pulldown',
        'Bicep Curl',
        'Barbell Squat',
        'Romanian Deadlift',
        'Calf Raise',
        'Barbell Deadlift',
        'Incline Dumbbell Press',
        'Leg Press',
        'Hammer Curl',
        'Pull-ups',
        'Tricep Pushdown',
        'Leg Curl'
      ];
      for (const name of DEFAULT_EXERCISES) {
        const id = `ex-def-${Math.random().toString(36).substr(2, 9)}`;
        await db.runAsync('INSERT OR IGNORE INTO exercises (id, name) VALUES (?, ?)', [id, name]);
      }

      // Migrate existing exercise names from day_plans
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
    }

    console.log('[SQLite] Database tables initialized successfully.');

    // Seed default data if database is empty
    await seedDatabase(db);
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}
