// components/schedule/CalendarGrid.tsx
// Dải ngày (tuần: 1 hàng) hoặc lưới tháng (4–6 hàng) — cùng một kiểu ô cho cả hai chế độ:
// thứ ngắn ở đầu cột, số ngày, chấm báo ngày có buổi, vòng tròn đặc = ngày chọn, viền = hôm nay.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { MAX_DAY_DOTS, WEEKDAY_SHORT_FROM_MONDAY } from '../../constants/calendar';
import { dayKey, isSameDay, isToday, vietnamDate } from '../../lib/date';
import { dayHeading } from '../../lib/calendar';
import { Haptic } from '../../lib/haptics';

interface DayCellProps {
  day: Date;
  selected: boolean;
  /** Ngày thuộc kỳ đang xem (tháng: không phải ngày của tháng kề) */
  inside: boolean;
  count: number;
  onPress: () => void;
}

function DayCell({ day, selected, inside, count, onPress }: DayCellProps) {
  const dots = Math.min(count, MAX_DAY_DOTS);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${dayHeading(day)}${count ? `, ${count} buổi` : ''}`}
      accessibilityState={{ selected, disabled: !inside }}
      disabled={!inside}
      className="flex-1 items-center py-0.5 gap-0.5"
      onPress={onPress}
    >
      <View className={clsx('w-8 h-8 rounded-full items-center justify-center border', selected ? 'bg-primary border-transparent' : inside && isToday(day) ? 'border-primary' : 'border-transparent')}>
        <Text
          className={clsx('text-sm font-bevn-semibold', selected ? 'text-text-inverse font-bevn-bold' : 'text-text-primary')}
          style={{ opacity: inside ? 1 : 0.35 }}
        >
          {vietnamDate(day).getUTCDate()}
        </Text>
      </View>
      <View className="flex-row gap-[3px] h-[5px]">
        {Array.from({ length: dots }, (_, i) => <View key={i} className="w-[5px] h-[5px] rounded-full bg-primary" />)}
      </View>
    </TouchableOpacity>
  );
}

interface CalendarGridProps {
  weeks: Date[][];
  selected: Date;
  /** Số buổi theo khóa ngày (lib/date.dayKey) */
  counts: ReadonlyMap<string, number>;
  isInPeriod: (day: Date) => boolean;
  onSelect: (day: Date) => void;
}

export function CalendarGrid({ weeks, selected, counts, isInPeriod, onSelect }: CalendarGridProps) {
  return (
    <View className="px-xl pt-sm pb-sm mt-md border-t border-b border-divider">
      <View className="flex-row mb-xs">
        {WEEKDAY_SHORT_FROM_MONDAY.map((label) => (
          <Text key={label} className="flex-1 text-center text-xs text-text-muted font-bevn-semibold uppercase">{label}</Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={dayKey(week[0])} className="flex-row">
          {week.map((day) => (
            <DayCell
              key={dayKey(day)}
              day={day}
              selected={isSameDay(day, selected)}
              inside={isInPeriod(day)}
              count={isInPeriod(day) ? counts.get(dayKey(day)) ?? 0 : 0}
              onPress={() => { Haptic.selection(); onSelect(day); }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
