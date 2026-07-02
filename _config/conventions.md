# Conventions Configuration - _config/conventions.md

> [!NOTE]
> This file outlines coding style guidelines, folder architecture, and framework conventions for the Expo/React Native project.

## 1. Directory Structure
All core source code must be placed under the [src/](../src/) directory or the root directory according to Expo Router conventions:
- `app/`: Routing pages (file-based routing).
  - `(tabs)/`: Tab-based main navigation structure (Home, Routines, Analytics, History).
  - `_layout.tsx`: Root shell, theme provider, and router setup.
- `src/components/`: Reusable components (Accordion, SetRow, RoutineCard).
- `src/db/`: Database configuration, schemas, and migrations.
- `src/hooks/`: Custom React hooks (e.g., `useWorkout`, `useDatabase`, `useHaptics`).
- `src/utils/`: Helper scripts, validator regexes, and estimators (e.g., 1RM, volume).

## 2. Coding Conventions
- **TypeScript:** Strict types are mandatory. No usage of `any`. Define interfaces for all SQLite query results and state entities.
- **Components:** Functional components with React.FC, named exports, clear props typing.
- **Styling:** CSS variables or styling config mapping to the minimalist Teal & Dark theme.
  - Dark background: `#121212` or similar.
  - Accent colors: Teal `#0d9488` (Teal 600), `#14b8a6` (Teal 500).
- **State Management:** Keep SQLite transactions wrapped inside a central React context or database hook provider to ensure consistency.

## 3. Database Schema Mapping
SQLite mapping schema from Flutter Drift:
- `routines`: `id` (TEXT, PK), `name` (TEXT), `createdAt` (INTEGER)
- `day_plans`: `id` (TEXT, PK), `routineId` (TEXT, FK -> routines.id), `dayIndex` (INTEGER), `isRest` (BOOLEAN), `exercisePlans` (TEXT / JSON array of exercises)
- `set_logs`: `id` (TEXT, PK), `exerciseName` (TEXT), `weightKg` (REAL), `reps` (INTEGER), `timestamp` (INTEGER), `routineId` (TEXT, FK -> routines.id), `dayIndex` (INTEGER), `setType` (TEXT), `supersetId` (TEXT?)
