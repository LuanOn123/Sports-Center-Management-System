// services/classService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { Class, ClassSchedule, Sport } from '../lib/types';

export interface ClassFilters {
  search?: string;
  sportId?: string;
  classType?: string;
  isActive?: string;
  limit?: string;
}

/** GET /classes */
export const getClasses = (filters?: ClassFilters) =>
  api.get<Class[]>('/classes', filters as Record<string, string | undefined>);

/** GET /classes/:id */
export const getClassById = (id: string) =>
  api.get<Class>(`/classes/${id}`);

/** GET /sports */
export const getSports = () =>
  api.publicGet<Sport[]>('/sports', { isActive: 'true', limit: '50' });

/** GET /schedules/:id */
export const getScheduleById = (id: string) =>
  api.get<ClassSchedule>(`/schedules/${id}`);
