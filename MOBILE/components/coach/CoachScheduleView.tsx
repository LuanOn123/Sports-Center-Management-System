// components/coach/CoachScheduleView.tsx
// Màn Lịch dạy của HLV (web: CoachWorkspace mode "schedule") — logic ở hooks/coach/useCoachScheduleScreen.
// Khung lịch Tuần / Tháng là components/schedule/ScheduleCalendar, dùng chung với tab Lịch của Hội viên.
// Lọc lớp + trạng thái: MỘT hàng "Bộ lọc" trên danh sách buổi (mở bảng lọc); bộ lọc đang bật hiện thành chip gỡ được.

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../shared/ScreenHeader';
import { ActiveFilterChips } from '../shared/ActiveFilterChips';
import { FilterBar } from '../shared/FilterBar';
import { ScheduleCalendar } from '../schedule/ScheduleCalendar';
import { ScheduleEventCard } from '../schedule/ScheduleEventCard';
import { ScheduleFilterSheet } from './ScheduleFilterSheet';
import { useCoachScheduleScreen } from '../../hooks/coach/useCoachScheduleScreen';
import { CALENDAR_TEXT } from '../../constants/calendar';
import { SCHEDULE_FILTER_TEXT, SCHEDULE_STATUS_COLOR, SCHEDULE_STATUS_LABEL } from '../../constants/schedule';
import { ROUTES } from '../../navigation/routes';
import { ApiError } from '../../lib/api';
import { isCoachSessionDone } from '../../lib/memberSchedule';

interface CoachScheduleViewProps {
  coachId: string | undefined;
  /** Lớp được chọn từ "Xem lịch dạy" của thẻ lớp phụ trách */
  initialClassId?: string;
}

export function CoachScheduleView({ coachId, initialClassId }: CoachScheduleViewProps) {
  const router = useRouter();
  const screen = useCoachScheduleScreen(coachId, initialClassId);
  const [filterOpen, setFilterOpen] = useState(false);

  // Tab giữ nguyên params → xoá classId sau khi đã áp bộ lọc, để lần sau chọn lại đúng lớp đó thì param đổi giá trị và bộ lọc áp lại
  useEffect(() => {
    if (initialClassId) router.setParams({ classId: '' });
  }, [initialClassId, router]);

  // Khoảng cách tới danh sách luôn 16px: hàng chip tự chừa 8px dưới chân nên khi có chip chỉ thêm 8px
  const hasChips = screen.activeFilters.length > 0;
  const filters = (
    <View className={hasChips ? 'mb-sm' : 'mb-md'}>
      <FilterBar hint={SCHEDULE_FILTER_TEXT.hint} count={screen.filterCount} onPress={() => setFilterOpen(true)} />
      {/* Hàng chip có lề ngang riêng nên kéo ra sát mép để chip thẳng hàng với khung lịch; không có bộ lọc nào thì không hiện gì */}
      {hasChips && (
        <View className="-mx-xl mt-sm">
          <ActiveFilterChips filters={screen.activeFilters} onRemove={screen.clearFilter} />
        </View>
      )}
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
        renderEvent={(session) => {
          // Buổi đã qua giờ kết thúc hiện là "Hoàn thành" (nhãn xanh lá), phần còn lại của thẻ chuyển xám
          const done = isCoachSessionDone(session);
          const status = done ? 'COMPLETED' : session.status;
          return (
            <ScheduleEventCard
              startTime={session.startTime}
              endTime={session.endTime}
              title={session.class?.name ?? 'Lớp học'}
              room={session.room?.name}
              badge={{ label: SCHEDULE_STATUS_LABEL[status], color: SCHEDULE_STATUS_COLOR[status] }}
              hint="Xem học viên →"
              muted={session.status === 'CANCELLED'}
              done={done}
              onPress={() => router.push(ROUTES.coachAttendanceFor(session.id))}
            />
          );
        }}
      />

      <ScheduleFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        classes={screen.classes}
        classId={screen.classFilter}
        onClass={screen.setClassFilter}
        status={screen.statusFilter}
        onStatus={screen.setStatusFilter}
        activeCount={screen.filterCount}
        onClear={screen.clearFilters}
        resultCount={screen.isLoading ? undefined : screen.sessions.length}
      />
    </View>
  );
}
