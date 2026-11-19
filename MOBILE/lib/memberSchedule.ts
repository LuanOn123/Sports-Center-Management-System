// lib/memberSchedule.ts
// Buổi học của hội viên hiện trên lịch: các lượt đăng ký còn hiệu lực (đã đặt / đã hoàn thành).
// Lượt đã hủy không hiện trên lịch — xem ở "Lớp của tôi" (tab Lịch → Lớp của tôi → Đã hủy).

import { Colors } from '../constants/theme';
import { dayKey } from './date';
import type { Enrollment, ScheduleStatus } from './types';

export interface MemberCalendarEvent {
  id: string;
  startTime: string;
  enrollment: Enrollment;
}

export function memberCalendarEvents(enrollments: readonly Enrollment[]): MemberCalendarEvent[] {
  return enrollments
    .filter((e) => e.schedule && (e.status === 'BOOKED' || e.status === 'COMPLETED'))
    .map((e) => ({ id: e.id, startTime: e.schedule!.startTime, enrollment: e }));
}

/** Đã bắt đầu từ trước và đã kết thúc */
export function isSessionPast(endTime: string | undefined, now = Date.now()) {
  return Boolean(endTime) && Date.parse(endTime!) < now;
}

/**
 * Buổi dạy của HLV đã xong: đã đánh dấu hoàn thành, hoặc vẫn "Đã lên lịch" nhưng đã qua giờ kết thúc.
 * Buổi đã hủy không tính — vẫn hiện "Đã hủy".
 */
export function isCoachSessionDone(session: { status: ScheduleStatus; endTime?: string }, now = Date.now()) {
  return session.status === 'COMPLETED' || (session.status === 'SCHEDULED' && isSessionPast(session.endTime, now));
}

/** Buổi trong hôm nay (giờ Việt Nam) và chưa bắt đầu */
export function isUpcomingToday(startTime: string | undefined, now = Date.now()) {
  if (!startTime) return false;
  const start = Date.parse(startTime);
  return start > now && dayKey(new Date(start)) === dayKey(new Date(now));
}

/**
 * Nhãn trạng thái trên thẻ buổi: sắp tới (hôm nay, chưa bắt đầu — vàng cam nổi bật) / đã đặt (ngày khác) /
 * đã diễn ra (đặt nhưng đã qua giờ) / hoàn thành
 */
export function memberSessionBadge(enrollment: Enrollment, now = Date.now()) {
  if (enrollment.status === 'COMPLETED') return { label: 'Hoàn thành', color: Colors.status.completed };
  if (isSessionPast(enrollment.schedule?.endTime, now)) return { label: 'Đã diễn ra', color: Colors.text.muted };
  if (isUpcomingToday(enrollment.schedule?.startTime, now)) return { label: 'Sắp tới', color: Colors.status.upcoming };
  return { label: 'Đã đặt', color: Colors.status.booked };
}
