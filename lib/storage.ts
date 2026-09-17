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
  async getPendingPlan(userId: string): Promise<any | null> {
    try {
      const key = `pulse.pending_plan.${userId}`;
      if (isWeb && typeof window !== 'undefined') {
        const val = window.localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      }
      const val = await SecureStore.getItemAsync(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },
  async setPendingPlan(userId: string, data: any): Promise<void> {
    try {
      const key = `pulse.pending_plan.${userId}`;
      const val = JSON.stringify(data);
      if (isWeb && typeof window !== 'undefined') {
        window.localStorage.setItem(key, val);
        return;
      }
      await SecureStore.setItemAsync(key, val);
    } catch {
      // Ignore storage errors
    }
  },
  async clearPendingPlan(userId: string): Promise<void> {
    try {
      const key = `pulse.pending_plan.${userId}`;
      if (isWeb && typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore storage errors
    }
  },
};

