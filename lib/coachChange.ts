// lib/coachChange.ts
// Quy tắc thuần cho "Đổi HLV theo buổi" — khớp BE coach-changes.service + web CoachChangesPage

import { COACH_CHANGE_REASON_MAX, COACH_CHANGE_REASON_MIN, type CoachChangeFilter } from '../constants/coachChanges';
import { formatTime, formatWeekdayDate } from './format';

/** Lỗi lý do (null = hợp lệ). Chuỗi rỗng chưa báo lỗi để form không đỏ ngay khi mở. */
export function coachChangeReasonError(reason: string): string | null {
  const length = reason.trim().length;
  if (!length) return null;
  if (length < COACH_CHANGE_REASON_MIN) return `Lý do cần ít nhất ${COACH_CHANGE_REASON_MIN} ký tự.`;
  if (length > COACH_CHANGE_REASON_MAX) return `Lý do tối đa ${COACH_CHANGE_REASON_MAX} ký tự.`;
  return null;
}

export function canSubmitCoachChange(scheduleId: string, reason: string) {
  const length = reason.trim().length;
  return Boolean(scheduleId) && length >= COACH_CHANGE_REASON_MIN && length <= COACH_CHANGE_REASON_MAX;
}

export function filterCoachChanges<T extends { status: string }>(rows: T[], filter: CoachChangeFilter): T[] {
  return filter === 'ALL' ? rows : rows.filter((row) => row.status === filter);
}

/** "T5, 29/10/2026 · 08:00–09:30" */
export function formatSessionWindow(startTime: string, endTime: string) {
  return `${formatWeekdayDate(startTime)} · ${formatTime(startTime)}–${formatTime(endTime)}`;
}
