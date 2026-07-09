import { SQLiteDatabase } from 'expo-sqlite';
import { seedDatabase } from './seed';

export async function initializeDatabase(db: SQLiteDatabase) {
  try {
    // Enable WAL journal mode and foreign keys
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
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

    console.log('[SQLite] Database tables initialized successfully.');

    // Seed default data if database is empty
    await seedDatabase(db);
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}
