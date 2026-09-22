// services/memberService.ts
// Tầng gọi API dành riêng cho Hội viên (Member API)

import { api } from '../lib/api';
import type { Attendance } from '../lib/types';

/** POST /attendance/scan-qr — hội viên quét/nhập mã QR để tự điểm danh */
export const scanAttendanceQr = (qrToken: string) =>
  api.post<Attendance>('/attendance/scan-qr', { qrToken });

// Lấy subscription của member: dùng membershipService.getSubscriptions(memberId)
// (/subscriptions/member/:memberId) — endpoint /membership-subscriptions/my
// không tồn tại ở BE.
