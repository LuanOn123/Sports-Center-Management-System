// lib/vietqr.ts
// Dựng deeplink mở app ngân hàng theo chuẩn VietQR (https://www.vietqr.io/danh-sach-api/deeplink-app-ngan-hang)
//
// Tham số của dl.vietqr.io: app, ba (SO_TAI_KHOAN@MA_NGAN_HANG), am, tn và url (https, đường dẫn "quay lại") là BẮT BUỘC; bn (tên chủ
// tài khoản) tùy chọn. Thiếu url thì máy chủ VietQR chỉ trả lệnh mở app ngân hàng TRỐNG (Android: intent:// không kèm dữ liệu; iOS: chỉ
// mở mbbank://…) — số tiền và nội dung bị bỏ, kể cả với app có cờ autofill; scheme riêng của app (pulsecenter://…) bị từ chối như thiếu url
// (đã thử bằng dữ liệu giả ngày 2026-11-16). Chỉ app có cờ autofill = 1 mới điền sẵn; app khác chỉ được mở — người dùng quét ảnh QR đã lưu.

import type { BankApp, VietQrBank } from '../services/vietqrService';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * BE (SePay) trả mã ngân hàng dạng "SACOMBANK" — đổi sang mã chuẩn VietQR ("stb")
 * bằng cách so với code / shortName / bin trong danh sách ngân hàng của VietQR.
 */
export function resolveVietQrBankCode(bankId: string | undefined, banks: VietQrBank[]): string | null {
  if (!bankId) return null;
  const key = normalize(bankId);
  const match = banks.find((b) =>
    [b.code, b.shortName, b.short_name, b.bin].some((v) => v && normalize(v) === key)
  );
  return match ? match.code.toLowerCase() : null;
}

export interface TransferInfo {
  accountNumber?: string;
  /** Mã ngân hàng chuẩn VietQR ("mb", "vcb"…); null khi không đổi được từ mã BE trả về */
  bankCode: string | null;
  /** Tên chủ tài khoản nhận tiền (tham số bn, tùy chọn) */
  accountHolder?: string;
  amount: number;
  content: string;
  /** https — đường dẫn "quay lại" (tham số url), xem resolvePaymentReturnUrl */
  returnUrl?: string | null;
}

const HTTPS_URL = /^https:\/\/[^\s/?#]+/i;

/**
 * Đường dẫn "quay lại" gửi cho VietQR (tham số url): ưu tiên giá trị cấu hình (EXPO_PUBLIC_PAYMENT_RETURN_URL); không có hoặc không phải
 * https thì dùng địa chỉ gốc của API. Không có địa chỉ https nào thì null — khi đó app ngân hàng không tự điền được.
 */
export function resolvePaymentReturnUrl(configured: string | undefined, apiBaseUrl: string | undefined): string | null {
  const own = configured?.trim();
  if (own && HTTPS_URL.test(own)) return own;
  return apiBaseUrl?.trim().match(HTTPS_URL)?.[0] ?? null;
}

/** App tự điền được khi VietQR gắn cờ autofill VÀ đủ mọi tham số bắt buộc (ba, am, tn, url); thiếu một thứ thì deeplink chỉ mở app trống */
export function isAutofillReady(app: BankApp, info: TransferInfo): boolean {
  return app.autofill === 1 && Boolean(info.accountNumber && info.bankCode && info.content && info.amount > 0 && info.returnUrl);
}

/**
 * Gắn thông tin chuyển khoản vào deeplink của app. App chưa hỗ trợ tự điền vẫn mở bình thường (không dùng tới tham số),
 * nên luôn gửi đủ tham số để không phải sửa khi ngân hàng hỗ trợ thêm.
 */
export function buildBankAppDeeplink(app: BankApp, info: TransferInfo): string {
  const params: string[] = [];
  // Giữ nguyên "@" như ví dụ của VietQR (ba=CAS01@ocb), chỉ mã hoá từng phần
  if (info.accountNumber && info.bankCode) {
    params.push(`ba=${encodeURIComponent(info.accountNumber)}@${encodeURIComponent(info.bankCode)}`);
  }
  params.push(`am=${Math.round(info.amount)}`);
  params.push(`tn=${encodeURIComponent(info.content)}`);
  const holder = info.accountHolder?.trim();
  if (holder) params.push(`bn=${encodeURIComponent(holder)}`);
  if (info.returnUrl) params.push(`url=${encodeURIComponent(info.returnUrl)}`);
  return `${app.deeplink}${app.deeplink.includes('?') ? '&' : '?'}${params.join('&')}`;
}

/** Ưu tiên app tự điền được, sau đó app phổ biến hơn */
export function sortBankApps(apps: BankApp[]): BankApp[] {
  return [...apps].sort(
    (a, b) => Number(b.autofill === 1) - Number(a.autofill === 1) || b.monthlyInstall - a.monthlyInstall
  );
}
