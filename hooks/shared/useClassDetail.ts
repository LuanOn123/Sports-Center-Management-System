// hooks/shared/useClassDetail.ts
// Logic màn chi tiết lớp: thông tin lớp, kế hoạch khóa (hội viên), buổi dạy sắp tới (HLV),
// đăng ký trọn khóa / đặt từng buổi — giống ClassDetailPage web.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { allPages } from '../../lib/pagedApi';
import type { Class, ClassSchedule } from '../../lib/types';
import { useCoursePlan } from './useClasses';
import { useBookSchedule, useEnrollWholeCourse } from '../member/useEnrollments';

/** Lý do chặn đăng ký liên quan gói thành viên → gợi ý xem gói */
const MEMBERSHIP_BLOCKER = /SUBSCRIPTION|TIER|MEMBERSHIP/;

export function useClassDetail(id: string) {
  const { user, currentFacility } = useAuth();
  const isMember = user?.role === 'MEMBER';
  const isCoach = user?.role === 'COACH';

  const cls = useQuery({
    queryKey: ['class', id, currentFacility?.id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => apiRequest<Class>(`/classes/${encodeURIComponent(id)}`, 'GET', { signal }),
  });
  const plan = useCoursePlan(id, { enabled: isMember });
  const coachSessions = useQuery({
    queryKey: ['class-schedules', id, currentFacility?.id],
    enabled: Boolean(id) && isCoach,
    queryFn: ({ signal }) => allPages<ClassSchedule>('/class-schedules', { classId: id, status: 'SCHEDULED', startAfter: new Date().toISOString() }, signal),
  });
  const bulk = useEnrollWholeCourse();
  const book = useBookSchedule();

  const registration = plan.data?.data.registration ?? null;

  return {
    isMember,
    isCoach,
    cls,
    plan,
    coachSessions,
    bulk,
    book,
    value: cls.data?.data,
    course: plan.data?.data.course ?? null,
    sessions: plan.data?.data.sessions ?? [],
    registration,
    needsMembership: Boolean(registration?.blockers.some((b) => MEMBERSHIP_BLOCKER.test(b.code))),
    refreshing: cls.isRefetching || plan.isRefetching || coachSessions.isRefetching,
    refresh: () => {
      void cls.refetch();
      if (isMember) void plan.refetch();
      if (isCoach) void coachSessions.refetch();
    },
  };
}
