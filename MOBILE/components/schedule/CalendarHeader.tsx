// components/schedule/CalendarHeader.tsx
// Đầu khung lịch (Hội viên + HLV): chuyển Tuần / Tháng (trải đều hết bề ngang khung, không dồn một góc) và điều hướng
// kỳ trước / sau kèm "Về hôm nay". Nằm trong khung lịch của ScheduleCalendar cùng với lưới ngày.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Segmented } from '../ui';
import { Colors } from '../../constants/theme';
import { CALENDAR_MODES, CALENDAR_TEXT } from '../../constants/calendar';
import { Haptic } from '../../lib/haptics';
import type { ScheduleCalendarState } from '../../hooks/shared/useScheduleCalendar';

function NavButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-9 h-9 rounded-full bg-bg-elevated items-center justify-center"
      onPress={() => { Haptic.selection(); onPress(); }}
    >
      <Icon name={icon} size={18} color={Colors.text.primary} />
    </TouchableOpacity>
  );
}

export function CalendarHeader({ calendar }: { calendar: ScheduleCalendarState }) {
  const { mode } = calendar;
  return (
    <View className="gap-md">
      {/* tone "soft": nằm dưới bộ chuyển chính "Lịch tập | Lớp của tôi" nên không dùng nền primary đặc để hai bộ chuyển không tranh nhau */}
      <Segmented tone="soft" options={CALENDAR_MODES} value={mode} onChange={calendar.setMode} />
      <View className="flex-row items-center justify-between">
        <NavButton icon="arrow-back" label={CALENDAR_TEXT.prev[mode]} onPress={calendar.prev} />
        <View className="items-center">
          <Text className="text-md font-bevn-bold text-text-primary">{calendar.title}</Text>
          {/* Cùng chiều cao ở cả hai trạng thái để tiêu đề không nhảy khi sang kỳ khác */}
          <View className="h-6 mt-xs justify-center">
            {calendar.isCurrent ? (
              <Text className="text-xs text-primary font-bevn-medium">{mode === 'month' ? CALENDAR_TEXT.thisMonth : CALENDAR_TEXT.thisWeek}</Text>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                className="px-md py-0.5 rounded-full"
                style={{ backgroundColor: Colors.primary + '22' }}
                onPress={() => { Haptic.selection(); calendar.goToday(); }}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              >
                <Text className="text-xs text-primary font-bevn-semibold">{CALENDAR_TEXT.backToToday}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <NavButton icon="arrow-forward" label={CALENDAR_TEXT.next[mode]} onPress={calendar.next} />
      </View>
    </View>
  );
}
