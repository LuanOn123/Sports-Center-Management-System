// lib/bankAppLaunch.ts
// Chuẩn bị mở app ngân hàng từ màn thanh toán + lời nhắn cho người dùng (hooks/member/usePayment, SepayPaymentView).
// App tự điền: chỉ cần mở deeplink. App khác: sao chép nội dung chuyển khoản và lưu ảnh QR (một lần cho mỗi đơn) rồi mới mở,
// để người dùng vào app ngân hàng chọn Quét QR → Chọn ảnh — không phải bấm "Lưu mã QR" riêng.

import { BANK_APP_TEXT, QR_SAVE_TEXT } from '../constants/payment';
import type { SaveImageResult } from './device';

export interface BankAppLaunchDeps {
  /** App mở ra là có sẵn số tiền + nội dung (lib/vietqr › isAutofillReady) */
  autofill: boolean;
  /** Ảnh QR của đơn này đã lưu từ lần trước — không lưu lại để thư viện ảnh không bị trùng */
  qrSaved: boolean;
  copyContent: () => Promise<unknown>;
  saveQr: () => Promise<SaveImageResult>;
}

/** Kết quả lưu ảnh QR cho app không tự điền; null khi app tự điền (không cần chuẩn bị gì). Sao chép nội dung luôn làm trước khi lưu ảnh. */
export async function prepareBankAppLaunch({ autofill, qrSaved, copyContent, saveQr }: BankAppLaunchDeps): Promise<SaveImageResult | null> {
  if (autofill) return null;
  await copyContent();
  return qrSaved ? 'saved' : saveQr();
}

export interface Notice {
  title: string;
  message: string;
}

/** Thông báo sau khi bấm nút "Lưu mã QR"; 'opened' (web) đã mở ảnh ở tab mới nên không báo gì */
export function saveQrNotice(result: SaveImageResult): Notice | null {
  switch (result) {
    case 'saved': return QR_SAVE_TEXT.saved;
    case 'unavailable': return QR_SAVE_TEXT.unavailable;
    case 'denied': return QR_SAVE_TEXT.denied;
    case 'failed': return QR_SAVE_TEXT.failed;
    default: return null;
  }
}

export interface BankAppLaunchNotice extends Notice {
  /** Chữ của nút đồng ý — chính là nút mở app ngân hàng */
  confirmText: string;
}

/**
 * Hộp thoại hiện TRƯỚC khi rời app để mở app ngân hàng không tự điền: hướng dẫn quét ảnh QR vừa lưu,
 * hoặc lý do chưa lưu được (vẫn cho mở app để nhập tay, nội dung chuyển khoản đã được sao chép).
 */
export function bankAppLaunchNotice(appName: string, qr: SaveImageResult): BankAppLaunchNotice {
  if (qr === 'saved') {
    return { title: BANK_APP_TEXT.savedTitle, message: BANK_APP_TEXT.saved(appName), confirmText: BANK_APP_TEXT.open(appName) };
  }
  return {
    title: BANK_APP_TEXT.notSavedTitle,
    message: `${BANK_APP_TEXT.notSaved[qr]} ${BANK_APP_TEXT.manualNote}`,
    confirmText: BANK_APP_TEXT.openAnyway,
  };
}
