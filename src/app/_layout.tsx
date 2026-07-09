import { DarkTheme, ThemeProvider, Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { initializeDatabase } from '@/db/db';
import { Colors } from '@/constants/theme';
import { DumbbellIcon, ClipboardIcon, ChartIcon, HistoryIcon, SettingsIcon } from '@/components/svg-icons';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];

  return (
    <ThemeProvider value={DarkTheme}>
      <SQLiteProvider databaseName="mettle.db" onInit={initializeDatabase}>
        <AnimatedSplashOverlay />
        
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brandAccent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: colors.backgroundElement,
              borderTopColor: colors.textSecondary + '22',
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: 'bold',
            }
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => (
                <DumbbellIcon size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="routines"
            options={{
              title: 'Routines',
              tabBarIcon: ({ color, size }) => (
                <ClipboardIcon size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              title: 'Analytics',
              tabBarIcon: ({ color, size }) => (
                <ChartIcon size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              tabBarIcon: ({ color, size }) => (
                <HistoryIcon size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color, size }) => (
                <SettingsIcon size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
