# Stage 02 Contract - 02_scaffolding/CONTEXT.md

> [!IMPORTANT]
> This contract outlines the inputs, outputs, goals, and tasks for **Stage 02: Scaffolding & Setup**.

## 1. Stage Contract

### Inputs
- Planning outputs in [01_planning/](../01_planning/)
- Framework rules in [_config/rules.md](../_config/rules.md)

### Expected Outputs
- Configured Expo SQLite connection and initial database schema migrations.
- Complete dark/teal theme configuration in `index.css` or Tailwind styling file.
- Layout routing structure inside `app/` directory with tabs layout.
- Abstracted helper wrapper for `expo-haptics`.

## 2. Scaffolding Checklist
- [ ] Initialize/install npm packages from Stage 01 manifest.
- [ ] Implement database initialization provider.
- [ ] Setup app router tab layout structures (`(tabs)/index.tsx`, `(tabs)/routines.tsx`, `(tabs)/analytics.tsx`, `(tabs)/history.tsx`).
- [ ] Scaffold styling/theme base.
- [ ] Verify haptics configuration.
