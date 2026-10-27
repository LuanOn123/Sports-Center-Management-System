// services/coachService.ts
// Tầng gọi API dành riêng cho Huấn luyện viên — lớp phụ trách, lịch dạy, học viên của buổi
// (API điểm danh nằm ở services/attendanceService.ts)

import { api } from '../lib/api';
import type { Class, ClassSchedule, CoachDetails, Enrollment, ScheduleStatus } from '../lib/types';
import { allPages } from '../lib/pagedApi';

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
  allPages<Class>('/classes', { coachId });

/** GET /coaches/:userId — hồ sơ HLV (tên, ảnh, giới thiệu, chuyên môn, kinh nghiệm); hội viên xem được như web */
export const getCoachProfile = (userId: string) => api.get<CoachDetails>(`/coaches/${encodeURIComponent(userId)}`);

/** GET /class-schedules?classId=&startAfter=&startBefore= — gom đủ mọi trang của một lớp */
async function getClassSchedules(classId: string, range: ScheduleRange): Promise<ClassSchedule[]> {
  return (await allPages<ClassSchedule>('/class-schedules', { classId, ...range })).data.filter((s) => s.classId === classId || s.class?.id === classId);
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
  allPages<Enrollment>(`/enrollments/schedule/${scheduleId}`);
