// services/coachService.ts
// Tầng gọi API dành riêng cho Huấn luyện viên (Coach API)

import { api } from '../lib/api';
import type { Class, ClassSchedule, Enrollment, Attendance, AttendanceStatus } from '../lib/types';

/** GET /classes?coachId={coachId} */
export const getCoachClasses = (coachId: string) =>
  api.get<Class[]>('/classes', { coachId, limit: '50' });

/** GET /class-schedules?status=SCHEDULED */
export const getCoachSchedules = (startAfter?: string) =>
  api.get<ClassSchedule[]>('/class-schedules', {
    status: 'SCHEDULED',
    startAfter: startAfter ?? new Date().toISOString(),
    limit: '50',
  });

/** GET /enrollments/schedule/{scheduleId} (Lấy học viên đăng ký ca học) */
export const getScheduleEnrollments = (scheduleId: string) =>
  api.get<Enrollment[]>(`/enrollments/schedule/${scheduleId}`);

/** GET /attendance?scheduleId={scheduleId} (Lấy điểm danh ca học) */
export const getScheduleAttendance = (scheduleId: string) =>
  api.get<Attendance[]>(`/attendance?scheduleId=${scheduleId}`);

/** POST /attendance (Tạo điểm danh) */
export const createAttendance = (payload: { scheduleId: string; memberId: string; status: AttendanceStatus }) =>
  api.post('/attendance', payload);

/** PATCH /attendance/{id} (Cập nhật điểm danh) */
export const updateAttendance = (id: string, status: AttendanceStatus) =>
  api.patch(`/attendance/${id}`, { status });
