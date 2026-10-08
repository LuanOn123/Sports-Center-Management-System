// lib/vietqr.ts
// Dựng deeplink mở app ngân hàng theo chuẩn VietQR (https://www.vietqr.io/danh-sach-api/deeplink-app-ngan-hang)

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
  bankCode: string | null;
  amount: number;
  content: string;
}

/**
 * Gắn thông tin chuyển khoản vào deeplink của app. App chưa hỗ trợ tự điền vẫn mở bình thường;
 * VietQR khuyến nghị luôn gửi đủ tham số để không phải sửa khi ngân hàng hỗ trợ thêm.
 */
export function buildBankAppDeeplink(app: BankApp, info: TransferInfo): string {
  const params: string[] = [];
  // Giữ nguyên "@" như ví dụ của VietQR (ba=CAS01@ocb), chỉ mã hoá từng phần
  if (info.accountNumber && info.bankCode) {
    params.push(`ba=${encodeURIComponent(info.accountNumber)}@${encodeURIComponent(info.bankCode)}`);
  }
  params.push(`am=${Math.round(info.amount)}`);
  params.push(`tn=${encodeURIComponent(info.content)}`);
  return `${app.deeplink}${app.deeplink.includes('?') ? '&' : '?'}${params.join('&')}`;
}

/** Ưu tiên app tự điền được, sau đó app phổ biến hơn */
export function sortBankApps(apps: BankApp[]): BankApp[] {
  return [...apps].sort(
    (a, b) => Number(b.autofill === 1) - Number(a.autofill === 1) || b.monthlyInstall - a.monthlyInstall
  );
}
