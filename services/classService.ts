// services/classService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { apiRequest } from '../lib/api';
import type { Class, ClassSchedule, CoursePlan, Sport } from '../lib/types';
import { allPages } from '../lib/pagedApi';

export interface ClassFilters {
  search?: string;
  sportId?: string;
  classType?: string;
  /** INDOOR / OUTDOOR / POOL — khu vực tập của lớp */
  areaType?: string;
  /** Chỉ lớp có buổi thuộc kỳ học này */
  termId?: string;
  isActive?: string;
  limit?: string;
  coachId?: string;
}

/** GET /classes */
export const getClasses = (filters?: ClassFilters) =>
  allPages<Class>('/classes', filters as Record<string, string | undefined>);

/** Đường dẫn chi tiết một lớp — dùng cho cả GET và dò cơ sở chủ của lớp khi bấm thông báo ở cơ sở khác */
export const classPath = (classId: string) => `/classes/${encodeURIComponent(classId)}`;

/** GET /classes/:id */
export const getClassById = (classId: string, signal?: AbortSignal) =>
  apiRequest<Class>(classPath(classId), 'GET', { signal });

/** GET /classes/:id/course-plan — khung lịch trong tuần, chỗ trống, các buổi sắp tới, quyền đăng ký */
export const getCoursePlan = (classId: string, signal?: AbortSignal) =>
  apiRequest<CoursePlan>(`/classes/${encodeURIComponent(classId)}/course-plan`, 'GET', { signal });

/** GET /class-schedules?classId=&status=SCHEDULED&startAfter=bây giờ — các buổi sắp tới của một lớp (HLV xem ở chi tiết lớp) */
export const getUpcomingClassSessions = (classId: string, signal?: AbortSignal) =>
  allPages<ClassSchedule>('/class-schedules', { classId, status: 'SCHEDULED', startAfter: new Date().toISOString() }, signal);

/** GET /sports — chỉ bộ môn đang hoạt động (bộ lọc, danh sách chọn) */
export const getSports = () =>
  allPages<Sport>('/sports', { isActive: 'true' });

/** GET /sports — cả bộ môn đã ngừng, để dịch sportId sang tên (vd. bộ môn được phân công cho HLV) */
export const getAllSports = (signal?: AbortSignal) =>
  allPages<Sport>('/sports', {}, signal);
