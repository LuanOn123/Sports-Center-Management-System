// hooks/member/useEnrollments.ts
// Business logic cho enrollments của hội viên — React Query + mutations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyEnrollments, cancelEnrollment } from '../../services/enrollmentService';
import { showAlert, showConfirm } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import type { Enrollment } from '../../lib/types';

export function useMyEnrollments(status?: string) {
  return useQuery({
    queryKey: ['my-enrollments', status],
    queryFn: () => getMyEnrollments(status),
    placeholderData: (prev) => prev,
  });
}

/** Hook dùng cho màn hình Home (chỉ lấy upcoming BOOKED) */
export function useUpcomingEnrollments() {
  const query = useQuery({
    queryKey: ['my-enrollments-upcoming'],
    queryFn: () => getMyEnrollments('BOOKED'),
  });
  const upcoming: Enrollment[] = query.data?.data?.slice(0, 3) ?? [];
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
