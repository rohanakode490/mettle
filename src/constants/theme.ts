/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#18181b', // Zinc 900
    background: '#fafafa', // Zinc 50
    backgroundElement: '#ffffff', // Pure White
    backgroundSelected: '#f4f4f5', // Zinc 100
    textSecondary: '#71717a', // Zinc 500
    brandAccent: '#ea580c', // Orange 600
    brandAccentMuted: '#f97316', // Orange 500
    brandAccentLight: '#ffedd5', // Orange 100
  },
  dark: {
    text: '#fafafa', // Zinc 50
    background: '#09090b', // Zinc 950
    backgroundElement: '#18181b', // Zinc 900
    backgroundSelected: '#27272a', // Zinc 800
    textSecondary: '#a1a1aa', // Zinc 400
    brandAccent: '#f97316', // Orange 500
    brandAccentMuted: '#fb923c', // Orange 400
    brandAccentLight: '#2c1a10', // Dark Orange Warm Tint
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
