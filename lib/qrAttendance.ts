// lib/qrAttendance.ts
// Hạn của mã QR điểm danh và mã dự phòng (web: shared/QrAttendance.tsx). Hạn tính từ lúc GỬI yêu cầu, không phải lúc nhận
// phản hồi, nên đồng hồ đếm ngược không bao giờ chạy lâu hơn hạn thật của BE.

import type { GenerateQrResult } from './types';

export interface QrCredential {
  token: string;
  manualCode: string;
  /** Mốc hết hạn (mili-giây epoch) của mã QR */
  qrExpiresAt: number;
  /** Mốc hết hạn (mili-giây epoch) của mã dự phòng — ngắn hơn mã QR */
  manualCodeExpiresAt: number;
}

export function toQrCredential(result: GenerateQrResult, startedAt: number): QrCredential {
  return {
    token: result.qrToken,
    manualCode: result.manualCode,
    qrExpiresAt: startedAt + result.expiresIn * 1000,
    manualCodeExpiresAt: startedAt + result.manualCodeExpiresIn * 1000,
  };
}

/** Số giây còn lại tới mốc hết hạn (làm tròn lên, tối thiểu 0) */
export function secondsLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** Đếm ngược của cả hai mã tại thời điểm `now`; chưa có mã thì chưa coi là hết hạn */
export function qrCountdown(credential: QrCredential | null, now: number) {
  const qrSeconds = credential ? secondsLeft(credential.qrExpiresAt, now) : 0;
  const manualSeconds = credential ? secondsLeft(credential.manualCodeExpiresAt, now) : 0;
  return {
    qrSeconds,
    manualSeconds,
    qrExpired: Boolean(credential) && qrSeconds === 0,
    manualExpired: Boolean(credential) && manualSeconds === 0,
  };
}
