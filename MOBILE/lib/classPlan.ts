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

export type SessionTone = 'booked' | 'completed' | 'full' | 'conflict' | 'none';

/** Nhãn trạng thái một buổi trong khóa — giống sessionLabel của web (ClassDetailPage) */
export function sessionStatusLabel(session: CoursePlan['sessions'][number]): { text: string; tone: SessionTone } {
  if (session.myEnrollmentStatus === 'BOOKED') return { text: 'Đã đặt', tone: 'booked' };
  if (session.myEnrollmentStatus === 'COMPLETED') return { text: 'Đã hoàn thành', tone: 'completed' };
  if (session.isFull) return { text: 'Hết chỗ', tone: 'full' };
  if (session.conflictWith) return { text: `Trùng giờ với ${session.conflictWith.className}`, tone: 'conflict' };
  return { text: 'Chưa đặt', tone: 'none' };
}

/** Buổi hết chỗ, còn ở tương lai và mình chưa có chỗ → được vào danh sách chờ (web: WaitlistAction) */
export function canJoinSessionWaitlist(session: CoursePlan['sessions'][number], now = Date.now()) {
  return session.isFull && session.status === 'SCHEDULED' && Date.parse(session.startTime) > now
    && !['BOOKED', 'COMPLETED'].includes(session.myEnrollmentStatus ?? '');
}

/** Tình trạng chỗ trống của khóa (tính trên các buổi sắp tới BE trả về) */
export function courseAvailability(course: Course, lowThreshold: number): { text: string; tone: AvailabilityTone } {
  const { fullSessionCount, minRemainingSlots } = course.availability;
  if (course.totalSessions > 0 && fullSessionCount >= course.totalSessions) return { text: 'Đã kín chỗ', tone: 'full' };
  if (fullSessionCount > 0) return { text: `${fullSessionCount}/${course.totalSessions} buổi đã kín chỗ`, tone: 'limited' };
  if (minRemainingSlots <= lowThreshold) return { text: `Sắp kín · còn ${minRemainingSlots} chỗ`, tone: 'limited' };
  return { text: `Còn ${minRemainingSlots} chỗ trống`, tone: 'open' };
}

/** Nút cố định dưới đáy màn chi tiết lớp (hội viên): đã đủ khóa / đăng ký / xem gói / chưa thể đăng ký */
export type CourseFooterKind = 'registered' | 'enroll' | 'plans' | 'blocked';
export function courseFooterKind(input: { isFullyRegistered: boolean; eligible: boolean; needsMembership: boolean }): CourseFooterKind {
  if (input.isFullyRegistered) return 'registered';
  if (input.eligible) return 'enroll';
  return input.needsMembership ? 'plans' : 'blocked';
}

/** Trạng thái khung quota ở Lớp của tôi — web: chưa có gói hoặc limit 0 (gói FREE) thì khóa và mời mua gói */
export type QuotaBannerKind = 'locked' | 'full' | 'available';
export function quotaBannerKind(quota: { hasActiveSubscription: boolean; limit: number; remaining: number }): QuotaBannerKind {
  if (!quota.hasActiveSubscription || quota.limit === 0) return 'locked';
  return quota.remaining > 0 ? 'available' : 'full';
}
