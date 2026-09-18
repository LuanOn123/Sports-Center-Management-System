// services/membershipService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { MembershipPlan, MembershipStatus, Subscription } from '../lib/types';

/** GET /members/:memberId/membership-status */
export const getMembershipStatus = (memberId: string) =>
  api.get<MembershipStatus>(`/members/${memberId}/membership-status`);

/** GET /membership-plans?isActive=true */
export const getMembershipPlans = () =>
  api.publicGet<MembershipPlan[]>('/membership-plans', { isActive: 'true' });

/** GET /subscriptions/member/:memberId */
export const getSubscriptions = (memberId: string) =>
  api.get<Subscription[]>(`/subscriptions/member/${memberId}`);
