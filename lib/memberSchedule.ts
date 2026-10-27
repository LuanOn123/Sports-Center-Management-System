// lib/memberSchedule.ts
// Buổi học của hội viên hiện trên lịch: các lượt đăng ký còn hiệu lực (đã đặt / đã hoàn thành).
// Lượt đã hủy không hiện trên lịch — xem ở "Lớp của tôi" (tab Lịch → Lớp của tôi → Đã hủy).

import { Colors } from '../constants/theme';
import type { Enrollment } from './types';

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

/** Nhãn trạng thái trên thẻ buổi: đã đặt (sắp tới) / đã diễn ra (đặt nhưng đã qua giờ) / hoàn thành */
export function memberSessionBadge(enrollment: Enrollment, now = Date.now()) {
  if (enrollment.status === 'COMPLETED') return { label: 'Hoàn thành', color: Colors.status.completed };
  if (isSessionPast(enrollment.schedule?.endTime, now)) return { label: 'Đã diễn ra', color: Colors.text.muted };
  return { label: 'Đã đặt', color: Colors.status.booked };
}

/** Chỉ hủy được buổi đã đặt và chưa diễn ra */
export function canCancelSession(enrollment: Enrollment, now = Date.now()) {
  return enrollment.status === 'BOOKED' && !isSessionPast(enrollment.schedule?.endTime, now);
}
