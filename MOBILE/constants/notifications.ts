// constants/notifications.ts
// Biểu tượng theo loại thông báo, chữ của màn Thông báo, phân trang và nhãn nút hành động (web: Communication.tsx)

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

/** Số thông báo mỗi lần tải — bằng trang Thông báo của web (limit 20); kéo xuống cuối danh sách thì tải trang kế */
export const NOTIFICATION_PAGE_SIZE = 20;

/** Nội dung dài hơn chừng này ký tự thì cắt gọn kèm "Xem đầy đủ" (web: NotificationBody; màn điện thoại hẹp hơn nên ngưỡng nhỏ hơn) */
export const NOTIFICATION_BODY_PREVIEW_CHARS = 110;

/** Số dòng của nội dung đang cắt gọn */
export const NOTIFICATION_PREVIEW_LINES = 3;

export const NOTIFICATION_TEXT = {
  title: 'Thông báo',
  markAllRead: 'Đánh dấu tất cả đã đọc',
  subtitleDefault: 'Cập nhật từ trung tâm',
  subtitleUnread: (count: number) => `${count} thông báo chưa đọc`,
  unreadOnly: 'Chỉ xem chưa đọc',
  emptyTitle: 'Chưa có thông báo',
  emptyHint: 'Thông báo về lịch học, gói tập và tin nhắn sẽ xuất hiện ở đây',
  emptyUnreadTitle: 'Không có thông báo chưa đọc',
  emptyUnreadHint: 'Bạn đã xem hết thông báo.',
  reason: (text: string) => `Lý do: ${text}`,
  expand: 'Xem đầy đủ',
  collapse: 'Thu gọn',
  loadFailed: 'Không tải được thông báo. Kéo xuống để thử lại.',
} as const;

/** Nhãn nút hành động theo màn đích của thông báo (web: getNotificationCta) */
export const NOTIFICATION_ACTION_TEXT = {
  chat: 'Mở tin nhắn',
  scheduleMember: 'Xem lịch tập',
  scheduleCoach: 'Xem lịch dạy',
  class: 'Xem lớp học',
  plans: 'Xem gói tập',
  attendance: 'Xem chuyên cần',
  payments: 'Xem thanh toán',
  coachChanges: 'Xem yêu cầu đổi HLV',
  leave: 'Xem đơn nghỉ của tôi',
} as const;
