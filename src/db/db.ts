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
      const nowTimestamp = Date.now();

      // Routine 1: Mettle Strength Split
      const routine1Id = 'default-routine';
      await db.runAsync(
        'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
        [routine1Id, 'Mettle Strength Split', nowTimestamp]
      );

      const routine1Plans = [
        { id: 'dp-1-0', dayIndex: 0, isRest: 0, plans: [
          { id: 'ex-1-1', name: 'Barbell Bench Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-1-2', name: 'Overhead Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-1-3', name: 'Incline Dumbbell Fly', targetSets: '3', targetReps: '10-12', supersetId: 'super-1' },
          { id: 'ex-1-4', name: 'Lateral Raises', targetSets: '3', targetReps: '12-15', supersetId: 'super-1' }
        ]},
        { id: 'dp-1-1', dayIndex: 1, isRest: 1, plans: [] },
        { id: 'dp-1-2', dayIndex: 2, isRest: 0, plans: [
          { id: 'ex-1-5', name: 'Barbell Row', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-1-6', name: 'Lat Pulldown', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-1-7', name: 'Bicep Curl', targetSets: '3', targetReps: '10-12' }
        ]},
        { id: 'dp-1-3', dayIndex: 3, isRest: 1, plans: [] },
        { id: 'dp-1-4', dayIndex: 4, isRest: 0, plans: [
          { id: 'ex-1-8', name: 'Barbell Squat', targetSets: '3', targetReps: '6-8' },
          { id: 'ex-1-9', name: 'Romanian Deadlift', targetSets: '3', targetReps: '8-10' },
          { id: 'ex-1-10', name: 'Calf Raise', targetSets: '3', targetReps: '12-15' }
        ]},
        { id: 'dp-1-5', dayIndex: 5, isRest: 1, plans: [] },
        { id: 'dp-1-6', dayIndex: 6, isRest: 1, plans: [] }
      ];

      for (const day of routine1Plans) {
        await db.runAsync(
          'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
          [day.id, routine1Id, day.dayIndex, day.isRest, JSON.stringify(day.plans)]
        );
      }

      // Routine 2: Push Pull Legs (PPL) - 6 Day Split
      const routine2Id = 'ppl-routine';
      await db.runAsync(
        'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
        [routine2Id, 'Push Pull Legs (PPL)', nowTimestamp + 1000]
      );

      const routine2Plans = [
        { id: 'dp-2-0', dayIndex: 0, isRest: 0, plans: [
          { id: 'ex-2-1', name: 'Barbell Bench Press', targetSets: '4', targetReps: '8-12' },
          { id: 'ex-2-2', name: 'Overhead Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-2-3', name: 'Incline Dumbbell Press', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-2-4', name: 'Lateral Raises', targetSets: '4', targetReps: '12-15' }
        ]},
        { id: 'dp-2-1', dayIndex: 1, isRest: 0, plans: [
          { id: 'ex-2-5', name: 'Barbell Deadlift', targetSets: '1', targetReps: '5' },
          { id: 'ex-2-6', name: 'Barbell Row', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-2-7', name: 'Lat Pulldown', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-2-8', name: 'Bicep Curl', targetSets: '3', targetReps: '10-12' }
        ]},
        { id: 'dp-2-2', dayIndex: 2, isRest: 0, plans: [
          { id: 'ex-2-9', name: 'Barbell Squat', targetSets: '4', targetReps: '6-8' },
          { id: 'ex-2-10', name: 'Romanian Deadlift', targetSets: '3', targetReps: '8-10' },
          { id: 'ex-2-11', name: 'Leg Press', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-2-12', name: 'Calf Raise', targetSets: '4', targetReps: '12-15' }
        ]},
        { id: 'dp-2-3', dayIndex: 3, isRest: 0, plans: [
          { id: 'ex-2-13', name: 'Barbell Bench Press', targetSets: '4', targetReps: '8-12' },
          { id: 'ex-2-14', name: 'Incline Dumbbell Fly', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-2-15', name: 'Lateral Raises', targetSets: '4', targetReps: '12-15' }
        ]},
        { id: 'dp-2-4', dayIndex: 4, isRest: 0, plans: [
          { id: 'ex-2-16', name: 'Barbell Row', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-2-17', name: 'Lat Pulldown', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-2-18', name: 'Hammer Curl', targetSets: '3', targetReps: '10-12' }
        ]},
        { id: 'dp-2-5', dayIndex: 5, isRest: 0, plans: [
          { id: 'ex-2-19', name: 'Barbell Squat', targetSets: '4', targetReps: '6-8' },
          { id: 'ex-2-20', name: 'Romanian Deadlift', targetSets: '3', targetReps: '8-10' }
        ]},
        { id: 'dp-2-6', dayIndex: 6, isRest: 1, plans: [] }
      ];

      for (const day of routine2Plans) {
        await db.runAsync(
          'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
          [day.id, routine2Id, day.dayIndex, day.isRest, JSON.stringify(day.plans)]
        );
      }

      // Routine 3: 5-Day Workout Split (PPL / Upper Lower Hybrid)
      const routine3Id = 'fiveday-split';
      await db.runAsync(
        'INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)',
        [routine3Id, '5-Day Split', nowTimestamp + 2000]
      );

      const routine3Plans = [
        { id: 'dp-3-0', dayIndex: 0, isRest: 0, plans: [
          { id: 'ex-3-1', name: 'Barbell Bench Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-3-2', name: 'Barbell Row', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-3-3', name: 'Overhead Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-3-4', name: 'Lat Pulldown', targetSets: '3', targetReps: '8-12' }
        ]},
        { id: 'dp-3-1', dayIndex: 1, isRest: 0, plans: [
          { id: 'ex-3-5', name: 'Barbell Squat', targetSets: '4', targetReps: '6-8' },
          { id: 'ex-3-6', name: 'Romanian Deadlift', targetSets: '3', targetReps: '8-10' },
          { id: 'ex-3-7', name: 'Leg Press', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-3-8', name: 'Calf Raise', targetSets: '4', targetReps: '12-15' }
        ]},
        { id: 'dp-3-2', dayIndex: 2, isRest: 1, plans: [] },
        { id: 'dp-3-3', dayIndex: 3, isRest: 0, plans: [
          { id: 'ex-3-9', name: 'Incline Dumbbell Press', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-3-10', name: 'Pull-ups', targetSets: '3', targetReps: '8-12' },
          { id: 'ex-3-11', name: 'Lateral Raises', targetSets: '4', targetReps: '12-15' },
          { id: 'ex-3-12', name: 'Tricep Pushdown', targetSets: '3', targetReps: '10-12' }
        ]},
        { id: 'dp-3-4', dayIndex: 4, isRest: 0, plans: [
          { id: 'ex-3-13', name: 'Barbell Deadlift', targetSets: '2', targetReps: '5' },
          { id: 'ex-3-14', name: 'Leg Curl', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-3-15', name: 'Calf Raise', targetSets: '4', targetReps: '12-15' }
        ]},
        { id: 'dp-3-5', dayIndex: 5, isRest: 0, plans: [
          { id: 'ex-3-16', name: 'Bicep Curl', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-3-17', name: 'Hammer Curl', targetSets: '3', targetReps: '10-12' },
          { id: 'ex-3-18', name: 'Incline Dumbbell Fly', targetSets: '3', targetReps: '10-12' }
        ]},
        { id: 'dp-3-6', dayIndex: 6, isRest: 1, plans: [] }
      ];

      for (const day of routine3Plans) {
        await db.runAsync(
          'INSERT INTO day_plans (id, routine_id, day_index, is_rest, exercise_plans) VALUES (?, ?, ?, ?, ?)',
          [day.id, routine3Id, day.dayIndex, day.isRest, JSON.stringify(day.plans)]
        );
      }

      console.log('[SQLite] Database successfully seeded with multiple default routines and day plans.');
    }
  } catch (error) {
    console.error('[SQLite] Error initializing database:', error);
    throw error;
  }
}
