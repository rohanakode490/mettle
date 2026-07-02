# Rules Configuration - _config/rules.md

> [!NOTE]
> This file contains strict operational rules and rules validation logic for AI compilers working on the Mettle Expo migration.

## 1. Environment & Architecture Constraints
- **Expo Version:** Must be compatible with Expo v57.0.0. Read docs at `https://docs.expo.dev/versions/v57.0.0/`.
- **Database:** Must use **Expo SQLite** (directly or via Drizzle ORM).
- **Navigation:** Must use **Expo Router** (file-based).
- **Styling:** Standard StyleSheet or Tailwind CSS (via NativeWind). Minimalist Teal/Dark Theme.
- **Haptics:** Must use `expo-haptics` for tactile feedback.

## 2. Interaction & Database Rules

### 2.1. Home Screen Set Log Rows
Each set log row has:
1. **Type Toggle:** `W` (Work), `W` (Warmup), `D` (Dropset).
2. **Previous Weight/Reps hint.**
3. **Weight Input (kg):** Regex validation `^\d*\.?\d?` (allows decimals like 62.5).
4. **Reps Input:** Regex validation `^\d*$` (integers only).
5. **Checkmark Button:** Interactive check/uncheck status.

### 2.2. Strict Validation & Edge Cases
- **Zero Values:** If weight is `0` or empty, OR reps is `0` or empty, do NOT log/save the set.
- **Tapping Checked Circle:** If the user taps a checked circle (`Icons.check_circle` / green) and there are NO modifications to the weight or reps input:
  - Delete the record from `set_logs` in SQLite.
  - Clear the input values (reset to placeholders).
  - Trigger a light haptic impact: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
- **Modifying & Saving Checked Circle:** If the user modifies weight or reps on an already logged set and taps the checkmark, perform an update on the SQLite DB. The row remains checked.
- **Add Extra Set:** Tapping `ADD EXTRA SET` must add an empty set row to the UI state. Once saved (checkmark clicked), it persists to the DB.

## 3. General AI Behavior Rules
- **No Placeholders:** All code, assets, and views must be fully functional. If visual assets (images) are needed, generate them or design inline SVGs.
- **Documentation:** Do not remove existing comments or delete unrelated file documentation.
- **Relative Links:** Always write links to workspace files using relative paths (e.g., `./IDENTITY.md` or `../CONTEXT.md`).
