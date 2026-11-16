// lib/scheduleFilters.ts
// Bộ lọc của Lịch dạy HLV (web: hai ô chọn "Lớp học" và "Trạng thái" trong CoachWorkspace mode "schedule").
// Trên mobile hai bộ lọc nằm trong bảng "Bộ lọc"; màn chính chỉ hiện chúng thành chip gỡ được khi đang bật.

import { SCHEDULE_FILTER_TEXT, SCHEDULE_STATUS_LABEL } from '../constants/schedule';
import type { ScheduleStatus } from './types';

export type ScheduleFilterKey = 'class' | 'status';

export interface ScheduleFilterState {
  /** null = tất cả lớp của tôi */
  classId: string | null;
  /** null = tất cả trạng thái */
  status: ScheduleStatus | null;
}

export interface ActiveScheduleFilter {
  key: ScheduleFilterKey;
  label: string;
}

/** Số bộ lọc đang bật (lớp, trạng thái) */
export function scheduleFilterCount(state: ScheduleFilterState) {
  return [state.classId, state.status].filter(Boolean).length;
}

/**
 * Các bộ lọc đang bật theo thứ tự lớp → trạng thái. Lớp chưa có trong danh sách (đang tải) vẫn hiện, bằng tên nhóm lọc,
 * để chip không biến mất khi dữ liệu đang tải.
 */
export function activeScheduleFilters(state: ScheduleFilterState, classes: readonly { id: string; name: string }[]): ActiveScheduleFilter[] {
  const filters: ActiveScheduleFilter[] = [];
  if (state.classId) filters.push({ key: 'class', label: classes.find((cls) => cls.id === state.classId)?.name ?? SCHEDULE_FILTER_TEXT.class });
  if (state.status) filters.push({ key: 'status', label: SCHEDULE_STATUS_LABEL[state.status] });
  return filters;
}

/** Các buổi khớp bộ lọc: đúng lớp và đúng trạng thái (bộ lọc trống thì không lọc theo mục đó) */
export function filterSchedules<T extends { classId: string; status: ScheduleStatus }>(schedules: readonly T[], state: ScheduleFilterState): T[] {
  return schedules.filter((schedule) => (!state.classId || schedule.classId === state.classId) && (!state.status || schedule.status === state.status));
}
