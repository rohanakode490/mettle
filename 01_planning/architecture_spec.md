# Architecture Specification - 01_planning/architecture_spec.md

This document defines the technical design and folder structure for migrating the **Mettle** Flutter app to **Expo v57 + React Native**.

---

## 1. Database Architecture (SQLite & Drizzle)

The database will run locally on the client using `expo-sqlite`. We will design the tables using Drizzle ORM.

### 1.1. Schema Definitions (`src/db/schema.ts`)

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. Routines Table
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 2. Day Plans Table
export const dayPlans = sqliteTable('day_plans', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(), // 0 = Monday, 6 = Sunday
  isRest: integer('is_rest', { mode: 'boolean' }).notNull().default(false),
  exercisePlans: text('exercise_plans').notNull(), // JSON text array of planned exercises
});

// 3. Set Logs Table
export const setLogs = sqliteTable('set_logs', {
  id: text('id').primaryKey(),
  exerciseName: text('exercise_name').notNull(),
  weightKg: real('weight_kg').notNull(),
  reps: integer('reps').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  routineId: text('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  setType: text('set_type').notNull(), // 'work' | 'warmup' | 'dropset'
  supersetId: text('superset_id'), // Nullable superset group identifier
});
```

---

## 2. Directory Routing Design (Expo Router)

We will use Expo Router’s file-based navigation system located in the `app/` folder:

```
app/
├── _layout.tsx           # Global Providers (Theme, DB Provider)
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
