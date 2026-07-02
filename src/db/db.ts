import { SQLiteDatabase } from 'expo-sqlite';

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
    const countResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routines');
    if (countResult && countResult.count === 0) {
      const routineId = 'default-routine';
      await db.runAsync(
        'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
        [routineId, 'Mettle Strength Split', Date.now()]
      );

      // Seed all 7 days of the week (Monday = 0, Sunday = 6)
      const weekPlans = [
        {
          id: 'dp-monday',
          dayIndex: 0,
          isRest: 0,
          plans: [
            { id: 'ex-1', name: 'Barbell Bench Press', targetSets: '3', targetReps: '8-12' },
            { id: 'ex-2', name: 'Overhead Press', targetSets: '3', targetReps: '8-12' },
            { id: 'ex-3', name: 'Incline Dumbbell Fly', targetSets: '3', targetReps: '10-12', supersetId: 'super-1' },
            { id: 'ex-4', name: 'Lateral Raises', targetSets: '3', targetReps: '12-15', supersetId: 'super-1' }
          ]
        },
        {
          id: 'dp-tuesday',
          dayIndex: 1,
          isRest: 1,
          plans: []
        },
        {
          id: 'dp-wednesday',
          dayIndex: 2,
          isRest: 0,
          plans: [
            { id: 'ex-5', name: 'Barbell Row', targetSets: '3', targetReps: '8-12' },
            { id: 'ex-6', name: 'Lat Pulldown', targetSets: '3', targetReps: '8-12' },
            { id: 'ex-7', name: 'Bicep Curl', targetSets: '3', targetReps: '10-12' }
          ]
        },
        {
          id: 'dp-thursday',
          dayIndex: 3,
          isRest: 1,
          plans: []
        },
        {
          id: 'dp-friday',
          dayIndex: 4,
          isRest: 0,
          plans: [
            { id: 'ex-8', name: 'Barbell Squat', targetSets: '3', targetReps: '6-8' },
            { id: 'ex-9', name: 'Romanian Deadlift', targetSets: '3', targetReps: '8-10' },
            { id: 'ex-10', name: 'Calf Raise', targetSets: '3', targetReps: '12-15' }
          ]
        },
        {
          id: 'dp-saturday',
          dayIndex: 5,
          isRest: 1,
          plans: []
        },
        {
          id: 'dp-sunday',
          dayIndex: 6,
          isRest: 1,
          plans: []
        }
      ];

      for (const day of weekPlans) {
        await db.runAsync(
          'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
          [day.id, routineId, day.dayIndex, day.isRest, JSON.stringify(day.plans)]
        );
      }

      console.log('[SQLite] Database successfully seeded with default routines and day plans.');
    }
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}
