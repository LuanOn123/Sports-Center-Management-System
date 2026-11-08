// hooks/coach/useCoachSchedules.ts
// Lớp phụ trách + lịch dạy của HLV trong một khoảng thời gian — dùng chung cho
// Trang chủ, Lịch dạy và Điểm danh (trước đây mỗi màn tự tải & lọc lại).
// Lịch dạy do BE tính theo người dạy hiệu lực (kể cả buổi dạy thay), KHÔNG suy ra từ danh sách lớp được phân công.

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
  // Lớp được phân công dài hạn — chỉ để đếm "Lớp phụ trách" và làm bộ lọc, lịch dạy không phụ thuộc danh sách này
  const classesQuery = useCoachClasses(coachId);
  const classes: Class[] = classesQuery.data?.data ?? [];

  const schedulesQuery = useQuery({
    queryKey: ['coach', coachId, 'schedules', range.startAfter, range.startBefore, range.status],
    queryFn: ({ signal }) => getCoachSchedules(coachId!, range, signal),
    enabled: Boolean(coachId),
  });

  const schedules: ClassSchedule[] = schedulesQuery.data ?? [];

  return {
    classes,
    schedules,
    isLoading: classesQuery.isLoading || schedulesQuery.isLoading,
    isFetching: classesQuery.isFetching || schedulesQuery.isFetching,
    isError: classesQuery.isError || schedulesQuery.isError,
    error: classesQuery.error ?? schedulesQuery.error,
    refetch: async () => {
      await Promise.all([classesQuery.refetch(), schedulesQuery.refetch()]);
    },
  };
}
