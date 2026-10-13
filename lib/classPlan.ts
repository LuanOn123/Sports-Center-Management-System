// lib/classPlan.ts
// Tóm tắt "kế hoạch khóa học" (GET /classes/:id/course-plan) để hiển thị: khung giờ trong tuần,
// tình trạng chỗ trống. Chỉ dùng trường BE thật sự trả về.

import type { CoursePlan, CoursePlanSlot } from './types';

type Course = NonNullable<CoursePlan['course']>;

export type AvailabilityTone = 'open' | 'limited' | 'full';

/** "Thứ 2 · 18:00–19:30" (+ " · Phòng Yoga" nếu withRoom) */
export function formatSlot(slot: CoursePlanSlot, withRoom = false) {
  return `${slot.weekdayLabel} · ${slot.startTime}–${slot.endTime}${withRoom && slot.roomName ? ` · ${slot.roomName}` : ''}`;
}

/** Tách khung giờ để xem trước trên thẻ: hiện `limit` khung đầu, số còn lại gộp thành "+n" */
export function previewSlots(slots: CoursePlanSlot[] | undefined, limit: number) {
  const list = slots ?? [];
  return { shown: list.slice(0, limit), hiddenCount: Math.max(0, list.length - limit) };
}

/** Tình trạng chỗ trống của khóa (tính trên các buổi sắp tới BE trả về) */
export function courseAvailability(course: Course, lowThreshold: number): { text: string; tone: AvailabilityTone } {
  const { fullSessionCount, minRemainingSlots } = course.availability;
  if (course.totalSessions > 0 && fullSessionCount >= course.totalSessions) return { text: 'Đã kín chỗ', tone: 'full' };
  if (fullSessionCount > 0) return { text: `${fullSessionCount}/${course.totalSessions} buổi đã kín chỗ`, tone: 'limited' };
  if (minRemainingSlots <= lowThreshold) return { text: `Sắp kín · còn ${minRemainingSlots} chỗ`, tone: 'limited' };
  return { text: `Còn ${minRemainingSlots} chỗ trống`, tone: 'open' };
}
