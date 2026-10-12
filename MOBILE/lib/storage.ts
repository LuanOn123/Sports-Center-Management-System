import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  ACCESS: 'pulse.access',
  REFRESH: 'pulse.refresh',
  FACILITY: 'pulse.facility',
} as const;

const isWeb = Platform.OS === 'web';

// SecureStore chỉ nhận key gồm chữ/số và . - _ (id dạng uuid hợp lệ)
const pendingPaymentKey = (userId: string, facilityId: string) =>
  `pulse.pending_checkout.${userId}.${facilityId || 'none'}`;

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
  async getFacilityId(): Promise<string | null> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        return window.localStorage.getItem(KEYS.FACILITY);
      }
      return await SecureStore.getItemAsync(KEYS.FACILITY);
    } catch {
      return null;
    }
  },
  async setFacilityId(id: string | null): Promise<void> {
    try {
      if (isWeb && typeof window !== 'undefined') {
        if (id) window.localStorage.setItem(KEYS.FACILITY, id);
        else window.localStorage.removeItem(KEYS.FACILITY);
        return;
      }
      if (id) await SecureStore.setItemAsync(KEYS.FACILITY, id);
      else await SecureStore.deleteItemAsync(KEYS.FACILITY);
    } catch {
      // Ignore storage errors
    }
  },
  // Chỉ lưu paymentId của đơn SePay gần nhất (theo hội viên + cơ sở, như FE web) để mở lại màn QR —
  // trạng thái thật luôn lấy từ BE.
  async getPendingPaymentId(userId: string, facilityId: string): Promise<string | null> {
    try {
      const key = pendingPaymentKey(userId, facilityId);
      if (isWeb && typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setPendingPaymentId(userId: string, facilityId: string, paymentId: string): Promise<void> {
    try {
      const key = pendingPaymentKey(userId, facilityId);
      if (isWeb && typeof window !== 'undefined') {
        window.localStorage.setItem(key, paymentId);
        return;
      }
      await SecureStore.setItemAsync(key, paymentId);
    } catch {
      // Ignore storage errors
    }
  },
  async clearPendingPaymentId(userId: string, facilityId: string): Promise<void> {
    try {
      const key = pendingPaymentKey(userId, facilityId);
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

