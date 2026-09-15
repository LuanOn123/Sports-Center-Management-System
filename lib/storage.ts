import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS: 'pulse.access',
  REFRESH: 'pulse.refresh',
} as const;

export const storage = {
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.ACCESS);
    } catch {
      return null;
    }
  },
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.REFRESH);
    } catch {
      return null;
    }
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS, access),
      SecureStore.setItemAsync(KEYS.REFRESH, refresh),
    ]);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS),
      SecureStore.deleteItemAsync(KEYS.REFRESH),
    ]);
  },
};
