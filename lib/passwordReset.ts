// lib/passwordReset.ts
// Quy tắc thuần cho luồng quên mật khẩu bằng OTP — khớp BE: gửi lại mã chỉ sau 60 giây, mỗi mã nhập sai tối đa 5 lần,
// mã hết hạn sau 5 phút. Chỉ để HƯỚNG DẪN người dùng; BE mới là nơi quyết định.

import {
  OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, PASSWORD_MIN_LENGTH, PASSWORD_RESET_FORM_TEXT as FORM_TEXT,
} from '../constants/passwordReset';
import { ApiError } from './api';

/** Lỗi nhập ở bước đặt lại mật khẩu (tiêu đề + nội dung hộp thoại); null nếu hợp lệ. Thứ tự kiểm tra: mã OTP → mật khẩu mới → xác nhận */
export function resetFormError(input: { otp: string; newPassword: string; confirmPassword: string }): { title: string; message: string } | null {
  if (input.otp.trim().length !== OTP_LENGTH) return { title: FORM_TEXT.missingTitle, message: FORM_TEXT.otpLength };
  if (input.newPassword.length < PASSWORD_MIN_LENGTH) return { title: FORM_TEXT.missingTitle, message: FORM_TEXT.passwordShort };
  if (input.newPassword !== input.confirmPassword) return { title: FORM_TEXT.errorTitle, message: FORM_TEXT.mismatch };
  return null;
}

export interface OtpStatus {
  /** Còn bao nhiêu mili-giây nữa mới được gửi lại mã (0 = gửi được) */
  resendWaitMs: number;
  /** Còn bao nhiêu mili-giây nữa mã hết hạn (0 = hết hạn hoặc chưa gửi) */
  validForMs: number;
  /** Số lần nhập còn lại với mã hiện tại */
  attemptsLeft: number;
  /** Mã đã nhập sai đủ số lần → phải gửi mã mới */
  locked: boolean;
}

/** `sentAt`: mốc gửi mã gần nhất cho email đang dùng (null = chưa gửi); `failedAttempts`: số lần nhập sai mã đó */
export function otpStatus({ sentAt, failedAttempts, now }: { sentAt: number | null; failedAttempts: number; now: number }): OtpStatus {
  const sinceSent = sentAt === null ? null : Math.max(0, now - sentAt);
  const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - failedAttempts);
  return {
    resendWaitMs: sinceSent === null ? 0 : Math.max(0, OTP_RESEND_COOLDOWN_MS - sinceSent),
    validForMs: sinceSent === null ? 0 : Math.max(0, OTP_TTL_MS - sinceSent),
    attemptsLeft,
    locked: attemptsLeft === 0,
  };
}

/**
 * Lỗi "mã không đúng / hết hạn" của BE (400 nghiệp vụ) — mỗi lần như vậy là một lần thử của mã.
 * Lỗi kiểm tra từng trường (mật khẩu quá ngắn…) và 429 không tính vì BE không trừ lần thử cho chúng.
 */
export function countsAsWrongOtp(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 400 && !(error.errors ?? []).length;
}
