// services/goalService.ts
// Mục tiêu & tiến độ khóa học (GoalTarget) — tầng gọi API thuần, không state.
// Mục tiêu đã cố định sau khi đăng ký nên không có hàm sửa (BE luôn trả 400 với PATCH /attendance/classes/:id/my-goal).

import { api, apiRequest } from '../lib/api';
import type { MyClassGoal, SaveEvaluationPayload, SaveEvaluationResult, ScheduleEvaluationItem } from '../lib/types';

/** GET /attendance/classes/:classId/my-goal — mục tiêu + nhật ký đánh giá của hội viên; data = null khi chưa đăng ký lớp */
export const getMyClassGoal = (classId: string, signal?: AbortSignal) =>
  apiRequest<MyClassGoal | null>(`/attendance/classes/${encodeURIComponent(classId)}/my-goal`, 'GET', { signal });

/** GET /attendance/schedules/:scheduleId/evaluations — mục tiêu và tiến độ của từng học viên trong buổi (HLV phụ trách / quản lý) */
export const getScheduleEvaluations = (scheduleId: string, signal?: AbortSignal) =>
  apiRequest<ScheduleEvaluationItem[]>(`/attendance/schedules/${encodeURIComponent(scheduleId)}/evaluations`, 'GET', { signal });

/** POST /attendance/schedules/:scheduleId/evaluations — HLV chấm tiến độ 0–100% kèm lời dặn; BE cập nhật mục tiêu và báo cho hội viên */
export const saveScheduleEvaluation = (scheduleId: string, payload: SaveEvaluationPayload) =>
  api.post<SaveEvaluationResult>(`/attendance/schedules/${encodeURIComponent(scheduleId)}/evaluations`, payload);
