// components/coach/CoachScheduleView.tsx
// Màn Lịch dạy của HLV (web: CoachWorkspace mode "schedule") — logic ở hooks/coach/useCoachScheduleScreen.
// Khung lịch Tuần / Tháng là components/schedule/ScheduleCalendar, dùng chung với tab Lịch của Hội viên.

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../shared/ScreenHeader';
import { FilterChip } from '../shared/FilterChip';
import { ChipRow } from '../shared/ChipRow';
import { ScheduleCalendar } from '../schedule/ScheduleCalendar';
import { ScheduleEventCard } from '../schedule/ScheduleEventCard';
import { useCoachScheduleScreen } from '../../hooks/coach/useCoachScheduleScreen';
import { CALENDAR_TEXT } from '../../constants/calendar';
import { SCHEDULE_STATUSES, SCHEDULE_STATUS_COLOR, SCHEDULE_STATUS_LABEL } from '../../constants/schedule';
import { ROUTES } from '../../navigation/routes';
import { ApiError } from '../../lib/api';

interface CoachScheduleViewProps {
  coachId: string | undefined;
  /** Lớp được chọn từ "Xem lịch dạy" của thẻ lớp phụ trách */
  initialClassId?: string;
}

export function CoachScheduleView({ coachId, initialClassId }: CoachScheduleViewProps) {
  const router = useRouter();
  const screen = useCoachScheduleScreen(coachId, initialClassId);

  // Tab giữ nguyên params → xoá classId sau khi đã áp bộ lọc, để lần sau chọn lại đúng lớp đó thì param đổi giá trị và bộ lọc áp lại
  useEffect(() => {
    if (initialClassId) router.setParams({ classId: '' });
  }, [initialClassId, router]);

  const filters = (
    <View className="-mx-xl mb-md">
      <ChipRow>
        <FilterChip label="Tất cả lớp của tôi" active={!screen.classFilter} onPress={() => screen.setClassFilter(null)} />
        {screen.classes.map((c) => (
          <FilterChip key={c.id} label={c.name} active={screen.classFilter === c.id} onPress={() => screen.setClassFilter(c.id)} />
        ))}
      </ChipRow>
      <ChipRow>
        <FilterChip label="Tất cả trạng thái" active={!screen.statusFilter} onPress={() => screen.setStatusFilter(null)} />
        {SCHEDULE_STATUSES.map((s) => (
          <FilterChip key={s} label={SCHEDULE_STATUS_LABEL[s]} active={screen.statusFilter === s} onPress={() => screen.setStatusFilter(s)} />
        ))}
      </ChipRow>
    </View>
  );

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader variant="tab" title="Lịch dạy" />
      <ScheduleCalendar
        calendar={screen.calendar}
        events={screen.sessions}
        loading={screen.isLoading}
        errorText={screen.isError ? (screen.error instanceof ApiError ? screen.error.message : CALENDAR_TEXT.loadError) : null}
        emptyDayText="Không có buổi dạy"
        busy={screen.isFetching}
        onRefresh={() => { void screen.refetch(); }}
        listHeader={filters}
        renderEvent={(session) => (
          <ScheduleEventCard
            startTime={session.startTime}
            endTime={session.endTime}
            title={session.class?.name ?? 'Lớp học'}
            room={session.room?.name}
            badge={{ label: SCHEDULE_STATUS_LABEL[session.status], color: SCHEDULE_STATUS_COLOR[session.status] }}
            hint="Xem học viên →"
            muted={session.status === 'CANCELLED'}
            onPress={() => router.push(ROUTES.coachAttendanceFor(session.id))}
          />
        )}
      />
    </View>
  );
}
