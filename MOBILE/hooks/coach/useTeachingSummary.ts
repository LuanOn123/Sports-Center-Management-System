// hooks/coach/useTeachingSummary.ts
// Tổng quan buổi dạy của HLV theo Tuần hoặc Tháng (web: CoachWorkspace mode "dashboard"): khung lịch dùng chung với Lịch dạy
// (hooks/shared/useScheduleCalendar), lịch dạy hiệu lực do BE tính, số liệu ở lib/scheduleAnalytics.

import { useMemo } from 'react';
import { useCoachSchedules } from './useCoachSchedules';
import { useScheduleCalendar } from '../shared/useScheduleCalendar';
import { summarizeSchedules } from '../../lib/scheduleAnalytics';

export function useTeachingSummary(coachId: string | undefined) {
  const calendar = useScheduleCalendar();
  const { period } = calendar;
  // Chỉ tải các buổi trong kỳ đang xem (tuần: T2 → CN, tháng: mùng 1 → ngày cuối) — giống web
  const range = useMemo(() => ({ startAfter: period.start.toISOString(), startBefore: period.end.toISOString() }), [period]);
  const data = useCoachSchedules(coachId, range);
  const summary = useMemo(() => summarizeSchedules(data.schedules), [data.schedules]);

  return {
    calendar,
    summary,
    isLoading: data.isLoading,
    isError: data.isError,
    error: data.error,
    refetch: data.refetch,
  };
}
