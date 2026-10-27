// components/schedule/ScheduleCalendar.tsx
// KHUNG LỊCH DÙNG CHUNG cho Hội viên (tab Lịch) và HLV (tab Lịch dạy): chọn Tuần / Tháng → điều hướng kỳ →
// dải ngày hoặc lưới tháng có chấm báo ngày có buổi → danh sách buổi theo ngày.
// Hai màn chỉ khác dữ liệu và thẻ buổi học (`events`, `renderEvent`); khung lịch là một nên luôn đồng bộ.

import React, { useMemo, type ReactNode } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { DayAgenda } from './DayAgenda';
import { Colors, Spacing } from '../../constants/theme';
import { groupByDay, inPeriod } from '../../lib/calendar';
import { useUserPullRefresh } from '../../hooks/shared/useUserPullRefresh';
import type { ScheduleCalendarState } from '../../hooks/shared/useScheduleCalendar';

export interface CalendarEvent {
  id: string;
  /** ISO thời điểm bắt đầu */
  startTime: string;
}

interface ScheduleCalendarProps<T extends CalendarEvent> {
  calendar: ScheduleCalendarState;
  events: readonly T[];
  loading?: boolean;
  errorText?: string | null;
  /** Câu hiện ở ngày không có buổi: "Nghỉ tập" (hội viên) / "Không có buổi dạy" (HLV) */
  emptyDayText: string;
  renderEvent: (event: T) => ReactNode;
  /** Chèn trên danh sách, vd. bộ lọc lớp / trạng thái của HLV */
  listHeader?: ReactNode;
  /** Đang làm mới dữ liệu (kể cả ngầm) — chỉ để biết khi nào lần kéo-để-tải xong */
  busy?: boolean;
  onRefresh?: () => void;
}

export function ScheduleCalendar<T extends CalendarEvent>({
  calendar, events, loading, errorText, emptyDayText, renderEvent, listHeader, busy, onRefresh,
}: ScheduleCalendarProps<T>) {
  const groups = useMemo(() => groupByDay(events, (event) => event.startTime), [events]);
  const counts = useMemo(() => new Map([...groups].map(([key, list]) => [key, list.length] as const)), [groups]);
  const { pulling, onPull } = useUserPullRefresh(Boolean(busy), onRefresh);

  return (
    <View className="flex-1 bg-bg-primary">
      <CalendarHeader calendar={calendar} />
      <CalendarGrid
        weeks={calendar.period.weeks}
        selected={calendar.selected}
        counts={counts}
        isInPeriod={(day) => inPeriod(calendar.period, day)}
        onSelect={calendar.select}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl }}
        refreshControl={onRefresh ? <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={Colors.primary} /> : undefined}
      >
        {listHeader}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} size="large" />
        ) : errorText ? (
          <Text className="text-sm text-status-failed font-bevn-regular text-center mt-xl">{errorText}</Text>
        ) : (
          <DayAgenda calendar={calendar} groups={groups} renderEvent={renderEvent} emptyText={emptyDayText} />
        )}
      </ScrollView>
    </View>
  );
}
