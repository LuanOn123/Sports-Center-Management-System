// hooks/coach/useCoachScheduleScreen.ts
// Logic màn Lịch dạy của HLV — theo FE web (CoachWorkspace mode "schedule"): xem theo Tuần hoặc Tháng, lọc lớp + trạng thái.
// Khung lịch (kỳ đang xem, ngày chọn, điều hướng) dùng chung với Hội viên: hooks/shared/useScheduleCalendar.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCoachSchedules } from './useCoachSchedules';
import { useScheduleCalendar } from '../shared/useScheduleCalendar';
import type { ScheduleStatus } from '../../lib/types';

export function useCoachScheduleScreen(coachId: string | undefined) {
  const calendar = useScheduleCalendar();
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | null>(null);

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

  const sessions = useMemo(
    () => schedules.filter((s) => (!classFilter || s.classId === classFilter) && (!statusFilter || s.status === statusFilter)),
    [schedules, classFilter, statusFilter],
  );

  return {
    calendar,
    sessions,
    classes,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    classFilter,
    setClassFilter,
    statusFilter,
    setStatusFilter,
  };
}
