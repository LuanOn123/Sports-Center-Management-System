// hooks/shared/useScheduleDetail.ts
// Chi tiết một buổi học + số chỗ còn lại (dùng chung Member + Coach)

import { useQuery } from '@tanstack/react-query';
import { getScheduleById } from '../../services/scheduleService';
import { useOwningFacility } from './useOwningFacility';

export function useScheduleDetail(scheduleId: string | undefined) {
  const query = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => getScheduleById(scheduleId!),
    enabled: Boolean(scheduleId),
  });

  // Buổi học của cơ sở khác (vd. bấm thông báo huỷ / đổi phòng) → BE 403 FORBIDDEN_SCOPE → dò cơ sở chủ
  const facilityScope = useOwningFacility(scheduleId ? `/class-schedules/${encodeURIComponent(scheduleId)}` : undefined, query.error);
  const schedule = query.data?.data ?? null;
  const slotsUsed = schedule?._count?.enrollments ?? 0;
  const slotsLeft = schedule ? (schedule.class?.capacity ?? 0) - slotsUsed : 0;

  return {
    schedule,
    facilityScope,
    isLoading: query.isLoading,
    refetch: query.refetch,
    slotsLeft,
    isFull: Boolean(schedule) && slotsLeft <= 0,
    isPast: schedule ? Date.parse(schedule.startTime) < Date.now() : false,
  };
}
