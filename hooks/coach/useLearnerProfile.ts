// hooks/coach/useLearnerProfile.ts
// Hồ sơ học viên của HLV (web: StudentDetails ở CoachWorkspace). BE chỉ trả hồ sơ rút gọn (tên, ảnh, trình độ, mục tiêu),
// nên liên hệ + lưu ý sức khỏe lấy từ danh sách học viên của buổi dạy và mục tiêu/tiến độ từ đánh giá của buổi đó.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getLearnerProfile, getScheduleEnrollments } from '../../services/coachService';
import { useScheduleEvaluations } from './useScheduleEvaluations';

export function useLearnerProfile(memberId: string, scheduleId?: string) {
  const { currentFacility } = useAuth();
  const profile = useQuery({
    queryKey: ['coach-member', memberId, currentFacility?.id],
    enabled: Boolean(memberId),
    queryFn: ({ signal }) => getLearnerProfile(memberId, signal),
  });
  // Cùng khóa với màn Điểm danh → dùng lại danh sách đã tải thay vì gọi lại
  const roster = useQuery({
    queryKey: ['schedule-enrollments', scheduleId],
    enabled: Boolean(scheduleId),
    queryFn: () => getScheduleEnrollments(scheduleId!),
  });
  const evaluations = useScheduleEvaluations(scheduleId);

  const enrollment = roster.data?.data.find((e) => e.memberId === memberId);
  const contact = enrollment?.member?.user;

  return {
    profile,
    learner: profile.data?.data,
    email: contact?.email,
    phone: contact?.phone,
    // Giống web: ghi chú của lần đăng ký ưu tiên hơn ghi chú lưu trong hồ sơ
    healthNotes: (enrollment?.healthNotes || enrollment?.member?.healthNotes || '').trim(),
    /** Mục tiêu khóa học + tiến độ hiện tại của học viên ở buổi này; undefined khi không mở từ một buổi dạy */
    courseGoal: evaluations.itemFor(memberId),
    refreshing: profile.isRefetching || roster.isRefetching,
    refresh: () => {
      void profile.refetch();
      if (scheduleId) { void roster.refetch(); void evaluations.refetch(); }
    },
  };
}
