import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initializeDatabase } from '@/db/db';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={DarkTheme}>
      <SQLiteProvider databaseName="mettle.db" onInit={initializeDatabase}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </SQLiteProvider>
    </ThemeProvider>
  );
}

