// services/vietqrService.ts
// Gọi API CÔNG KHAI của VietQR (api.vietqr.io) — dịch vụ bên ngoài, KHÔNG qua BE.
// Dùng fetch riêng (không dùng lib/api) để không gửi token đăng nhập / X-Facility-Id ra ngoài.

import { Platform } from 'react-native';
import { VIETQR_API_BASE } from '../constants/payment';

export interface BankApp {
  appId: string;
  appLogo: string;
  appName: string;
  bankName: string;
  monthlyInstall: number;
  /** Link mở app, vd. https://dl.vietqr.io/pay?app=vcb */
  deeplink: string;
  /** 1 = app tự điền tài khoản/số tiền/nội dung từ deeplink */
  autofill?: number;
}

export interface VietQrBank {
  code: string;
  bin: string;
  shortName: string;
  short_name?: string;
  name: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${VIETQR_API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`VietQR ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** GET /android-app-deeplinks | /ios-app-deeplinks — app ngân hàng mở được bằng deeplink */
export async function getBankApps(): Promise<BankApp[]> {
  const path = Platform.OS === 'ios' ? '/ios-app-deeplinks' : '/android-app-deeplinks';
  const data = await getJson<{ apps: BankApp[] }>(path);
  return data.apps ?? [];
}

/** GET /banks — mã ngân hàng chuẩn VietQR (để dựng tham số ba=TÀI_KHOẢN@MÃ) */
export async function getVietQrBanks(): Promise<VietQrBank[]> {
  const data = await getJson<{ data: VietQrBank[] }>('/banks');
  return data.data ?? [];
}
