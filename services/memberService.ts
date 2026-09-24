// services/memberService.ts
// Tầng gọi API dành riêng cho Hội viên (Member API)

import { api } from '../lib/api';
import type { Attendance, AttendanceSummary } from '../lib/types';

export type AttendanceCredential = { qrToken: string; code?: never } | { code: string; qrToken?: never };

/**
 * POST /attendance/scan-qr — hội viên quét QR (`qrToken`) hoặc nhập mã dự phòng (`code`).
 * BE chỉ nhận ĐÚNG MỘT trong hai field (.strict()), không được gửi cả hai/field lạ.
 */
export const scanAttendanceQr = (credential: AttendanceCredential) =>
  api.post<Attendance>('/attendance/scan-qr', credential);

/** GET /attendance/my — lịch sử điểm danh của chính hội viên (phân trang) */
export const getMyAttendance = (params?: { status?: string; classId?: string; page?: string; limit?: string }) =>
  api.get<Attendance[]>('/attendance/my', params);

/** GET /attendance/my/summary — tỉ lệ chuyên cần theo lớp + danh sách hình phạt của chính mình */
export const getMyAttendanceSummary = () =>
  api.get<AttendanceSummary>('/attendance/my/summary');

/** POST /attendance/penalties/:id/appeal — khiếu nại hình phạt trong vòng 72h */
export const appealAttendancePenalty = (id: string, reason: string) =>
  api.post(`/attendance/penalties/${id}/appeal`, { reason });

// Lấy subscription của member: dùng membershipService.getSubscriptions(memberId)
// (/subscriptions/member/:memberId) — endpoint /membership-subscriptions/my
// không tồn tại ở BE.
