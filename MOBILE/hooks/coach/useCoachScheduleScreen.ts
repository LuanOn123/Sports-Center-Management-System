// hooks/coach/useCoachScheduleScreen.ts
// Logic màn Lịch dạy của HLV — theo FE web (CoachWorkspace mode "schedule"):
// xem theo tuần (T2 → CN), lọc lớp + trạng thái, chế độ Theo tuần / Danh sách

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCoachSchedules } from './useCoachSchedules';
import { addDays, endOfDay, isSameDay, startOfWeek, weekDays } from '../../lib/date';
import type { ScheduleStatus } from '../../lib/types';

export type ScheduleViewMode = 'week' | 'list';

export function useCoachScheduleScreen(coachId: string | undefined) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | null>(null);
  const [mode, setMode] = useState<ScheduleViewMode>('week');

  const weekKey = weekStart.getTime();
  const days = useMemo(() => weekDays(weekStart), [weekKey]);
  const range = useMemo(
    () => ({ startAfter: days[0].toISOString(), startBefore: endOfDay(days[6]).toISOString() }),
    [days]
  );

  const { classes, schedules, isLoading, isError, error, refetch } = useCoachSchedules(coachId, range);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [coachId, range])
  );

  const filtered = schedules.filter(
    (s) => (!classFilter || s.classId === classFilter) && (!statusFilter || s.status === statusFilter)
  );
  const byDay = days.map((date) => ({
    date,
    items: filtered.filter((s) => isSameDay(new Date(s.startTime), date)),
  }));

  return {
    days,
    byDay,
    sessions: filtered,
    classes,
    isLoading,
    isError,
    error,
    refetch,
    isCurrentWeek: isSameDay(weekStart, startOfWeek(new Date())),
    prevWeek: () => setWeekStart((d) => addDays(d, -7)),
    nextWeek: () => setWeekStart((d) => addDays(d, 7)),
    thisWeek: () => setWeekStart(startOfWeek(new Date())),
    classFilter,
    setClassFilter,
    statusFilter,
    setStatusFilter,
    mode,
    setMode,
  };
}
