// services/coachService.ts
// Tầng gọi API dành riêng cho Huấn luyện viên (Coach API)

import { api, type Envelope } from '../lib/api';
import type { Class, ClassSchedule, Enrollment, Attendance, AttendanceStatus, GenerateQrResult } from '../lib/types';

/** GET /classes?coachId={coachId} */
export const getCoachClasses = (coachId: string) =>
  api.get<Class[]>('/classes', { coachId, limit: '50' });

/**
 * GET /class-schedules?status=SCHEDULED — BE chưa hỗ trợ filter theo coachId nên
 * phải lấy hết lịch sắp tới rồi lọc theo lớp ở client. Gom nhiều trang thay vì
 * chỉ lấy trang đầu (limit=50) để không bỏ sót lịch dạy khi trung tâm đông lớp.
 */
export const getCoachSchedules = async (startAfter?: string): Promise<Envelope<ClassSchedule[]>> => {
  const limit = 100;
  const maxPages = 20; // chặn vòng lặp vô hạn nếu pagination bất thường
  const query = {
    status: 'SCHEDULED',
    startAfter: startAfter ?? new Date().toISOString(),
    limit: String(limit),
  };

  let page = 1;
  let all: ClassSchedule[] = [];
  let last: Envelope<ClassSchedule[]> | null = null;

  while (page <= maxPages) {
    const res = await api.get<ClassSchedule[]>('/class-schedules', { ...query, page: String(page) });
    last = res;
    all = all.concat(res.data ?? []);
    const totalPages = res.pagination?.totalPages ?? 1;
    if (!res.data?.length || page >= totalPages) break;
    page += 1;
  }

  return { ...(last as Envelope<ClassSchedule[]>), data: all };
};

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

/** POST /attendance/generate-qr — tạo mã QR điểm danh cho 1 ca học, hết hạn sau ~60s */
export const generateAttendanceQr = (scheduleId: string) =>
  api.post<GenerateQrResult>('/attendance/generate-qr', { scheduleId });
