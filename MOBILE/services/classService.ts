// services/classService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { Class, Sport } from '../lib/types';

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
  api.get<Class[]>('/classes', filters as Record<string, string | undefined>);

/** GET /sports */
export const getSports = () =>
  api.publicGet<Sport[]>('/sports', { isActive: 'true', limit: '50' });
