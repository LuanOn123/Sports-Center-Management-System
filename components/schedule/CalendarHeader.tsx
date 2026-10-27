// components/schedule/CalendarHeader.tsx
// Đầu khung lịch (Hội viên + HLV): chọn xem Tuần / Tháng, và điều hướng kỳ trước / sau kèm "Về hôm nay".

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { FilterChip } from '../shared/FilterChip';
import { Colors } from '../../constants/theme';
import { CALENDAR_MODES, CALENDAR_TEXT } from '../../constants/calendar';
import { Haptic } from '../../lib/haptics';
import type { ScheduleCalendarState } from '../../hooks/shared/useScheduleCalendar';

function NavButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-10 h-10 rounded-full bg-bg-surface border border-border items-center justify-center"
      onPress={() => { Haptic.selection(); onPress(); }}
    >
      <Icon name={icon} size={18} color={Colors.text.primary} />
    </TouchableOpacity>
  );
}

export function CalendarHeader({ calendar }: { calendar: ScheduleCalendarState }) {
  const { mode } = calendar;
  return (
    <View className="px-xl pt-md gap-sm">
      <View className="flex-row items-center gap-sm">
        {CALENDAR_MODES.map((m) => (
          <FilterChip key={m.value} label={m.label} active={mode === m.value} onPress={() => calendar.setMode(m.value)} />
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <NavButton icon="arrow-back" label={CALENDAR_TEXT.prev[mode]} onPress={calendar.prev} />
        <View className="items-center">
          <Text className="text-md font-bevn-bold text-text-primary">{calendar.title}</Text>
          {calendar.isCurrent ? (
            <Text className="text-xs text-primary font-bevn-medium mt-0.5">{mode === 'month' ? CALENDAR_TEXT.thisMonth : CALENDAR_TEXT.thisWeek}</Text>
          ) : (
            <TouchableOpacity accessibilityRole="button" onPress={() => { Haptic.selection(); calendar.goToday(); }} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text className="text-xs text-text-secondary font-bevn-medium mt-0.5 underline">{CALENDAR_TEXT.backToToday}</Text>
            </TouchableOpacity>
          )}
        </View>
        <NavButton icon="arrow-forward" label={CALENDAR_TEXT.next[mode]} onPress={calendar.next} />
      </View>
    </View>
  );
}
