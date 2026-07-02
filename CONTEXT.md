# CONTEXT.md - Workspace Routing & Migration State

> [!NOTE]
> This file acts as Layer 1 (Routing) of the Interpretable Context Methodology (ICM). It tracks active tasks, migration progress, and redirects the AI compiler to the correct execution directory.

## 1. Project Context
- **Project Name:** Mettle (Expo Migration)
- **Goal:** Rebuild the Mettle workout tracker from Flutter to Expo & React Native.
- **Tech Stack Specification:** [EXPO_MIGRATION.md](./EXPO_MIGRATION.md)

## 2. Pipeline Execution State
AI compilers must check this section to determine the active workflow folder. **Only execute tasks matching the IN_PROGRESS stage.**

| Stage | Folder | Status | Goals |
| :--- | :--- | :--- | :--- |
| **01** | [01_planning/](./01_planning/) | **COMPLETED** | Define DB structure, router mappings, libraries, and widget tests specs. |
| **02** | [02_scaffolding/](./02_scaffolding/) | **IN_PROGRESS** | Setup SQLite / Drizzle ORM, navigation skeleton, themes, and base hooks. |
| **03** | [03_implementation/](./03_implementation/) | *TODO* | Develop UI screens, checklist logs, swipe-to-delete,Routine Builder, and Charts. |
| **04** | [04_testing/](./04_testing/) | *TODO* | Run Jest/React Native testing library suites for routines and checklists. |
| **05** | [05_review/](./05_review/) | *TODO* | Audit styling, haptics, and finalize production bundle verification. |

## 3. Active Work & Next Steps
- **Active Stage:** `02_scaffolding`
- **Active Tasks:**
  - [x] Establish ICM workspace roots ([IDENTITY.md](./IDENTITY.md), [CONTEXT.md](./CONTEXT.md), and [_config/](./_config/)).
  - [x] Complete stage contract for `01_planning` detailing dependencies and architecture.
  - [ ] Initialize dependencies and Drizzle SQLite provider schema setup.
  - [ ] Align with user on next steps.
