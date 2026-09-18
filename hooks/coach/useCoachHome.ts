// hooks/coach/useCoachHome.ts
// Logic cho Trang chủ Huấn luyện viên

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { getCoachClasses, getCoachSchedules } from '../../services/coachService';
import type { Class, ClassSchedule } from '../../lib/types';

export function useCoachHome(coachId: string | undefined) {
  // 1. Lấy danh sách lớp HLV phụ trách
  const {
    data: classesData,
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['coach-home-classes', coachId],
    queryFn: () => getCoachClasses(coachId!),
    enabled: Boolean(coachId),
  });

  // 2. Lấy lịch dạy sắp tới
  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ['coach-home-schedules'],
    queryFn: () => getCoachSchedules(),
  });

  useFocusEffect(
    useCallback(() => {
      if (coachId) refetchClasses();
      refetchSchedules();
    }, [coachId, refetchClasses, refetchSchedules])
  );

  const coachClasses: Class[] = classesData?.data ?? [];
  const classIds = useMemo(() => new Set(coachClasses.map((c) => c.id)), [coachClasses]);

  // Lọc lịch dạy thuộc các lớp mà HLV phụ trách
  const teachingSchedules = useMemo(() => {
    const rawSchedules: ClassSchedule[] = schedulesData?.data ?? [];
    if (coachClasses.length === 0) return [];
    return rawSchedules
      .filter((s) => classIds.has(s.classId))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [schedulesData, classIds, coachClasses.length]);

  const onRefresh = async () => {
    await Promise.all([refetchClasses(), refetchSchedules()]);
  };

  const isLoading = classesLoading || schedulesLoading;

  return {
    coachClasses,
    teachingSchedules,
    isLoading,
    classesLoading,
    schedulesLoading,
    onRefresh,
    refetchClasses,
    refetchSchedules,
  };
}
