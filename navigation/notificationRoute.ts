// navigation/notificationRoute.ts
// Suy ra màn cần mở khi bấm vào một thông báo (tin nhắn → đoạn chat, lịch học → đúng buổi/lớp)

import type { Href } from 'expo-router';
import { ROUTES } from './routes';
import type { AppNotification } from '../lib/types';

function metaString(item: AppNotification, key: string): string | undefined {
  const v = item.metadata?.[key];
  return typeof v === 'string' ? v : undefined;
}

export function resolveNotificationRoute(item: AppNotification): Href | null {
  switch (item.type) {
    case 'CHAT_MESSAGE': {
      const senderId = metaString(item, 'senderId');
      return senderId ? ROUTES.chatThread(senderId) : null;
    }
    case 'UPCOMING_CLASS':
    case 'ENROLLMENT_CONFIRMED':
    case 'ENROLLMENT_CANCELLED':
    case 'SCHEDULE_CANCELLED':
    case 'SCHEDULE_UPDATED':
    case 'SCHEDULE_ROOM_CHANGED': {
      const scheduleId = metaString(item, 'scheduleId');
      if (scheduleId) return ROUTES.scheduleDetail(scheduleId);
      const classId = metaString(item, 'classId');
      return classId ? ROUTES.classDetail(classId) : null;
    }
    // GOAL_PROGRESS_UPDATED: HLV vừa đánh giá tiến độ → thẻ "Mục tiêu & tiến độ" nằm ở chi tiết lớp
    case 'NEW_CLASS':
    case 'COACH_CHANGED':
    case 'GOAL_PROGRESS_UPDATED': {
      const classId = metaString(item, 'classId');
      return classId ? ROUTES.classDetail(classId) : null;
    }
    // Gói sắp hết hạn / đã hết hạn / đã hủy — mở màn gói thành viên để gia hạn hoặc mua gói mới
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_CANCELLED':
      return ROUTES.membershipPlans;
    // Cảnh báo/hình phạt chuyên cần — mở màn "Chuyên cần & Điểm danh" của Member
    case 'ATTENDANCE_WARNING':
    case 'ATTENDANCE_PENALTY':
    case 'ATTENDANCE_PENALTY_REVOKED':
      return ROUTES.myAttendance;
    // Đổi HLV theo buổi: duyệt → mở buổi học (người gửi lẫn HLV thay thế đều nhận); từ chối → danh sách yêu cầu của HLV
    case 'COACH_CHANGE_APPROVED': {
      const scheduleId = metaString(item, 'scheduleId');
      return scheduleId ? ROUTES.scheduleDetail(scheduleId) : ROUTES.coachChanges;
    }
    case 'COACH_CHANGE_REJECTED':
      return ROUTES.coachChanges;
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
    case 'PAYMENT_REFUNDED':
      return ROUTES.payments;
    // Chưa có màn hình xem kế hoạch tập cho Member — chỉ đánh dấu đã đọc.
    case 'TRAINING_PLAN_ASSIGNED':
    default:
      return null;
  }
}
