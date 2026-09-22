// services/enrollmentService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { Enrollment } from '../lib/types';

/** GET /enrollments/my?status=...&limit=... */
export const getMyEnrollments = (status?: string, limit?: string) =>
  api.get<Enrollment[]>('/enrollments/my', { status, limit });

/** DELETE /enrollments/:id */
export const cancelEnrollment = (id: string) =>
  api.delete(`/enrollments/${id}`);
