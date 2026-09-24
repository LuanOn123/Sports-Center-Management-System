// hooks/member/useAttendanceHistory.ts
// Lịch sử điểm danh + tỉ lệ chuyên cần + hình phạt của chính hội viên — React Query

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyAttendance, getMyAttendanceSummary, appealAttendancePenalty } from '../../services/memberService';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';

export function useMyAttendance() {
  return useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => getMyAttendance({ limit: '50' }),
  });
}

export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ['my-attendance-summary'],
    queryFn: getMyAttendanceSummary,
  });
}

export function useAppealPenalty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => appealAttendancePenalty(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      showAlert('Đã gửi', 'Khiếu nại của bạn đã được ghi nhận.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Gửi khiếu nại thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });
}
