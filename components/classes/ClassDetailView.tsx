// components/classes/ClassDetailView.tsx
// Chi tiết lớp theo thứ tự người dùng cần để quyết định: thông tin lớp → lịch học & địa điểm
// → các buổi của khóa (chỉ xem) → huấn luyện viên → đánh giá. Nút "Đăng ký trọn khóa" cố định dưới đáy —
// hội viên đăng ký theo CẢ KHÓA như web, không đặt lẻ từng buổi.
// Chỉ hiển thị trường BE thật sự trả về (lớp không có giá riêng — quyền theo gói thành viên).

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { CoachRating } from '../shared/CoachRating';
import { WaitlistAction } from '../member/WaitlistAction';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { StatusBadge } from '../ui';
import { useClassDetail } from '../../hooks/shared/useClassDetail';
import { CLASS_TYPE_COLOR, CLASS_TYPE_LABEL, LOW_SLOT_THRESHOLD, SESSION_TONE_COLOR } from '../../constants/classes';
import { Colors } from '../../constants/theme';
import { canJoinSessionWaitlist, courseAvailability, formatSlot, sessionStatusLabel, type AvailabilityTone } from '../../lib/classPlan';
import { formatDate, formatTime, formatWeekdayDate } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';

const TONE_COLOR: Record<AvailabilityTone, string> = {
  open: Colors.status.success,
  limited: Colors.status.pending,
  full: Colors.status.failed,
};

function SectionTitle({ icon, children }: { icon: string; children: string }) {
  return (
    <View className="flex-row items-center gap-1.5 -mb-sm">
      <Icon name={icon} size={16} color={Colors.primary} />
      <Text className="text-md font-bevn-bold text-text-primary">{children}</Text>
    </View>
  );
}

function Fact({ icon, children, color = Colors.text.secondary }: { icon: string; children: React.ReactNode; color?: string }) {
  return (
    <View className="flex-row items-start gap-sm">
      <Icon name={icon} size={16} color={color} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-sm font-bevn-regular leading-[22px]" style={{ color }}>{children}</Text>
    </View>
  );
}

