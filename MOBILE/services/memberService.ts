// services/memberService.ts
// Tầng gọi API dành riêng cho Hội viên (Member API)

import { api } from '../lib/api';
import type { Enrollment, TrainingPlan, Subscription } from '../lib/types';

/** GET /enrollments/my */
export const getMemberEnrollments = (status?: string) =>
  api.get<Enrollment[]>('/enrollments/my', status ? { status } : undefined);

/** GET /training-plans?memberId={memberId} */
export const getMemberTrainingPlans = (memberId: string) =>
  api.get<TrainingPlan[]>(`/training-plans?memberId=${memberId}`);

/** GET /membership-subscriptions/my */
export const getMemberSubscriptions = () =>
  api.get<Subscription[]>('/membership-subscriptions/my');
