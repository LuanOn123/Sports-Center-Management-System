// hooks/member/useEnrollments.ts
// Business logic cho enrollments của hội viên — React Query + mutations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyEnrollments, getMyQuota, enrollWholeCourse } from '../../services/enrollmentService';
import { showAlert } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import { wholeCourseEnrollmentMessage } from '../../lib/classPlan';
import type { EnrollOptions } from '../../lib/enrollOptions';
import type { ConcurrentClassQuota, Enrollment } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';

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
    .sort((a, b) => new Date(a.schedule!.startTime).getTime() - new Date(b.schedule!.startTime).getTime());

  return { ...query, upcoming };
}

/** Hook lấy quota lớp học song song của hội viên — GET /enrollments/my/quota */
export function useMyQuota() {
  const { user } = useAuth();
  return useQuery<{ data: ConcurrentClassQuota }, Error, ConcurrentClassQuota>({
    queryKey: ['enrollment-quota'],
    queryFn: getMyQuota,
    select: (res) => res.data,
    staleTime: 60_000, // 1 phút — quota thay đổi khi đăng ký lớp
    enabled: user?.role === 'MEMBER',
  });
}

/**
 * Hook đăng ký trọn khóa — POST /enrollments/bulk (all-or-nothing), kèm mục tiêu + lưu ý sức khỏe từ sheet xác nhận
 * (web: EnrollConfirmModal). Parse chi tiết lỗi từ BE 409 COURSE_ENROLLMENT_FAILED và hiện thành thông báo rõ ràng.
 */
export function useEnrollWholeCourse() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const mutation = useMutation({
    mutationFn: ({ classId, options }: { classId: string; options: EnrollOptions }) => enrollWholeCourse(classId, options),
    onSuccess: (res, { options }) => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['my-enrollments-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-quota'] });
      const d = res.data;
      // BE vừa khởi tạo mục tiêu của hội viên cho lớp này → thẻ "Mục tiêu & tiến độ" phải tải lại
      for (const key of ['course-plan', 'class-schedules', 'member-schedule', 'classes', 'my-class-goal']) void queryClient.invalidateQueries({ queryKey: [key] });
      // "Lưu vào hồ sơ" đã đổi ghi chú sức khỏe ở BE → tải lại user để lần đăng ký sau điền sẵn đúng
      if (options.saveToProfile && options.healthNotes) void refreshUser().catch(() => undefined);
      showAlert('Đăng ký trọn khóa thành công', wholeCourseEnrollmentMessage(d));
    },
    onError: (e) => {
      // BE là nơi quyết định (vd hết hạn đăng ký kỳ học, gói hết hạn trước khóa) → tải lại kế hoạch khóa để thẻ kỳ học + nút đăng ký khớp
      void queryClient.invalidateQueries({ queryKey: ['course-plan'] });
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

  /** `onSettled` chạy sau khi xong dù thành công hay lỗi (web đóng modal trong cả hai trường hợp) */
  const enroll = (classId: string, options: EnrollOptions, onSettled?: () => void) => {
    if (mutation.isPending) return;
    mutation.mutate({ classId, options }, { onSettled });
  };

  return { enroll, isPending: mutation.isPending };
}
