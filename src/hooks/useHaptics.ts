import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function useHaptics() {
  const triggerLight = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('Failed to trigger light haptic', e);
    }
  };

  const triggerSuccess = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('Failed to trigger success haptic', e);
    }
  };

  return {
    triggerLight,
    triggerSuccess,
  };
}
