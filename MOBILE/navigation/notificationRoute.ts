// navigation/notificationRoute.ts
// Suy ra màn cần mở khi bấm vào một thông báo (tin nhắn → đoạn chat, lịch học → đúng buổi/lớp) và nhãn nút hành động
// tương ứng (web: getNotificationCta trong shared/Communication.tsx)

import type { Href } from 'expo-router';
import { NOTIFICATION_ACTION_TEXT as ACTION } from '../constants/notifications';
import { refundChatDraft } from '../lib/refund';
import { ROUTES } from './routes';
import type { AppNotification, Role } from '../lib/types';

/** Hành động BE gắn vào thông báo "đã có lễ tân phụ trách yêu cầu hoàn tiền của bạn" (web: meta.action === "REFUND_ASSIGNED") */
const REFUND_ASSIGNED_ACTION = 'REFUND_ASSIGNED';

/** Loại màn đích của một thông báo — quyết định nhãn nút hành động */
export type NotificationTargetKind = 'chat' | 'refundChat' | 'schedule' | 'class' | 'plans' | 'attendance' | 'payments' | 'coachChanges' | 'leave';

export interface NotificationTarget {
  kind: NotificationTargetKind;
  route: Href;
}

function metaString(item: AppNotification, key: string): string | undefined {
  const v = item.metadata?.[key];
  return typeof v === 'string' ? v : undefined;
}

/** Màn đích của thông báo cho vai trò `role`; null nếu loại này không có màn đích (bấm vào chỉ đánh dấu đã đọc) */
export function resolveNotificationTarget(item: AppNotification, role?: Role): NotificationTarget | null {
  switch (item.type) {
    case 'CHAT_MESSAGE': {
      const senderId = metaString(item, 'senderId');
      return senderId ? { kind: 'chat', route: ROUTES.chatThread(senderId) } : null;
    }
    case 'UPCOMING_CLASS':
    case 'ENROLLMENT_CONFIRMED':
    case 'ENROLLMENT_CANCELLED':
    case 'SCHEDULE_CANCELLED':
    case 'SCHEDULE_UPDATED':
    case 'SCHEDULE_ROOM_CHANGED': {
      const scheduleId = metaString(item, 'scheduleId');
      if (scheduleId) return { kind: 'schedule', route: ROUTES.scheduleDetail(scheduleId) };
      const classId = metaString(item, 'classId');
      return classId ? { kind: 'class', route: ROUTES.classDetail(classId) } : null;
    }
    // GOAL_PROGRESS_UPDATED: HLV vừa đánh giá tiến độ → thẻ "Mục tiêu & tiến độ" nằm ở chi tiết lớp
    case 'NEW_CLASS':
    case 'COACH_CHANGED':
    case 'GOAL_PROGRESS_UPDATED': {
      const classId = metaString(item, 'classId');
      return classId ? { kind: 'class', route: ROUTES.classDetail(classId) } : null;
    }
    // Gói sắp hết hạn / đã hết hạn / đã hủy — mở màn gói thành viên để gia hạn hoặc mua gói mới
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_CANCELLED':
      return { kind: 'plans', route: ROUTES.membershipPlans };
    // Cảnh báo/hình phạt chuyên cần — mở màn "Chuyên cần & Điểm danh" của Member
    case 'ATTENDANCE_WARNING':
    case 'ATTENDANCE_PENALTY':
    case 'ATTENDANCE_PENALTY_REVOKED':
      return { kind: 'attendance', route: ROUTES.myAttendance };
    // Đổi HLV theo buổi: duyệt → mở buổi học (người gửi lẫn HLV thay thế đều nhận); từ chối → danh sách yêu cầu của HLV
    case 'COACH_CHANGE_APPROVED': {
      const scheduleId = metaString(item, 'scheduleId');
      return scheduleId ? { kind: 'schedule', route: ROUTES.scheduleDetail(scheduleId) } : { kind: 'coachChanges', route: ROUTES.coachChanges };
    }
    case 'COACH_CHANGE_REJECTED':
      return { kind: 'coachChanges', route: ROUTES.coachChanges };
    // Đơn nghỉ của HLV: web đưa về trang đổi HLV (/coach/leave chuyển tiếp tới /coach/coach-changes); các vai trò khác không có màn đích
    case 'LEAVE_REQUEST_SUBMITTED':
    case 'LEAVE_REQUEST_APPROVED':
    case 'LEAVE_REQUEST_REJECTED':
      return role === 'COACH' ? { kind: 'leave', route: ROUTES.coachChanges } : null;
    // Đã có lễ tân phụ trách yêu cầu hoàn tiền của hội viên → nhắn tin ngay với lễ tân, câu chào soạn sẵn (web: REFUND_ASSIGNED);
    // thông báo hoàn tiền khác (đã ghi nhận, đã hoàn…) mở màn Thanh toán
    case 'PAYMENT_REFUNDED': {
      const receptionistId = metaString(item, 'receptionistUserId');
      if (role === 'MEMBER' && item.metadata?.action === REFUND_ASSIGNED_ACTION && receptionistId) {
        const receptionistName = metaString(item, 'receptionistName');
        const draft = refundChatDraft(receptionistName, metaString(item, 'paymentId') ?? '');
        return { kind: 'refundChat', route: ROUTES.chatThread(receptionistId, receptionistName, draft) };
      }
      return { kind: 'payments', route: ROUTES.payments };
    }
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
      return { kind: 'payments', route: ROUTES.payments };
    // Giáo án mới của HLV nằm ở chi tiết lớp (thẻ "Giáo án tập luyện")
    case 'TRAINING_PLAN_ASSIGNED': {
      const classId = metaString(item, 'classId');
      return classId ? { kind: 'class', route: ROUTES.classDetail(classId) } : null;
    }
    default:
      return null;
  }
}

export function resolveNotificationRoute(item: AppNotification, role?: Role): Href | null {
  return resolveNotificationTarget(item, role)?.route ?? null;
}

const LABEL: Record<Exclude<NotificationTargetKind, 'schedule'>, string> = {
  chat: ACTION.chat,
  refundChat: ACTION.refundChat,
  class: ACTION.class,
  plans: ACTION.plans,
  attendance: ACTION.attendance,
  payments: ACTION.payments,
  coachChanges: ACTION.coachChanges,
  leave: ACTION.leave,
};

/** Nhãn nút hành động: lịch học đổi theo vai trò (web: "Xem lịch tập" cho hội viên, "Xem lịch dạy" cho HLV) */
export function notificationActionLabel(kind: NotificationTargetKind, role?: Role): string {
  if (kind === 'schedule') return role === 'COACH' ? ACTION.scheduleCoach : ACTION.scheduleMember;
  return LABEL[kind];
}
