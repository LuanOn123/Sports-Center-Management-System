// services/coachService.ts
// Tầng gọi API dành riêng cho Huấn luyện viên — lớp phụ trách, lịch dạy, học viên của buổi
// (API điểm danh nằm ở services/attendanceService.ts)

import { api, apiRequest } from '../lib/api';
import type { Class, ClassSchedule, CoachDetails, Enrollment, LearnerProfile, ScheduleStatus } from '../lib/types';
import { allPages } from '../lib/pagedApi';

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

/**
 * GET /class-schedules?coachId=&startAfter=&startBefore= — lịch dạy HIỆU LỰC của HLV trong khoảng thời gian.
 * BE tự giới hạn theo HLV đang đăng nhập và tính người dạy thay (HLV riêng của buổi > HLV chính của lớp, HLV phụ giữ
 * quyền) nên HLV dạy thay không có lớp dài hạn vẫn thấy buổi, còn HLV gốc không thấy buổi đã chuyển — giống FE web
 * (features/coach/data.ts). Không tải lịch theo từng lớp và không có phương án dự phòng tải lịch cả cơ sở.
 */
export async function getCoachSchedules(coachId: string, range: ScheduleRange, signal?: AbortSignal): Promise<ClassSchedule[]> {
  const { data } = await allPages<ClassSchedule>('/class-schedules', { coachId, ...range }, signal);
  return data.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

/** GET /enrollments/schedule/:scheduleId — học viên đã đăng ký một buổi */
export const getScheduleEnrollments = (scheduleId: string) =>
  allPages<Enrollment>(`/enrollments/schedule/${scheduleId}`);

/**
 * GET /members/:id — hồ sơ học viên cho HLV. BE chỉ trả bản rút gọn (tên, ảnh, trình độ, mục tiêu) và trả 404 nếu học viên
 * không thuộc lịch dạy của HLV; email, điện thoại, ghi chú sức khỏe lấy từ danh sách học viên của buổi (getScheduleEnrollments).
 */
export const getLearnerProfile = (memberId: string, signal?: AbortSignal) =>
  apiRequest<LearnerProfile>(`/members/${encodeURIComponent(memberId)}`, 'GET', { signal });
