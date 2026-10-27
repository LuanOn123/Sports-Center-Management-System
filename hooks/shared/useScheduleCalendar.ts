// hooks/shared/useScheduleCalendar.ts
// Trạng thái khung lịch dùng chung cho Hội viên (Lịch) và HLV (Lịch dạy): chế độ Tuần / Tháng, kỳ đang xem,
// ngày đang chọn. Quy tắc tính kỳ / điều hướng ở lib/calendar.ts.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { CalendarMode } from '../../constants/calendar';
import {
  calendarPeriod, isCurrentPeriod, periodTitle, shiftCursor, switchCursor, todayCursor, type CalendarCursor,
} from '../../lib/calendar';

/** `resetOnFocus`: mỗi lần quay lại tab thì nhảy về hôm nay (Hội viên); bỏ qua thì giữ kỳ đang xem (HLV) */
export function useScheduleCalendar(options?: { resetOnFocus?: boolean }) {
  const resetOnFocus = Boolean(options?.resetOnFocus);
  const [mode, setModeState] = useState<CalendarMode>('week');
  const [cursor, setCursor] = useState<CalendarCursor>(() => todayCursor());

  useFocusEffect(
    useCallback(() => {
      if (resetOnFocus) setCursor(todayCursor());
    }, [resetOnFocus]),
  );

  const anchorTime = cursor.anchor.getTime();
  const period = useMemo(() => calendarPeriod(mode, cursor.anchor), [mode, anchorTime]);

  return {
    mode,
    setMode: (next: CalendarMode) => {
      if (next === mode) return;
      setCursor((current) => switchCursor(next, current));
      setModeState(next);
    },
    period,
    selected: cursor.selected,
    select: (day: Date) => setCursor((current) => ({ ...current, selected: day })),
    prev: () => setCursor((current) => shiftCursor(mode, current, -1)),
    next: () => setCursor((current) => shiftCursor(mode, current, 1)),
    goToday: () => setCursor(todayCursor()),
    isCurrent: isCurrentPeriod(mode, cursor.anchor),
    title: periodTitle(mode, cursor.anchor),
  };
}

export type ScheduleCalendarState = ReturnType<typeof useScheduleCalendar>;
