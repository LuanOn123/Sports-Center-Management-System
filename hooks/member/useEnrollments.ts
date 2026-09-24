// hooks/member/useEnrollments.ts
// Business logic cho enrollments của hội viên — React Query + mutations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyEnrollments, cancelEnrollment } from '../../services/enrollmentService';
import { showAlert, showConfirm } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import type { Enrollment } from '../../lib/types';

export function useMyEnrollments(status?: string, limit?: string) {
  return useQuery({
    queryKey: ['my-enrollments', status, limit],
    queryFn: () => getMyEnrollments(status, limit),
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook dùng cho màn hình Home (chỉ lấy upcoming BOOKED).
 * BE trả về theo `bookedAt` giảm dần (đặt gần đây nhất trước), không phải theo
 * thời gian buổi học — và enrollment vẫn ở BOOKED mãi nếu chưa ai bấm "hoàn
 * thành" ca học dù ngày học đã qua. Nên phải lấy nhiều bản ghi hơn rồi tự lọc
 * theo `schedule.endTime >= now` và sắp lại theo `startTime` mới ra đúng lịch
 * sắp tới, thay vì tin thẳng vào thứ tự/số lượng BE trả về.
 */
export function useUpcomingEnrollments() {
  const query = useQuery({
    queryKey: ['my-enrollments-upcoming'],
    queryFn: () => getMyEnrollments('BOOKED', '50'),
  });

  const now = Date.now();
  const upcoming: Enrollment[] = (query.data?.data ?? [])
    .filter((e) => e.schedule && new Date(e.schedule.endTime).getTime() >= now)
    .sort((a, b) => new Date(a.schedule!.startTime).getTime() - new Date(b.schedule!.startTime).getTime())
    .slice(0, 2);

  return { ...query, upcoming };
}

/** Hook cancel enrollment với confirm dialog */
export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: cancelEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Hủy thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  const handleCancel = (id: string) => {
    showConfirm(
      'Xác nhận hủy',
      'Bạn có chắc muốn hủy đăng ký lớp học này?',
      () => mutation.mutate(id),
      undefined,
      'Hủy đăng ký',
      true
    );
  };

  return { handleCancel, isPending: mutation.isPending };
}
