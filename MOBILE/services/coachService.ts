// services/coachService.ts
// Tầng gọi API dành riêng cho Huấn luyện viên — lớp phụ trách, lịch dạy, học viên của buổi
// (API điểm danh nằm ở services/attendanceService.ts)

import { api } from '../lib/api';
import type { Class, ClassSchedule, Enrollment, ScheduleStatus } from '../lib/types';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20; // chặn vòng lặp vô hạn nếu pagination bất thường
const CLASS_BATCH_SIZE = 4; // số lớp gọi song song mỗi lượt (giống FE web)

export interface ScheduleRange {
  /** ISO — lấy buổi có startTime >= mốc này */
  startAfter: string;
  /** ISO — lấy buổi có startTime <= mốc này */
  startBefore: string;
  status?: ScheduleStatus;
}

/** GET /classes?coachId= — các lớp HLV được phân công */
export const getCoachClasses = (coachId: string) =>
  api.get<Class[]>('/classes', { coachId, limit: '50' });

/** GET /class-schedules?classId=&startAfter=&startBefore= — gom đủ mọi trang của một lớp */
async function getClassSchedules(classId: string, range: ScheduleRange): Promise<ClassSchedule[]> {
  const query = { classId, ...range, limit: String(PAGE_LIMIT) };
  let all: ClassSchedule[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await api.get<ClassSchedule[]>('/class-schedules', { ...query, page: String(page) });
    all = all.concat(res.data ?? []);
    const totalPages = res.pagination?.totalPages ?? 1;
    if (!res.data?.length || page >= totalPages) break;
  }
  return all;
}

/**
 * Lịch dạy của HLV trong khoảng thời gian — chỉ hỏi lịch của các lớp được phân công
 * (BE chưa lọc theo coachId; KHÔNG tải lịch toàn trung tâm — giống FE web).
 */
export async function getCoachSchedules(classIds: string[], range: ScheduleRange): Promise<ClassSchedule[]> {
  const result: ClassSchedule[] = [];
  for (let i = 0; i < classIds.length; i += CLASS_BATCH_SIZE) {
    const batch = await Promise.all(classIds.slice(i, i + CLASS_BATCH_SIZE).map((id) => getClassSchedules(id, range)));
    result.push(...batch.flat());
  }
  return result.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

/** GET /enrollments/schedule/:scheduleId — học viên đã đăng ký một buổi */
export const getScheduleEnrollments = (scheduleId: string) =>
  api.get<Enrollment[]>(`/enrollments/schedule/${scheduleId}`);
