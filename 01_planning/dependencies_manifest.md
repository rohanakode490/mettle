# Dependencies Manifest - 01_planning/dependencies_manifest.md

This document lists the exact packages and versions planned for installation to support the **Mettle** Expo v57 app.

## 1. Core Platform & Navigation (Built-in or Expo Standard)
- `expo-router` (File-based navigation)
- `expo-status-bar`
- `expo-system-ui`
- `react-native-safe-area-context`
- `react-native-screens`

## 2. Database & Storage
- `expo-sqlite` (Local SQLite driver)
- `drizzle-orm` (TypeScript ORM)
- **Dev Dependencies:**
  - `drizzle-kit` (Migration generation & database inspection tools)

## 3. Remote Sync & Auth
- `@supabase/supabase-js` (Client library for Auth, database synchronization, and backup)

## 4. UI Components & Interactivity
- `react-native-reanimated` (Required for smooth swipe gestures and charts)
- `react-native-gesture-handler` (Required for reordering lists)
- `@shopify/flash-list` (Optimized list rendering, replaces FlatList)
- `react-native-draggable-flatlist` (For routines drag-and-drop builder)
- `expo-haptics` (Haptic feedback patterns on check/uncheck and completion)

## 5. Charts & Analytics
- `react-native-gifted-charts` (Robust line & volume progression charts)
- *Alternative:* `react-native-wagmi-charts` (SVG-based charts)

## 6. Styling Framework (Choice of one)
- **Option A (NativeWind / Tailwind v4):**
  - `nativewind`
  - `tailwindcss`
- **Option B:** Built-in React Native `StyleSheet` (no additional dependencies, optimal performance)
