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
| **02** | [02_scaffolding/](./02_scaffolding/) | **COMPLETED** | Setup SQLite / Drizzle ORM, navigation skeleton, themes, and base hooks. |
| **03** | [03_implementation/](./03_implementation/) | **COMPLETED** | Develop UI screens, checklist logs, swipe-to-delete,Routine Builder, and Charts. |
| **04** | [04_testing/](./04_testing/) | **COMPLETED** | Run Jest/React Native testing library suites for routines and checklists. |
| **05** | [05_review/](./05_review/) | **COMPLETED** | Audit styling, haptics, and finalize production bundle verification. |

## 3. Active Work & Next Steps
- **Active Stage:** None (Migration Fully Completed)
- **Active Tasks:**
  - [x] Establish ICM workspace roots ([IDENTITY.md](./IDENTITY.md), [CONTEXT.md](./CONTEXT.md), and [_config/](./_config/)).
  - [x] Complete stage contract for `01_planning` detailing dependencies and architecture.
  - [x] Complete database schema & provider bootstrap under `02_scaffolding`.
  - [x] Implement core screens (Home, Routines, Analytics, History) under `03_implementation`.
  - [x] Configure Jest and testing framework under `04_testing`.
  - [x] Write Test Suite 1: Clicking Checkmark Twice Unchecks a Set.
  - [x] Write Test Suite 2: Add Extra Set Workflow.
  - [x] Audit styling, haptics, and finalize production bundle verification.
  - [x] Implement missed/alternative day workout plan swapping feature on Today's Workout screen.
  - [x] Implement advanced drag-and-drop reordering in Routine Builder.
  - [x] Configure EAS Build & Store configurations (eas.json and app.json identifiers).
  - [x] Align with user on next steps.
  - [x] Refactor UI styles to resolve stretched screens on wide viewports (web/tablets) and update color scheme to premium sporty indigo/slate.
  - [x] Update backup export feature to download files directly on web and Android (with SAF picker) and share sheet on iOS.
  - [x] Change superset link selector to a custom picker dropdown.
  - [x] Revamp add-exercise modal into a bottom drawer sheet with search filter DB selection list and custom creation trigger.


