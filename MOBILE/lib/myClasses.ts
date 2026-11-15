// lib/myClasses.ts
// Phân nhóm lớp đã đăng ký theo ba tab của "Lớp của tôi" (web: MyClassesPage): Sắp tới | Hoàn thành | Đã hủy.

import type { Enrollment } from './types';

export type MyClassesTab = 'upcoming' | 'completed' | 'cancelled';

/** Buổi đã kết thúc: có giờ kết thúc và giờ đó đã qua */
export function isSchedulePast(endTime?: string, now = Date.now()) {
  return Boolean(endTime) && new Date(endTime!).getTime() < now;
}

/** Mốc bắt đầu của lượt đăng ký; chưa có buổi thì lấy lúc đặt */
const startOf = (e: Enrollment) => new Date(e.schedule?.startTime ?? e.bookedAt).getTime();

/**
 * Sắp tới: đã đặt và buổi chưa kết thúc (gần nhất trước).
 * Hoàn thành: đã hoàn thành, hoặc đã đặt nhưng buổi đã kết thúc (mới nhất trước).
 * Đã hủy: đã hủy (mới nhất trước).
 */
export function groupEnrollments(all: Enrollment[], now = Date.now()): Record<MyClassesTab, Enrollment[]> {
  const ended = (e: Enrollment) => isSchedulePast(e.schedule?.endTime, now);
  return {
    upcoming: all.filter((e) => e.status === 'BOOKED' && !ended(e)).sort((a, b) => startOf(a) - startOf(b)),
    completed: all.filter((e) => e.status === 'COMPLETED' || (e.status === 'BOOKED' && ended(e))).sort((a, b) => startOf(b) - startOf(a)),
    cancelled: all.filter((e) => e.status === 'CANCELLED').sort((a, b) => startOf(b) - startOf(a)),
  };
}
