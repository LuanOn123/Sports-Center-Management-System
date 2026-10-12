// services/scheduleService.ts
// Tầng gọi API buổi học (dùng chung Member + Coach)

import { api } from '../lib/api';
import type { ClassSchedule } from '../lib/types';

/** GET /class-schedules/:id — chi tiết một buổi học */
export const getScheduleById = (scheduleId: string) =>
  api.get<ClassSchedule>(`/class-schedules/${scheduleId}`);
