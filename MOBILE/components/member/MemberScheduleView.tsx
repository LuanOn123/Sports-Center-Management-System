// components/member/MemberScheduleView.tsx
// Lịch của hội viên: khung lịch Tuần / Tháng DÙNG CHUNG với HLV (components/schedule/ScheduleCalendar), hiện các buổi
// đã đặt / đã hoàn thành. Lớp đã hủy và danh sách theo lớp nằm ở "Lớp của tôi" nên không lặp lại ở đây.
// Giống web: lịch chỉ để xem — hội viên không tự hủy buổi; cần hỗ trợ lịch thì liên hệ lễ tân.
// `embedded`: nằm trong tab Lịch (ẩn header riêng).

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../shared/ScreenHeader';
import { ScheduleCalendar } from '../schedule/ScheduleCalendar';
import { ScheduleEventCard } from '../schedule/ScheduleEventCard';
import { useScheduleCalendar } from '../../hooks/shared/useScheduleCalendar';
import { useMyEnrollments } from '../../hooks/member/useEnrollments';
import { CALENDAR_TEXT } from '../../constants/calendar';
import { memberCalendarEvents, memberSessionBadge } from '../../lib/memberSchedule';
import { ApiError } from '../../lib/api';
import { ROUTES } from '../../navigation/routes';

export function MemberScheduleView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  // Mỗi lần quay lại tab thì nhảy về hôm nay, không giữ kỳ đã xem trước đó
  const calendar = useScheduleCalendar({ resetOnFocus: true });
  // Lấy mọi lượt đăng ký (allPages) rồi tự chia theo ngày — xem được cả tháng đã qua
  const enrollments = useMyEnrollments(undefined, '100');
  const events = useMemo(() => memberCalendarEvents(enrollments.data?.data ?? []), [enrollments.data]);

  return (
    <View className="flex-1 bg-bg-primary">
      {!embedded && <ScreenHeader variant="tab" title="Lịch tập" />}
      <ScheduleCalendar
        calendar={calendar}
        events={events}
        loading={enrollments.isLoading}
        errorText={enrollments.isError ? (enrollments.error instanceof ApiError ? enrollments.error.message : CALENDAR_TEXT.loadError) : null}
        emptyDayText="Nghỉ tập"
        busy={enrollments.isRefetching}
        onRefresh={() => { void enrollments.refetch(); }}
        renderEvent={({ enrollment }) => {
          const schedule = enrollment.schedule!;
          return (
            <ScheduleEventCard
              startTime={schedule.startTime}
              endTime={schedule.endTime}
              title={schedule.class?.name ?? 'Lớp học'}
              room={schedule.room?.name}
              badge={memberSessionBadge(enrollment)}
              hint="Xem chi tiết →"
              onPress={() => router.push(ROUTES.scheduleDetail(enrollment.scheduleId))}
            />
          );
        }}
      />
    </View>
  );
}
