// navigation/routes.ts
// Nguồn duy nhất cho đường dẫn màn hình + quyền truy cập theo vai trò.
// Mọi router.push/replace phải dùng ROUTES, không viết tay chuỗi đường dẫn.

import type { Href } from 'expo-router';
import type { Role } from '../lib/types';

export const ROUTES = {
  // Chưa đăng nhập
  login: '/auth/login',
  register: '/auth/register',
  forgotPassword: '/auth/forgot-password',

  // Tabs
  home: '/(tabs)',
  chat: '/(tabs)/chat',
  profile: '/(tabs)/profile',
  classes: '/(tabs)/classes',
  schedule: '/(tabs)/schedule',
  notifications: '/(tabs)/notifications',
  enrollments: '/(tabs)/enrollments',
  coachAttendance: '/(tabs)/coach-attendance',

  // Màn ngoài tabs
  membershipPlans: '/membership/plans',
  myAttendance: '/attendance/my',
  checkin: '/member/checkin',
  waitlist: '/member/waitlist',
  support: '/member/support',
  payments: '/member/payments',
  coachLeave: '/coach/leave',
  coachFeedback: '/coach/feedback',
  coachMember: (id: string): Href => ({ pathname: '/coach/member/[id]', params: { id } }),
  aiAssistant: '/assistant',

  // Route động
  classDetail: (id: string): Href => ({ pathname: '/classes/[id]', params: { id } }),
  scheduleDetail: (scheduleId: string): Href => ({ pathname: '/schedule/[scheduleId]', params: { scheduleId } }),
  payment: (paymentId: string): Href => ({ pathname: '/payment/[paymentId]', params: { paymentId } }),
  invoice: (id: string): Href => ({ pathname: '/invoice/[id]', params: { id } }),
  paymentDetail: (id: string): Href => ({ pathname: '/member/payment-detail/[id]', params: { id } }),
  chatThread: (userId: string, name?: string): Href => ({ pathname: '/chat/[userId]', params: { userId, ...(name ? { name } : {}) } }),
  coachAttendanceFor: (scheduleId: string): Href => ({ pathname: '/(tabs)/coach-attendance', params: { scheduleId } }),
} as const;

/**
 * Vai trò được vào từng nhóm route (theo segment đầu tiên, hoặc tên tab trong "(tabs)").
 * Route không có trong bảng = mọi vai trò đã đăng nhập đều vào được.
 */
const ROUTE_ROLES: Record<string, readonly Role[]> = {
  enrollments: ['MEMBER'],
  membership: ['MEMBER'],
  payment: ['MEMBER'],
  attendance: ['MEMBER'],
  member: ['MEMBER'],
  invoice: ['MEMBER'],
  coach: ['COACH'],
  'coach-attendance': ['COACH'],
};

export function canAccessRoute(role: Role | undefined, segments: readonly string[]) {
  const name = segments[0] === '(tabs)' ? segments[1] : segments[0];
  const allowed = name ? ROUTE_ROLES[name] : undefined;
  return !allowed || (role !== undefined && allowed.includes(role));
}
