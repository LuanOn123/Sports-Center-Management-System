import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  ACCESS: 'pulse.access',
  REFRESH: 'pulse.refresh',
} as const;

const isWeb = Platform.OS === 'web';

export const storage = {
  async getAccessToken(): Promise<string | null> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        return window.localStorage.getItem(KEYS.ACCESS);
      }
      return await SecureStore.getItemAsync(KEYS.ACCESS);
    } catch {
      return null;
    }
  },
  async getRefreshToken(): Promise<string | null> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        return window.localStorage.getItem(KEYS.REFRESH);
      }
      return await SecureStore.getItemAsync(KEYS.REFRESH);
    } catch {
      return null;
    }
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        window.localStorage.setItem(KEYS.ACCESS, access);
        window.localStorage.setItem(KEYS.REFRESH, refresh);
        return;
      }
      await Promise.all([
        SecureStore.setItemAsync(KEYS.ACCESS, access),
        SecureStore.setItemAsync(KEYS.REFRESH, refresh),
      ]);
    } catch {
      // Ignore storage errors
    }
  },
  async clearTokens(): Promise<void> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        window.localStorage.removeItem(KEYS.ACCESS);
        window.localStorage.removeItem(KEYS.REFRESH);
        return;
      }
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.ACCESS),
        SecureStore.deleteItemAsync(KEYS.REFRESH),
      ]);
    } catch {
      // Ignore storage errors
    }
  },
};

