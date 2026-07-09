import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryStorage: Record<string, string> = {};

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      }
      return await AsyncStorage.getItem(key);
    } catch (e: any) {
      console.warn(`[safeStorage] getItem failed for key "${key}", falling back to memory:`, e.message || e);
      return memoryStorage[key] || null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (e: any) {
      console.warn(`[safeStorage] setItem failed for key "${key}", falling back to memory:`, e.message || e);
      memoryStorage[key] = value;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (e: any) {
      console.warn(`[safeStorage] removeItem failed for key "${key}", falling back to memory:`, e.message || e);
      delete memoryStorage[key];
    }
  }
};
