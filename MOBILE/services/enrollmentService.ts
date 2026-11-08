// services/enrollmentService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { EnrollOptions } from '../lib/enrollOptions';
import type { ConcurrentClassQuota, Enrollment, WholeCourseEnrollmentResult } from '../lib/types';
import { allPages } from '../lib/pagedApi';

/** GET /enrollments/my?status=...&limit=... */
export const getMyEnrollments = (status?: string, limit?: string) =>
  allPages<Enrollment>('/enrollments/my', { status });

/** GET /enrollments/my/quota — quota lớp học song song (distinct Class) của hội viên đang đăng nhập */
export const getMyQuota = () =>
  api.get<ConcurrentClassQuota>('/enrollments/my/quota');

/**
 * POST /enrollments/bulk — đăng ký trọn khóa (all-or-nothing). Kèm mục tiêu, lưu ý sức khỏe và "lưu vào hồ sơ"
 * như web (EnrollConfirmModal); BE khởi tạo mục tiêu của hội viên cho lớp ngay sau khi đăng ký thành công.
 */
export const enrollWholeCourse = (classId: string, options: Partial<EnrollOptions> = {}) =>
  api.post<WholeCourseEnrollmentResult>('/enrollments/bulk', { classId, ...options });
