// hooks/coach/useCoachAttendanceList.ts
// Danh sách buổi để chọn điểm danh (tab Điểm danh của HLV): từ COACH_ATTENDANCE_PAST_DAYS ngày trước tới COACH_ATTENDANCE_FUTURE_DAYS ngày tới,
// bỏ buổi đã hủy. Danh sách học viên của MỘT buổi là màn riêng (hooks/coach/useCoachAttendance + components/coach/CoachRosterView).

import { useMemo } from 'react';
import { useCoachSchedules } from './useCoachSchedules';
import { COACH_ATTENDANCE_FUTURE_DAYS, COACH_ATTENDANCE_PAST_DAYS } from '../../constants/schedule';
import { daysFromNow, endOfDay, startOfDay } from '../../lib/date';

export function useCoachAttendanceList(coachId: string | undefined) {
  const todayKey = startOfDay(new Date()).toISOString();
  const range = useMemo(
    () => ({
      startAfter: startOfDay(daysFromNow(-COACH_ATTENDANCE_PAST_DAYS)).toISOString(),
      startBefore: endOfDay(daysFromNow(COACH_ATTENDANCE_FUTURE_DAYS)).toISOString(),
    }),
    [todayKey]
  );
  const { schedules, isLoading, error, refetch } = useCoachSchedules(coachId, range);

  return {
    schedules: schedules.filter((s) => s.status !== 'CANCELLED'),
    isLoading,
    error,
    refresh: refetch,
  };
}