export function ClassDetailView({ id }: { id: string }) {
  const router = useRouter();
  const d = useClassDetail(id);
  const { value, course, registration } = d;

  const goToOtherClasses = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.classes);
  };

  // Nút cố định dưới đáy — chỉ khi hội viên và lớp đã có kế hoạch khóa học
  const footer = d.isMember && value && course ? (
    registration?.isFullyRegistered ? (
      <WorkflowButton title="Đã đăng ký đủ khóa" secondary disabled onPress={() => undefined} />
    ) : registration?.eligible ? (
      <WorkflowButton
        icon="event-available"
        title={`Đăng ký trọn khóa · ${course.totalSessions} buổi`}
        busy={d.bulk.isPending}
        onPress={() => d.bulk.handleEnrollWholeCourse(id, value.name)}
      />
    ) : d.needsMembership ? (
      <WorkflowButton icon="card-membership" title="Xem gói thành viên để đăng ký" onPress={() => router.push(ROUTES.membershipPlans)} />
    ) : (
      <WorkflowButton title="Chưa thể đăng ký khóa này" disabled onPress={() => undefined} />
    )
  ) : undefined;

  const availability = course ? courseAvailability(course, LOW_SLOT_THRESHOLD) : null;
  const duration = course?.slots[0]?.durationMinutes;

  return (
    <WorkflowScreen title={value?.name || 'Chi tiết lớp học'} refreshing={d.refreshing} onRefresh={d.refresh} footer={footer}>
      <WorkflowState pending={d.cls.isPending} error={d.cls.error} retry={() => { void d.cls.refetch(); }} />
      {value && <>
        {/* 1. Thông tin lớp */}
        <WorkflowCard>
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-xs text-primary font-bevn-semibold mr-sm">{value.sports?.map((s) => s.name).join(' · ') || 'Lớp học'}</Text>
            <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: CLASS_TYPE_COLOR[value.classType] + '20' }}>
              <Text className="text-xs font-bevn-semibold" style={{ color: CLASS_TYPE_COLOR[value.classType] }}>{CLASS_TYPE_LABEL[value.classType]}</Text>
            </View>
          </View>
          <WorkflowText>{value.description || 'Chưa có mô tả lớp.'}</WorkflowText>
          <View className="gap-sm">
            <Fact icon="group">Tối đa {value.capacity} học viên / buổi</Fact>
            {Boolean(duration) && <Fact icon="access-time">{duration} phút / buổi</Fact>}
            {value.classType === 'PREMIUM' && <Fact icon="workspace-premium" color={Colors.tier.PREMIUM}>Cần gói Premium còn hiệu lực để đặt lớp</Fact>}
          </View>
        </WorkflowCard>

        {/* 2. Lịch học & địa điểm (hội viên) */}
        {d.isMember && <>
          <SectionTitle icon="calendar-today">Lịch học & địa điểm</SectionTitle>
          <WorkflowState pending={d.plan.isPending} error={d.plan.error} retry={() => { void d.plan.refetch(); }} />
          {d.plan.isSuccess && !course && (
            <WorkflowCard>
              <View className="items-center gap-xs py-sm">
                <Icon name="event-busy" size={32} color={Colors.text.muted} />
                <Text className="text-md text-text-primary font-bevn-semibold text-center">Lớp chưa có lịch học sắp tới</Text>
                <Text className="text-sm text-text-muted font-bevn-regular text-center">Trung tâm chưa mở buổi học mới cho lớp này nên chưa thể đăng ký. Bạn có thể quay lại sau hoặc xem các lớp khác.</Text>
              </View>
              <WorkflowButton title="Xem lớp khác" secondary onPress={goToOtherClasses} />
            </WorkflowCard>
          )}
          {course && (
            <WorkflowCard>
              <View className="gap-sm">
                {course.slots.map((slot) => (
                  <Fact key={`${slot.weekday}-${slot.startTime}-${slot.roomId}`} icon="place">{formatSlot(slot, true)}</Fact>
                ))}
                <Fact icon="date-range">{course.totalSessions} buổi · {formatDate(course.firstSessionStart)} → {formatDate(course.lastSessionEnd)}</Fact>
                {availability && <Fact icon="event-seat" color={TONE_COLOR[availability.tone]}>{availability.text}</Fact>}
              </View>
              {registration && registration.registeredSessions > 0 && (
                <WorkflowText>Bạn đã đăng ký {registration.registeredSessions}/{course.totalSessions} buổi.</WorkflowText>
              )}
              {registration?.blockers.map((blocker, index) => (
                <Fact key={`${blocker.code}:${index}`} icon="info" color={Colors.status.pending}>{blocker.message}</Fact>
              ))}
            </WorkflowCard>
          )}

          {/* 3. Các buổi của khóa — CHỈ XEM (đăng ký theo cả khóa ở nút dưới đáy, giống web).
              Thao tác duy nhất theo buổi: vào danh sách chờ khi buổi đã hết chỗ. */}
          {d.sessions.length > 0 && <SectionTitle icon="event">{`Các buổi của khóa (${d.sessions.length})`}</SectionTitle>}
          {d.sessions.length > 0 && (
            <View className="bg-bg-surface rounded-lg border border-border overflow-hidden">
              {d.sessions.map((session, index) => {
                const label = sessionStatusLabel(session);
                const booked = session.myEnrollmentStatus === 'BOOKED';
                const row = (
                  <View className={index < d.sessions.length - 1 ? 'px-lg py-md border-b border-divider' : 'px-lg py-md'}>
                    <View className="flex-row items-center gap-md">
                      <View className="flex-1">
                        <Text className="text-sm text-text-primary font-bevn-semibold">{formatWeekdayDate(session.startTime)} · {formatTime(session.startTime)}–{formatTime(session.endTime)}</Text>
                        <Text className="text-xs text-text-muted font-bevn-regular mt-0.5" numberOfLines={1}>
                          {session.room?.name || 'Phòng tập'}{session.isFull ? '' : ` · còn ${session.remainingSlots}/${course?.capacity ?? value.capacity} chỗ`}
                        </Text>
                      </View>
                      <StatusBadge label={label.text} color={SESSION_TONE_COLOR[label.tone]} />
                    </View>
                    {canJoinSessionWaitlist(session) && <View className="mt-sm"><WaitlistAction scheduleId={session.id} /></View>}
                  </View>
                );
                return booked ? (
                  <TouchableOpacity key={session.id} onPress={() => router.push(ROUTES.scheduleDetail(session.id))} activeOpacity={0.7}>{row}</TouchableOpacity>
                ) : <View key={session.id}>{row}</View>;
              })}
            </View>
          )}
        </>}

        {/* Buổi dạy sắp tới (HLV) */}
        {d.isCoach && <>
          <SectionTitle icon="event">Buổi dạy sắp tới</SectionTitle>
          <WorkflowState pending={d.coachSessions.isPending} error={d.coachSessions.error} retry={() => { void d.coachSessions.refetch(); }} empty={d.coachSessions.isSuccess && !d.coachSessions.data.data.length ? 'Chưa có buổi dạy sắp tới.' : undefined} />
          {d.coachSessions.data?.data.map((session) => (
            <WorkflowCard key={session.id} title={`${formatDate(session.startTime)} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`}>
              <WorkflowText>{session.room?.name || 'Phòng tập'}</WorkflowText>
              <WorkflowButton title="Xem học viên & điểm danh" onPress={() => router.push(ROUTES.coachAttendanceFor(session.id))} />
            </WorkflowCard>
          ))}
        </>}

        {/* 4. Huấn luyện viên */}
        {Boolean(value.coaches?.length) && <SectionTitle icon="person">Huấn luyện viên</SectionTitle>}
        {value.coaches?.map((assigned) => (
          <WorkflowCard key={assigned.coachId}>
            <View className="flex-row items-center gap-md">
              <Avatar name={assigned.coach?.user?.fullName} size={44} />
              <View className="flex-1">
                <Text className="text-md text-text-primary font-bevn-semibold">{assigned.coach?.user?.fullName || 'Huấn luyện viên'}</Text>
                <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">
                  {[assigned.isPrimary ? 'HLV chính' : 'HLV', assigned.coach?.specialization, assigned.coach?.experienceYears ? `${assigned.coach.experienceYears} năm kinh nghiệm` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            {Boolean(assigned.coach?.bio) && <Text className="text-sm text-text-secondary font-bevn-regular leading-[22px]" numberOfLines={4}>{assigned.coach!.bio}</Text>}
          </WorkflowCard>
        ))}

        {/* 5. Đánh giá (hội viên) — mục riêng, không lặp tên HLV khi lớp chỉ có 1 HLV */}
        {d.isMember && Boolean(value.coaches?.length) && <>
          <SectionTitle icon="star">Đánh giá</SectionTitle>
          {value.coaches!.map((assigned) => (
            <CoachRating
              key={assigned.coachId}
              coachId={assigned.coachId}
              coachName={assigned.coach?.user?.fullName}
              classId={id}
              title={value.coaches!.length > 1 ? assigned.coach?.user?.fullName || 'Huấn luyện viên' : 'Nhận xét của học viên'}
            />
          ))}
        </>}
      </>}
    </WorkflowScreen>
  );
}
