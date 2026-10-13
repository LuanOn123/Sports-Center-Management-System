import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { allPages } from '../../lib/pagedApi';
import type { Class, ClassSchedule, CoursePlan } from '../../lib/types';
import { useEnrollWholeCourse, useBookSchedule } from '../../hooks/member/useEnrollments';
import { CoachRating } from '../../components/shared/CoachRating';
import { WaitlistAction } from '../../components/member/WaitlistAction';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../../components/shared/WorkflowScreen';
import { formatDate, formatTime } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';
import { showAlert, showConfirm } from '../../lib/alert';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, currentFacility } = useAuth();
  const router = useRouter();
  const isMember = user?.role === 'MEMBER';
  const cls = useQuery({ queryKey: ['class', id, currentFacility?.id], enabled: Boolean(id), queryFn: ({ signal }) => apiRequest<Class>(`/classes/${encodeURIComponent(id)}`, 'GET', { signal }) });
  const plan = useQuery({ queryKey: ['course-plan', id, currentFacility?.id], enabled: Boolean(id) && isMember, queryFn: ({ signal }) => apiRequest<CoursePlan>(`/classes/${encodeURIComponent(id)}/course-plan`, 'GET', { signal }) });
  const coachSessions = useQuery({ queryKey: ['class-schedules', id, currentFacility?.id], enabled: Boolean(id) && user?.role === 'COACH', queryFn: ({ signal }) => allPages<ClassSchedule>('/class-schedules', { classId: id, status: 'SCHEDULED', startAfter: new Date().toISOString() }, signal) });
  const bulk = useEnrollWholeCourse();
  const book = useBookSchedule();
  const value = cls.data?.data;
  const course = plan.data?.data.course;
  const registration = plan.data?.data.registration;
  return <WorkflowScreen title={value?.name || 'Chi tiết lớp học'} refreshing={cls.isRefetching || plan.isRefetching || coachSessions.isRefetching} onRefresh={() => { void cls.refetch(); if (isMember) void plan.refetch(); else void coachSessions.refetch(); }}>
    <WorkflowState pending={cls.isPending} error={cls.error} retry={() => { void cls.refetch(); }} />
    {value && <>
      <WorkflowCard title={value.name}><WorkflowText>{value.classType === 'PREMIUM' ? 'Cao cấp' : 'Tiêu chuẩn'} · {value.capacity} học viên / buổi</WorkflowText>
        <WorkflowText>{value.sports?.map((sport) => sport.name).join(' · ')}</WorkflowText><WorkflowText>{value.description || 'Chưa có mô tả lớp.'}</WorkflowText>
      </WorkflowCard>
      {value.coaches?.map((assigned) => <WorkflowCard key={assigned.coachId} title={assigned.coach?.user?.fullName || 'Huấn luyện viên'}>
        <WorkflowText>{assigned.isPrimary ? 'Huấn luyện viên chính' : 'Huấn luyện viên'} · {assigned.coach?.specialization || 'Chưa cập nhật chuyên môn'}</WorkflowText>
        {assigned.coach?.bio && <WorkflowText>{assigned.coach.bio}</WorkflowText>}
        {isMember && <CoachRating coachId={assigned.coachId} coachName={assigned.coach?.user?.fullName} classId={id} />}
      </WorkflowCard>)}
      {isMember ? <>
        <WorkflowState pending={plan.isPending} error={plan.error} retry={() => { void plan.refetch(); }} />
        {course && <WorkflowCard title="Kế hoạch khóa học">
          <WorkflowText>{course.totalSessions} buổi · {course.weekdayLabels.join(' · ')}</WorkflowText>
          <WorkflowText>{formatDate(course.firstSessionStart)} → {formatDate(course.lastSessionEnd)}</WorkflowText>
          <WorkflowText>{course.availability.fullSessionCount} buổi đầy · Ít nhất {course.availability.minRemainingSlots} chỗ trống / buổi</WorkflowText>
          {registration && <WorkflowText>Đã đăng ký {registration.registeredSessions}/{course.totalSessions} buổi</WorkflowText>}
          {registration?.blockers.map((blocker, index) => <WorkflowText key={`${blocker.code}:${index}`}>{blocker.message}</WorkflowText>)}
          <WorkflowButton title={registration?.isFullyRegistered ? 'Đã đăng ký đủ khóa' : 'Đăng ký trọn khóa'} disabled={!registration?.eligible || registration.isFullyRegistered} busy={bulk.isPending} onPress={() => bulk.handleEnrollWholeCourse(id, value.name)} />
          {registration?.blockers.some((blocker) => /SUBSCRIPTION|TIER|MEMBERSHIP/.test(blocker.code)) && <WorkflowButton title="Xem gói thành viên" secondary onPress={() => router.push(ROUTES.membershipPlans)} />}
        </WorkflowCard>}
        {plan.isSuccess && !plan.data.data.sessions.length && <WorkflowState empty="Chưa có lịch học sắp tới." />}
        {plan.data?.data.sessions.map((session) => <WorkflowCard key={session.id} title={`${formatDate(session.startTime)} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`}>
          <WorkflowText>{session.room?.name || 'Phòng tập'} · {session.isFull ? 'Hết chỗ' : `Còn ${session.remainingSlots} chỗ`}</WorkflowText>
          {session.conflictWith && <WorkflowText>Trùng lịch với lớp {session.conflictWith.className}.</WorkflowText>}
          {session.myEnrollmentStatus === 'BOOKED' ? <WorkflowButton title="Đã đặt · Xem buổi học" secondary onPress={() => router.push(ROUTES.scheduleDetail(session.id))} />
            : session.isFull && session.status === 'SCHEDULED' && Date.parse(session.startTime) > Date.now() ? <WaitlistAction scheduleId={session.id} />
            : <WorkflowButton title={session.canBook ? 'Đặt buổi học' : 'Chưa thể đặt buổi này'} busy={book.isPending} disabled={!session.canBook} onPress={() => showConfirm('Đặt buổi học', `Đặt lớp ${value.name} lúc ${formatTime(session.startTime)}?`, () => book.mutate(session.id, { onSuccess: () => { void plan.refetch(); showAlert('Đặt lịch thành công', 'Đã thêm buổi học vào lịch của bạn.'); }, onError: (e) => showAlert('Không thể đặt buổi học', e.message) }), undefined, 'Đặt lịch')} />}
        </WorkflowCard>)}
      </> : <>
        <WorkflowState pending={coachSessions.isPending} error={coachSessions.error} retry={() => { void coachSessions.refetch(); }} empty={coachSessions.isSuccess && !coachSessions.data.data.length ? 'Chưa có buổi dạy sắp tới.' : undefined} />
        {coachSessions.data?.data.map((session) => <WorkflowCard key={session.id} title={`${formatDate(session.startTime)} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`}>
          <WorkflowText>{session.room?.name || 'Phòng tập'}</WorkflowText><WorkflowButton title="Xem học viên & điểm danh" onPress={() => router.push(ROUTES.coachAttendanceFor(session.id))} />
        </WorkflowCard>)}
      </>}
    </>}
  </WorkflowScreen>;
}
