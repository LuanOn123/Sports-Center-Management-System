// services/enrollmentService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { Enrollment } from '../lib/types';

/** GET /enrollments/my?status=... */
export const getMyEnrollments = (status?: string) =>
  api.get<Enrollment[]>('/enrollments/my', status ? { status } : undefined);

/** DELETE /enrollments/:id */
export const cancelEnrollment = (id: string) =>
  api.delete(`/enrollments/${id}`);

/** POST /enrollments */
export const createEnrollment = (body: { scheduleId: string; memberId?: string }) =>
  api.post<Enrollment>('/enrollments', body);
