// services/attendanceService.ts
// Tầng gọi API điểm danh — hội viên tự điểm danh / xem lịch sử, HLV điểm danh & tạo mã QR

import { api } from '../lib/api';
import type { Attendance, AttendanceStatus, AttendanceSummary, GenerateQrResult } from '../lib/types';

export type AttendanceCredential = { qrToken: string; code?: never } | { code: string; qrToken?: never };

// ─── Hội viên ─────────────────────────────────────────────────────────────────

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

// ─── Huấn luyện viên ──────────────────────────────────────────────────────────

/** GET /attendance?scheduleId= — điểm danh của một ca học */
export const getScheduleAttendance = (scheduleId: string) =>
  api.get<Attendance[]>('/attendance', { scheduleId });

/** POST /attendance — HLV ghi điểm danh cho học viên */
export const createAttendance = (payload: { scheduleId: string; memberId: string; status: AttendanceStatus }) =>
  api.post('/attendance', payload);

/** POST /attendance/generate-qr — tạo mã QR điểm danh cho 1 ca học, hết hạn sau ~60s */
export const generateAttendanceQr = (scheduleId: string) =>
  api.post<GenerateQrResult>('/attendance/generate-qr', { scheduleId });
