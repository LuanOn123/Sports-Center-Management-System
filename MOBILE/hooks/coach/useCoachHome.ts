// hooks/coach/useCoachHome.ts
// Logic cho Trang chủ Huấn luyện viên — lớp phụ trách + lịch dạy sắp tới

import { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCoachSchedules } from './useCoachSchedules';
import { COACH_UPCOMING_DAYS } from '../../constants/schedule';
import { daysFromNow, endOfDay, startOfDay } from '../../lib/date';
import { Haptic } from '../../lib/haptics';

export function useCoachHome(coachId: string | undefined) {
  // Tính theo ngày (không theo giây) để queryKey ổn định giữa các lần render
  const todayKey = startOfDay(new Date()).toISOString();
  const range = useMemo(
    () => ({
      startAfter: todayKey,
      startBefore: endOfDay(daysFromNow(COACH_UPCOMING_DAYS)).toISOString(),
      status: 'SCHEDULED' as const,
    }),
    [todayKey]
  );

  const { classes, schedules, isLoading, refetch } = useCoachSchedules(coachId, range);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [coachId, range])
  );

  // Buổi chưa kết thúc (buổi đang diễn ra vẫn hiện)
  const teachingSchedules = schedules.filter((s) => Date.parse(s.endTime) >= Date.now());

  const onRefresh = async () => {
    Haptic.light();
    await refetch();
  };

  return {
    coachClasses: classes,
    teachingSchedules,
    isLoading,
    classesLoading: isLoading,
    onRefresh,
  };
}
