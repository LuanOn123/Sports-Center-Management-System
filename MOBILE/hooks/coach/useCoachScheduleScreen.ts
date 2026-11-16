// hooks/coach/useCoachScheduleScreen.ts
// Logic màn Lịch dạy của HLV — theo FE web (CoachWorkspace mode "schedule"): xem theo Tuần hoặc Tháng, lọc lớp + trạng thái
// (quy tắc lọc ở lib/scheduleFilters; bảng "Bộ lọc" ở components/coach/ScheduleFilterSheet).
// Khung lịch (kỳ đang xem, ngày chọn, điều hướng) dùng chung với Hội viên: hooks/shared/useScheduleCalendar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCoachSchedules } from './useCoachSchedules';
import { useScheduleCalendar } from '../shared/useScheduleCalendar';
import { calendarClasses } from '../../lib/coachSchedule';
import { activeScheduleFilters, filterSchedules, scheduleFilterCount, type ScheduleFilterKey } from '../../lib/scheduleFilters';
import type { ScheduleStatus } from '../../lib/types';

/** `initialClassId`: mở từ "Xem lịch dạy" của một lớp (web: /coach/schedule?classId=…) → lọc sẵn lớp đó */
export function useCoachScheduleScreen(coachId: string | undefined, initialClassId?: string) {
  const calendar = useScheduleCalendar();
  const [classFilter, setClassFilter] = useState<string | null>(initialClassId || null);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | null>(null);

  // Tab giữ nguyên màn hình giữa các lần mở nên bộ lọc phải áp lại mỗi khi có lớp mới được chọn từ thẻ lớp
  useEffect(() => {
    if (initialClassId) setClassFilter(initialClassId);
  }, [initialClassId]);

  // Chỉ tải các buổi trong kỳ đang xem (tuần: T2 → CN, tháng: mùng 1 → ngày cuối) — giống web
  const { period } = calendar;
  const range = useMemo(
    () => ({ startAfter: period.start.toISOString(), startBefore: period.end.toISOString() }),
    [period],
  );

  const { classes, schedules, isLoading, isFetching, isError, error, refetch } = useCoachSchedules(coachId, range);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [coachId, range]),
  );

  // Bộ lọc lớp gồm cả lớp có buổi dạy thay trong lịch (HLV dạy thay không được phân công lớp đó)
  const filterClasses = useMemo(() => calendarClasses(classes, schedules), [classes, schedules]);

  const sessions = useMemo(
    () => filterSchedules(schedules, { classId: classFilter, status: statusFilter }),
    [schedules, classFilter, statusFilter],
  );

  const filterState = { classId: classFilter, status: statusFilter };
  /** Số bộ lọc trong bảng "Bộ lọc" (lớp, trạng thái) — hiện trên hàng "Bộ lọc" */
  const filterCount = scheduleFilterCount(filterState);
  /** Bộ lọc đang bật, mỗi cái một chip gỡ được ở màn chính */
  const activeFilters = activeScheduleFilters(filterState, filterClasses);
  const clearFilters = () => {
    setClassFilter(null);
    setStatusFilter(null);
  };
  const clearFilter = (key: ScheduleFilterKey) => (key === 'class' ? setClassFilter(null) : setStatusFilter(null));

  return {
    calendar,
    sessions,
    classes: filterClasses,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    classFilter,
    setClassFilter,
    statusFilter,
    setStatusFilter,
    filterCount,
    activeFilters,
    clearFilter,
    clearFilters,
  };
}
