// hooks/coach/useCoachSchedules.ts
// Lớp phụ trách + lịch dạy của HLV trong một khoảng thời gian — dùng chung cho
// Trang chủ, Lịch dạy và Điểm danh (trước đây mỗi màn tự tải & lọc lại)

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoachClasses, getCoachSchedules, type ScheduleRange } from '../../services/coachService';
import type { Class, ClassSchedule } from '../../lib/types';

export function useCoachClasses(coachId: string | undefined) {
  return useQuery({
    queryKey: ['coach', coachId, 'classes'],
    queryFn: () => getCoachClasses(coachId!),
    enabled: Boolean(coachId),
  });
}

/** `range` nên được useMemo ở nơi gọi để queryKey ổn định */
export function useCoachSchedules(coachId: string | undefined, range: ScheduleRange) {
  const classesQuery = useCoachClasses(coachId);
  const classes: Class[] = classesQuery.data?.data ?? [];
  const classIds = useMemo(() => classes.map((c) => c.id).sort(), [classes]);

  const schedulesQuery = useQuery({
    queryKey: ['coach', coachId, 'schedules', classIds, range.startAfter, range.startBefore, range.status],
    queryFn: () => getCoachSchedules(classIds, range),
    enabled: Boolean(coachId) && classesQuery.isSuccess,
  });

  const schedules: ClassSchedule[] = schedulesQuery.data ?? [];

  return {
    classes,
    schedules,
    isLoading: classesQuery.isLoading || (classesQuery.isSuccess && schedulesQuery.isLoading),
    isError: classesQuery.isError || schedulesQuery.isError,
    error: classesQuery.error ?? schedulesQuery.error,
    refetch: async () => {
      await classesQuery.refetch();
      await schedulesQuery.refetch();
    },
  };
}
