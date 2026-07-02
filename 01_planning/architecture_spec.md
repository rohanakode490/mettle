# Architecture Specification - 01_planning/architecture_spec.md

This document defines the technical design and folder structure for migrating the **Mettle** Flutter app to **Expo v57 + React Native**, focusing on local **SQLite** database storage.

---

## 1. Database Architecture (SQLite)

The database will run locally on the client using `expo-sqlite` and raw SQL statements to align with simplicity and direct database access.

### 1.1. Schema Table Setup Script

The database initialization schema is executed using `db.execAsync(...)` on startup:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Routines Table
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL -- Timestamp representation
);

-- 2. Day Plans Table
CREATE TABLE IF NOT EXISTS day_plans (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL, -- 0 = Monday, 6 = Sunday
  is_rest INTEGER NOT NULL DEFAULT 0, -- Boolean: 0 = false, 1 = true
  exercise_plans TEXT NOT NULL -- JSON text array of planned exercises
);

-- 3. Set Logs Table
CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_name TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  timestamp INTEGER NOT NULL, -- Logged timestamp
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  set_type TEXT NOT NULL, -- 'work' | 'warmup' | 'dropset'
  superset_id TEXT -- Nullable superset identifier
);
```

### 1.2. TypeScript Models (`src/types/database.ts`)

```typescript
export interface Routine {
  id: string;
  name: string;
  createdAt: number; // Unix timestamp
}

export interface DayPlan {
  id: string;
  routineId: string;
  dayIndex: number;
  isRest: boolean;
  exercisePlans: Array<{
    id: string;
    name: string;
    targetSets: string;
    targetReps: string;
    supersetId?: string;
  }>;
}

export interface SetLog {
  id: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  timestamp: number;
  routineId: string;
  dayIndex: number;
  setType: 'work' | 'warmup' | 'dropset';
  supersetId?: string;
}
```

---

## 2. Directory Routing Design (Expo Router)

We will use Expo Router’s file-based navigation system located in the `app/` folder:

```
app/
├── _layout.tsx           # Global Providers (Theme, SQLiteProvider wrapper)
└── (tabs)/               # Bottom Tab Layout containing the 4 main tabs
    ├── _layout.tsx       # Bottom navigation layout configuration
    ├── index.tsx         # Today's Workout screen (Home)
    ├── routines.tsx      # Routines listing and routine builder trigger
    ├── analytics.tsx     # Volume, 1RM, and workouts count charts
    └── history.tsx       # Scrollable scroll view of past set logs
```

---

## 3. UI Component Specifications

### 3.1. Today's Workout Screen Components
- **Accordion Card Component:** Expandable accordion wrapper that houses an exercise block. Renders the exercise name, sets header, and the set rows.
- **Checklist Log Row Component:**
  - Row displaying: Set Index, Set Type Toggle (Warmup `W`, Working Set `S`, Dropset `D`), Hint placeholder, weight input (kg), reps input, checkmark state button.
  - Tapping checked circle checks for inputs modifications. If none, deletes record and clears inputs.
  - Regex validations for weight (`^\d*\.?\d?`) and reps (`^\d*$`).

### 3.2. Routine Builder Screen Components
- **Drag & Drop Container:** Uses `react-native-draggable-flatlist` to enable reordering exercises.
- **Superset Outline Card:** If adjacent exercises share a `supersetId`, render them inside a single visually outline-accented card.

---

## 4. Test Specifications

We will implement Jest unit tests in the `__tests__` directory mapping to the requirements:
1. **Checkmark twice uncheck test:** Validates that clicking checkmark, saving a record, and clicking it again deletes the row record and resets the inputs.
2. **Add extra set test:** Validates that clicking `ADD EXTRA SET` appends a row state, and clicking its checkmark creates the record.
