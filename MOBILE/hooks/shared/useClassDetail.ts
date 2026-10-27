// hooks/shared/useClassDetail.ts
// Logic màn chi tiết lớp: thông tin lớp, kế hoạch khóa (hội viên), buổi dạy sắp tới (HLV),
// đăng ký trọn khóa — giống ClassDetailPage web (không đặt lẻ từng buổi).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, type Envelope } from '../../lib/api';
import { allPages } from '../../lib/pagedApi';
import { findClassInLists } from '../../lib/classCache';
import type { Class, ClassCoach, ClassSchedule } from '../../lib/types';
import { useCoursePlan } from './useClasses';
import { useEnrollWholeCourse } from '../member/useEnrollments';
import { useOwningFacility } from './useOwningFacility';
import { TERM_STAGE_BLOCKER_CODES } from '../../constants/terms';
import { membershipCoverageNotice, termNotice as describeTerm } from '../../lib/termRegistration';

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
  // Kỳ học của khóa: giai đoạn đăng ký (hết hạn đăng ký là hết, gói không nới được)
  const term = plan.data?.data.course?.term ?? null;
  const termNotice = useMemo(() => (isMember && term ? describeTerm(term) : null), [isMember, term]);
  // Gói hết hạn trước buổi cuối của khóa nhưng còn ≥ 50% thời hạn: BE xác nhận quyền học đến hết kỳ
  const coverage = useMemo(() => membershipCoverageNotice(registration?.membershipCoverage), [registration?.membershipCoverage]);

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
    /** Lý do chặn của BE, bỏ các dòng theo giai đoạn kỳ học khi thẻ kỳ học đã giải thích đủ để khỏi lặp */
    blockers: (registration?.blockers ?? []).filter((b) => !(termNotice?.coversBlocker && TERM_STAGE_BLOCKER_CODES.includes(b.code))),
    term,
    termNotice,
    coverage,
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
