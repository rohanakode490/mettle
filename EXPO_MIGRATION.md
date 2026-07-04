# Mettle: Expo & React Native Migration Guide

This document outlines the architecture, database schema, functional features, edge cases, and test specs of the **Mettle** Flutter app to assist in migrating it to **Expo + React Native**.

---

## 1. Suggested Tech Stack for Expo

*   **Framework:** [Expo](https://expo.dev/) with **Expo Router** (file-based navigation matching the global bottom tab layout).
*   **Database:** **Expo SQLite** (or WatermelonDB/Drizzle ORM for local DB) mapping to the Drift SQLite schema.
*   **Backend & Sync:** `@supabase/supabase-js` (Auth & Remote sync).
*   **Styling & Theme:** Tailwind CSS (via **NativeWind**) or standard `StyleSheet` for the Minimalist Teal/Dark Theme.
*   **Charts:** `react-native-wagmi-charts` or `react-native-gifted-charts` (replacing `fl_chart` for volume & 1RM progression).
*   **Interactions:** `react-native-reanimated` and `@shopify/flash-list` for smooth list rendering and swipe-to-delete.
*   **Reordering:** `react-native-draggable-flatlist` (for routine builder drag & drop).
*   **Haptics:** `expo-haptics` (replacing `flutter_haptic_feedback`).

---

## 2. Database Schema (SQLite)

The local SQLite schema must persist the following entities:

### routines
*   `id` (TEXT, PK): Unique routine ID.
*   `name` (TEXT): Name of the routine.
*   `createdAt` (INTEGER): Timestamp.

### day_plans
*   `id` (TEXT, PK): Unique day plan ID.
*   `routineId` (TEXT, FK -> routines.id): Associated routine.
*   `dayIndex` (INTEGER): Day of the week (0 = Monday, 6 = Sunday).
*   `isRest` (BOOLEAN): Whether it is a rest day.
*   `exercisePlans` (TEXT/JSON): JSON array of planned exercises.
    *   Each item: `{ "id": String, "name": String, "targetSets": String (e.g. "3"), "targetReps": String (e.g. "8-12"), "supersetId": String? }`

### set_logs
*   `id` (TEXT, PK): Unique set log ID.
*   `exerciseName` (TEXT): Name of the exercise performed.
*   `weightKg` (REAL): Weight in kg.
*   `reps` (INTEGER): Repetitions completed.
*   `timestamp` (INTEGER): Logged time.
*   `routineId` (TEXT, FK -> routines.id): Active routine during logging.
*   `dayIndex` (INTEGER): Day index of workout.
*   `setType` (TEXT): Type of set (`'work'`, `'warmup'`, or `'dropset'`).
*   `supersetId` (TEXT?): Group identifier if part of a superset.

---

## 3. Core Functional Features

### 3.1. Home Screen (Today's Workout)
*   **Accordion Cards:** Each planned exercise is displayed in an expandable accordion-style card.
*   **Interactive Set Logging (Checklist style):**
    *   Displays rows representing sets.
    *   Each row has columns: **Type (W/S/D Toggle)**, **Previous Performance**, **Weight Input (kg)**, **Reps Input**, and a **Checkmark Button**.
*   **Smart Defaults:**
    *   By default, new sets initialize with **3 sets** and **8-12 reps**.
*   **Dynamic Set Initialization:**
    *   Pre-populates weight/reps inputs using the last completed workout's values for that exercise (history hint).
*   **Swipe-to-Delete:** Swiping a logged set row deletes it from the DB.
*   **Manual Completion:** Clicking the checkmark button logs the set.
*   **Add Extra Set:** Tapping `ADD EXTRA SET` creates an empty/placeholder set row locally. Once saved, it becomes a permanent logged set.
*   **Workout Completion:** Clicking a global completion button finishes the workout day, updates status, and plays a success haptic pattern.

### 3.2. Routine Builder (7-Day Plan)
*   **Reordering:** Drag-and-drop reordering of exercises within a day plan.
*   **Supersets:** Visual grouping of adjacent exercises (grouped in a card with a distinct outline).

### 3.3. Analytics & History
*   **Weight & Volume Charts:** Volume calculations ($weight \times reps$) and 1RM estimations ($weight \times (1 + reps/30)$).
*   **Workout History:** Scrollable list of past logged workouts with editing and deletion.

---

## 4. Key Edge Cases & Logic Flows

### Edge Case 4.1: Unchecking (Deleting) a Logged Set
When a user taps the green filled checkmark (`Icons.check_circle`) on a set row *without making any changes* to the input fields, it acts as an **uncheck (deletion)**.
*   **Database action:** Delete the corresponding record from `set_logs`.
*   **UI state:** Clear the input fields for that row (resetting to hint placeholder).
*   **Feedback:** Trigger a light haptic impact (e.g. `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`).

### Edge Case 4.2: Editing a Logged Set
If a user changes the weight or reps of an *already logged* set and taps the checkmark:
*   **Database action:** Update the existing record in `set_logs`.
*   **UI state:** Remains checked (green).

### Edge Case 4.3: Strict Validation
*   Weight input must allow decimal numbers (e.g., `62.5`) with a regex check (e.g. `^\d*\.?\d?`).
*   Reps input must allow integers only.
*   If either weight is `0` or reps is `0`, tapping the checkmark must not save or log the set.

---

## 5. Specification for Widget Tests

To ensure the React Native version is bug-free, implement the following test suites:

### Test Suite 1: Clicking Checkmark Twice Unchecks a Set
1.  Render the Home Screen with 1 target set (weight and reps initially empty).
2.  Input `60` for weight and `10` for reps.
3.  Tap the checkmark outline icon (`check-circle-o`).
4.  **Assert:** Checkmark state changes to logged (`check-circle`).
5.  Tap the logged checkmark icon without modifying the values.
6.  **Assert:** Checkmark changes back to outline (`check-circle-o`), the input fields are cleared, and the log is deleted from local storage/db.
7.  Input `65` for weight and `10` for reps. Tap the checkmark outline.
8.  **Assert:** The set is logged again.

### Test Suite 2: Add Extra Set Workflow
1.  Render an accordion with 1 target set.
2.  Tap `ADD EXTRA SET`.
3.  **Assert:** A second input row appears (now 2 rows visible).
4.  Input `50` for weight and `10` for reps in the second row.
5.  Tap the checkmark outline icon for the second row.
6.  **Assert:** The set is logged, stored in the DB, and the row remains logged.
