// hooks/shared/useClassDetail.ts
// Logic màn chi tiết lớp: thông tin lớp, kế hoạch khóa (hội viên), buổi dạy sắp tới (HLV),
// đăng ký trọn khóa — giống ClassDetailPage web (không đặt lẻ từng buổi).

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, type Envelope } from '../../lib/api';
import { allPages } from '../../lib/pagedApi';
import { findClassInLists } from '../../lib/classCache';
import type { Class, ClassCoach, ClassSchedule } from '../../lib/types';
import { useCoursePlan } from './useClasses';
import { useEnrollWholeCourse } from '../member/useEnrollments';
import { useTermNotice } from '../member/useTermNotice';
import { useOwningFacility } from './useOwningFacility';
import { TERM_REGISTRATION_CLOSED_CODE } from '../../constants/terms';

/** Lý do chặn đăng ký liên quan gói thành viên → gợi ý xem gói */
const MEMBERSHIP_BLOCKER = /SUBSCRIPTION|TIER|MEMBERSHIP/;

export function useClassDetail(id: string) {
  const { user, currentFacility } = useAuth();
  const queryClient = useQueryClient();
  const isMember = user?.role === 'MEMBER';
  const isCoach = user?.role === 'COACH';
  const [selectedCoach, setSelectedCoach] = useState<ClassCoach | null>(null);

  const cls = useQuery<Envelope<Class>, Error>({
    queryKey: ['class', id, currentFacility?.id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => apiRequest<Class>(`/classes/${encodeURIComponent(id)}`, 'GET', { signal }),
    // Bấm từ danh sách Khám phá: hiện ngay lớp đã có trong cache, tải lại ngầm — không có vòng tải thứ hai ngay sau danh sách
    placeholderData: () => {
      const found = findClassInLists(queryClient.getQueriesData<Envelope<Class[]>>({ queryKey: ['classes'] }), id);
      return found ? ({ success: true, message: '', data: found } as Envelope<Class>) : undefined;
    },
  });
  // Lớp thuộc cơ sở khác cơ sở đang chọn (vd. bấm thông báo "Lớp học mới") → BE 403 FORBIDDEN_SCOPE → dò cơ sở chủ
  const facilityScope = useOwningFacility(id ? `/classes/${encodeURIComponent(id)}` : undefined, cls.error);
  const plan = useCoursePlan(id, { enabled: isMember });
  const coachSessions = useQuery({
    queryKey: ['class-schedules', id, currentFacility?.id],
    enabled: Boolean(id) && isCoach,
    queryFn: ({ signal }) => allPages<ClassSchedule>('/class-schedules', { classId: id, status: 'SCHEDULED', startAfter: new Date().toISOString() }, signal),
  });
  const bulk = useEnrollWholeCourse();

  const registration = plan.data?.data.registration ?? null;
  // Kỳ học của khóa + đăng ký muộn: BE chặn khóa vì hết hạn đăng ký hay không (undefined khi chưa có dữ liệu đăng ký)
  const term = plan.data?.data.course?.term ?? null;
  const termBlocked = registration ? registration.blockers.some((b) => b.code === TERM_REGISTRATION_CLOSED_CODE) : undefined;
  const termNotice = useTermNotice(isMember ? term : null, termBlocked);

  return {
    isMember,
    isCoach,
    cls,
    facilityScope,
    plan,
    coachSessions,
    bulk,
    value: cls.data?.data,
    /** Một vòng tải duy nhất: chờ cả lớp lẫn kế hoạch khóa rồi hiện đủ, không hiện từng phần kèm vòng tải thứ hai */
    isInitialLoading: !cls.isError && (cls.isPending || (isMember && plan.isPending)),
    course: plan.data?.data.course ?? null,
    sessions: plan.data?.data.sessions ?? [],
    registration,
    /** Lý do chặn của BE, bỏ dòng "hết hạn đăng ký" khi thẻ kỳ học đã giải thích đủ để khỏi lặp */
    blockers: (registration?.blockers ?? []).filter((b) => !(termNotice?.coversBlocker && b.code === TERM_REGISTRATION_CLOSED_CODE)),
    term,
    termNotice,
    termSuggestsPlans: Boolean(termBlocked && termNotice?.suggestPlans),
    needsMembership: Boolean(registration?.blockers.some((b) => MEMBERSHIP_BLOCKER.test(b.code))),
    selectedCoach,
    openCoach: setSelectedCoach,
    closeCoach: () => setSelectedCoach(null),
    /** Đang làm mới (kể cả ngầm) — WorkflowScreen chỉ dùng để biết khi nào lần kéo của người dùng xong */
    refreshing: cls.isRefetching || plan.isRefetching || coachSessions.isRefetching,
    refresh: () => {
      void cls.refetch();
      if (isMember) void plan.refetch();
      if (isCoach) void coachSessions.refetch();
    },
  };
}
