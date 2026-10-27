// components/schedule/DayAgenda.tsx
// Danh sách buổi học theo ngày dưới khung lịch — thứ viết ĐỦ chữ ("Thứ hai", không "T2").
// Tuần: liệt kê cả 7 ngày; Tháng: chỉ ngày đang chọn.

import React, { type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../constants/theme';
import { CALENDAR_TEXT } from '../../constants/calendar';
import { dayKey, isSameDay, isToday } from '../../lib/date';
import { dayHeading, weekdayLong } from '../../lib/calendar';
import { formatDayMonth } from '../../lib/format';
import type { ScheduleCalendarState } from '../../hooks/shared/useScheduleCalendar';

interface DaySectionProps {
  day: Date;
  selected: boolean;
  /** Tháng: ghi cả ngày tháng năm ("Thứ hai, 26/10/2026"); tuần: thứ rồi ngày tháng ("Thứ hai  26/10") */
  withYear: boolean;
  children: ReactNode;
}

function DaySection({ day, selected, withYear, children }: DaySectionProps) {
  return (
    <View className="mb-lg">
      <View className="flex-row items-baseline gap-sm mb-sm flex-wrap">
        {withYear ? (
          <Text className="text-md font-bevn-bold" style={{ color: selected ? Colors.primary : Colors.text.primary }}>{dayHeading(day)}</Text>
        ) : (
          <>
            <Text className="text-md font-bevn-bold" style={{ color: selected ? Colors.primary : Colors.text.primary }}>{weekdayLong(day)}</Text>
            <Text className="text-xs text-text-secondary font-bevn-regular">{formatDayMonth(day)}</Text>
          </>
        )}
        {isToday(day) && <Text className="text-xs text-primary font-bevn-medium">· {CALENDAR_TEXT.today}</Text>}
      </View>
      {children}
    </View>
  );
}

interface DayAgendaProps<T> {
  calendar: ScheduleCalendarState;
  groups: ReadonlyMap<string, T[]>;
  renderEvent: (event: T) => ReactNode;
  emptyText: string;
}

export function DayAgenda<T extends { id: string }>({ calendar, groups, renderEvent, emptyText }: DayAgendaProps<T>) {
  const monthly = calendar.mode === 'month';
  const days = monthly ? [calendar.selected] : calendar.period.weeks[0];
  return (
    <>
      {days.map((day) => {
        const events = groups.get(dayKey(day)) ?? [];
        return (
          <DaySection key={dayKey(day)} day={day} selected={isSameDay(day, calendar.selected)} withYear={monthly}>
            {events.length === 0 ? (
              <Text className="text-xs text-text-muted font-bevn-regular italic">{emptyText}</Text>
            ) : (
              events.map((event) => <React.Fragment key={event.id}>{renderEvent(event)}</React.Fragment>)
            )}
          </DaySection>
        );
      })}
    </>
  );
}
