// services/trainingService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { TrainingPlan, Attendance, AttendanceStatus } from '../lib/types';

/** GET /training-plans?memberId=... */
export const getTrainingPlans = (memberId?: string) =>
  api.get<TrainingPlan[]>('/training-plans', memberId ? { memberId } : undefined);

/** GET /attendances?scheduleId=... */
export const getAttendances = (scheduleId: string) =>
  api.get<Attendance[]>('/attendances', { scheduleId });

/** PATCH /attendances/:id */
export const updateAttendance = (id: string, status: AttendanceStatus) =>
  api.patch<Attendance>(`/attendances/${id}`, { status });

/** POST /attendances/bulk */
export const bulkUpsertAttendances = (body: {
  scheduleId: string;
  records: { memberId: string; status: AttendanceStatus }[];
}) => api.post<Attendance[]>('/attendances/bulk', body);
