// lib/coachRoster.ts
// Danh sách học viên của một buổi dạy (GET /enrollments/schedule/:id) — lọc theo ô tìm kiếm và lấy ghi chú sức khỏe,
// giống web (features/coach/CoachWorkspace.tsx: SessionDetails).

import type { Enrollment } from './types';

/** Lọc học viên theo tên hoặc email, không phân biệt hoa thường (web: ô "Tìm học viên") */
export function filterRoster<T extends Pick<Enrollment, 'member'>>(roster: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('vi');
  if (!q) return [...roster];
  return roster.filter((e) => `${e.member?.user?.fullName ?? ''} ${e.member?.user?.email ?? ''}`.toLocaleLowerCase('vi').includes(q));
}

/** Lưu ý sức khỏe của học viên: ghi chú ở lần đăng ký ưu tiên hơn ghi chú trong hồ sơ (web: r.healthNotes || member.healthNotes) */
export function rosterHealthNotes(e: Pick<Enrollment, 'healthNotes' | 'member'>) {
  return (e.healthNotes || e.member?.healthNotes || '').trim();
}
