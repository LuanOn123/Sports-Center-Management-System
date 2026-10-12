// services/membershipService.ts
// Tầng gọi API gói hội viên — không có state, không có hook

import { api } from '../lib/api';
import type { CancelSubscriptionResult, MembershipPlan, Subscription } from '../lib/types';

/** GET /membership-plans?isActive=true */
export const getMembershipPlans = () =>
  api.publicGet<MembershipPlan[]>('/membership-plans', { isActive: 'true' });

/** GET /subscriptions/member/:memberId */
export const getSubscriptions = (memberId: string) =>
  api.get<Subscription[]>(`/subscriptions/member/${memberId}`);

/** PATCH /subscriptions/:id/cancel — hội viên tự hủy gói của mình */
export const cancelSubscription = (id: string, reason?: string) =>
  api.patch<CancelSubscriptionResult>(`/subscriptions/${id}/cancel`, { reason });
