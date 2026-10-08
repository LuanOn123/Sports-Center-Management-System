// hooks/member/useEnrollments.ts
// Business logic cho enrollments của hội viên — React Query + mutations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyEnrollments, cancelEnrollment, transferEnrollment, getMyQuota, enrollWholeCourse, enrollSchedule } from '../../services/enrollmentService';
import { showAlert, showConfirm } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import type { ConcurrentClassQuota, Enrollment } from '../../lib/types';

export function useMyEnrollments(status?: string, limit?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-enrollments', status, limit],
    queryFn: () => getMyEnrollments(status, limit),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
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

/** Hook lấy quota lớp học song song của hội viên — GET /enrollments/my/quota */
export function useMyQuota() {
  return useQuery<{ data: ConcurrentClassQuota }, Error, ConcurrentClassQuota>({
    queryKey: ['enrollment-quota'],
    queryFn: getMyQuota,
    select: (res) => res.data,
    staleTime: 60_000, // 1 phút — quota thay đổi khi book/cancel
  });
}

/** Hook cancel enrollment với confirm dialog */
export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: cancelEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-quota'] });
      showAlert('Thành công', 'Đã hủy đăng ký ca học thành công.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Hủy thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  const handleCancel = (id: string, className?: string) => {
    const classDisplay = className ? `"${className}"` : 'này';
    showConfirm(
      'Xác nhận Hủy Đăng Ký Ca Học',
      `Bạn có chắc chắn muốn hủy đăng ký lớp ${classDisplay}? Sau khi hủy, chỗ trống sẽ được nhường lại cho học viên khác.`,
      () => mutation.mutate(id),
      undefined,
      'Đồng ý hủy',
      true
    );
  };

  return { handleCancel, isPending: mutation.isPending };
}

/** Hook transfer enrollment sang schedule khác */
export function useTransferEnrollment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, targetScheduleId }: { id: string; targetScheduleId: string }) =>
      transferEnrollment(id, targetScheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments-upcoming'] });
      showAlert('Đổi buổi thành công', 'Ca học của bạn đã được chuyển sang buổi mới.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Đổi buổi học thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  return mutation;
}

/**
 * Hook đăng ký trọn khóa — POST /enrollments/bulk (all-or-nothing).
 * Parse chi tiết lỗi từ BE 409 COURSE_ENROLLMENT_FAILED và hiện thành thông báo rõ ràng.
 */
export function useEnrollWholeCourse() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (classId: string) => enrollWholeCourse(classId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-quota'] });
      const d = res.data;
      const lines: string[] = [];
      if (d.enrolled > 0) lines.push(`Đăng ký mới: ${d.enrolled} buổi`);
      if (d.reactivated > 0) lines.push(`Kích hoạt lại: ${d.reactivated} buổi`);
      if (d.alreadyBooked > 0) lines.push(`Đã đặt trước: ${d.alreadyBooked} buổi`);
      showAlert(
        'Đăng ký trọn khóa thành công',
        lines.join('\n') || `Đã xử lý ${d.totalSessions} buổi học.`
      );

    },
    onError: (e) => {
      if (e instanceof ApiError) {
        // Thử parse errors.details[] từ BE 409 COURSE_ENROLLMENT_FAILED
        const details = (e.errors as any)?.[0]?.details;
        if (Array.isArray(details) && details.length > 0) {
          const firstDetail = details[0];
          showAlert('Không thể đăng ký trọn khóa', firstDetail.message ?? e.message);
        } else {
          showAlert('Không thể đăng ký trọn khóa', e.message);
        }
      } else {
        showAlert('Lỗi', 'Đăng ký trọn khóa thất bại. Vui lòng thử lại.');
      }
    },
  });

  const handleEnrollWholeCourse = (classId: string, className: string) => {
    showConfirm(
      'Đăng ký trọn khóa',
      `Đăng ký toàn bộ các buổi học sắp tới của lớp "${className}"?\n\nThao tác này áp dụng tất cả hoặc không buổi nào.`,
      () => mutation.mutate(classId),
      undefined,
      'Đăng ký ngay'
    );
  };

  return { handleEnrollWholeCourse, isPending: mutation.isPending };
}

/** Hook đặt một buổi học — POST /enrollments */
export function useBookSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) => enrollSchedule(scheduleId),
    onSuccess: (_res, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-quota'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    },
  });
}
