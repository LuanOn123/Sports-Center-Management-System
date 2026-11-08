// hooks/coach/useScheduleEvaluations.ts
// Mục tiêu và tiến độ của từng học viên trong một buổi dạy + lưu đánh giá của HLV (web: evQuery trong shared/Attendance.tsx).
// Đánh giá độc lập với điểm danh: HLV phụ trách chấm bất kỳ lúc nào, BE cập nhật mục tiêu và báo cho hội viên.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getScheduleEvaluations, saveScheduleEvaluation } from '../../services/goalService';
import type { SaveEvaluationPayload } from '../../lib/types';

export function useScheduleEvaluations(scheduleId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['schedule-evaluations', scheduleId],
    enabled: Boolean(scheduleId),
    queryFn: ({ signal }) => getScheduleEvaluations(scheduleId!, signal),
  });
  const items = query.data?.data ?? [];
  return {
    items,
    itemFor: (memberId: string) => items.find((item) => item.memberId === memberId),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSaveEvaluation(scheduleId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveEvaluationPayload) => saveScheduleEvaluation(scheduleId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-evaluations', scheduleId] }),
  });
}
