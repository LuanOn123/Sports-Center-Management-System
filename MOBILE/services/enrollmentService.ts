// services/enrollmentService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { ConcurrentClassQuota, Enrollment, WholeCourseEnrollmentResult } from '../lib/types';

/** GET /enrollments/my?status=...&limit=... */
export const getMyEnrollments = (status?: string, limit?: string) =>
  api.get<Enrollment[]>('/enrollments/my', { status, limit });

/** DELETE /enrollments/:id */
export const cancelEnrollment = (id: string) =>
  api.delete(`/enrollments/${id}`);

/** POST /enrollments/:id/transfer */
export const transferEnrollment = (id: string, targetScheduleId: string) =>
  api.post<Enrollment>(`/enrollments/${id}/transfer`, { targetScheduleId });

/** GET /enrollments/my/quota — quota lớp học song song (distinct Class) của hội viên đang đăng nhập */
export const getMyQuota = () =>
  api.get<ConcurrentClassQuota>('/enrollments/my/quota');

/** POST /enrollments/bulk — đăng ký trọn khóa (all-or-nothing) */
export const enrollWholeCourse = (classId: string) =>
  api.post<WholeCourseEnrollmentResult>('/enrollments/bulk', { classId });


/** POST /enrollments — hội viên đặt một buổi học (đặt lại buổi đã hủy: BE tự kích hoạt lại) */
export const enrollSchedule = (scheduleId: string) =>
  api.post<Enrollment>('/enrollments', { scheduleId });
