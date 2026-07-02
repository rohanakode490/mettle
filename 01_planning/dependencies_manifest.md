# Dependencies Manifest - 01_planning/dependencies_manifest.md

This document lists the dependencies needed for the **Mettle** Expo v57 app, focusing on raw SQLite.

## 1. Core Platform & Navigation
- `expo-router` (File-based navigation)
- `expo-status-bar`
- `expo-system-ui`
- `react-native-safe-area-context`
- `react-native-screens`

## 2. Database & Storage
- `expo-sqlite` (Local SQLite driver)

## 3. UI Components & Interactivity
- `react-native-reanimated` (Required for smooth swipe gestures and charts)
- `react-native-gesture-handler` (Required for gestures/drags)
- `@shopify/flash-list` (Optimized list rendering, replaces FlatList)
- `expo-haptics` (Haptic feedback patterns on check/uncheck and completion)

## 4. Styling Framework
- Standard React Native `StyleSheet` (no additional dependencies, optimal performance)
