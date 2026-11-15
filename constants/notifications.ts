// constants/notifications.ts
// Biểu tượng theo loại thông báo và chữ của màn Thông báo

import type { NotificationType } from '../lib/types';

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, string> = {
  MEMBER_REGISTERED: 'person-add',
  CHAT_MESSAGE: 'chat',
  SUBSCRIPTION_EXPIRING: 'alarm',
  SUBSCRIPTION_EXPIRED: 'alarm-off',
  SUBSCRIPTION_CANCELLED: 'cancel',
  UPCOMING_CLASS: 'event',
  SCHEDULE_CANCELLED: 'event-busy',
  SCHEDULE_UPDATED: 'update',
  ENROLLMENT_CONFIRMED: 'check-circle',
  ENROLLMENT_CANCELLED: 'remove-circle-outline',
  TRAINING_PLAN_ASSIGNED: 'fitness-center',
  NEW_CLASS: 'fiber-new',
  COACH_CHANGED: 'swap-horiz',
  ATTENDANCE_WARNING: 'warning',
  ATTENDANCE_PENALTY: 'cancel',
  ATTENDANCE_PENALTY_REVOKED: 'check-circle',
  SCHEDULE_ROOM_CHANGED: 'place',
  PAYMENT_SUCCESS: 'payments',
  PAYMENT_REFUNDED: 'currency-exchange',
  PAYMENT_FAILED: 'error-outline',
  LEAVE_REQUEST_SUBMITTED: 'event-note',
  LEAVE_REQUEST_APPROVED: 'event-available',
  LEAVE_REQUEST_REJECTED: 'event-busy',
  COACH_CHANGE_REQUESTED: 'swap-horiz',
  COACH_CHANGE_APPROVED: 'swap-horiz',
  COACH_CHANGE_REJECTED: 'swap-horiz',
  GOAL_PROGRESS_UPDATED: 'trending-up',
  GENERAL: 'notifications',
};

/** Loại thông báo lạ (BE thêm mới) dùng biểu tượng chung */
export const NOTIFICATION_FALLBACK_ICON = 'notifications';

export const NOTIFICATION_TEXT = {
  title: 'Thông báo',
  markAllRead: 'Đánh dấu tất cả đã đọc',
  emptyTitle: 'Chưa có thông báo',
  emptyHint: 'Thông báo về lịch học, gói tập và tin nhắn sẽ xuất hiện ở đây',
} as const;
