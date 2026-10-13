// services/classService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { apiRequest } from '../lib/api';
import type { Class, CoursePlan, Sport } from '../lib/types';
import { allPages } from '../lib/pagedApi';

export interface ClassFilters {
  search?: string;
  sportId?: string;
  classType?: string;
  isActive?: string;
  limit?: string;
  coachId?: string;
}

/** GET /classes */
export const getClasses = (filters?: ClassFilters) =>
  allPages<Class>('/classes', filters as Record<string, string | undefined>);

/** GET /classes/:id/course-plan — khung lịch trong tuần, chỗ trống, các buổi sắp tới, quyền đăng ký */
export const getCoursePlan = (classId: string, signal?: AbortSignal) =>
  apiRequest<CoursePlan>(`/classes/${encodeURIComponent(classId)}/course-plan`, 'GET', { signal });

/** GET /sports */
export const getSports = () =>
  allPages<Sport>('/sports', { isActive: 'true' });
