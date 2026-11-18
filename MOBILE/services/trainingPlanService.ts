// services/trainingPlanService.ts
// Giáo án tập luyện của một lớp (web: shared/TrainingPlans) — tầng gọi API thuần, không state.
// Hội viên đã đăng ký lớp chỉ đọc được; HLV được phân công lớp tạo, sửa giáo án của mình và nhờ AI soạn bản nháp.

import { api, apiRequest } from '../lib/api';
import { classPath } from './classService';
import type { CreateTrainingPlanBody, TrainingPlanBody, TrainingPlanList } from '../lib/types';

const plansPath = (classId: string) => `${classPath(classId)}/training-plans`;

/** GET /classes/:id/training-plans — hội viên: giáo án cả lớp + giáo án riêng của mình; HLV: mọi giáo án + danh sách hội viên của lớp */
export const getTrainingPlans = (classId: string, signal?: AbortSignal) =>
  apiRequest<TrainingPlanList>(plansPath(classId), 'GET', { signal });

/** POST /classes/:id/training-plans — HLV giao giáo án (memberId null = cả lớp); BE báo cho người nhận */
export const createTrainingPlan = (classId: string, body: CreateTrainingPlanBody) =>
  api.post<{ id: string }>(plansPath(classId), body);

/** PATCH /classes/:id/training-plans/:planId — HLV sửa giáo án do chính mình viết (không đổi được người nhận) */
export const updateTrainingPlan = (classId: string, planId: string, body: TrainingPlanBody) =>
  api.patch<{ id: string }>(`${plansPath(classId)}/${encodeURIComponent(planId)}`, body);

/** POST /classes/:id/training-plans/suggest — AI soạn bản nháp nội dung theo lớp, hội viên (nếu có) và mục tiêu HLV nêu */
export const suggestTrainingPlan = (classId: string, body: { memberId: string | null; objective?: string }) =>
  api.post<{ draft: string }>(`${plansPath(classId)}/suggest`, body);
