// components/ui/Segmented.tsx
// Bộ chuyển đổi phân đoạn (tab con trong một màn), vd. Sắp tới / Đã đặt / Lịch sử

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Colors } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * solid (mặc định): nút đang chọn nền primary đặc — bộ chuyển CHÍNH của màn.
   * soft: nền nhạt + viền primary, thấp hơn — bộ chuyển phụ nằm dưới một Segmented khác (vd. Tuần / Tháng của lịch).
   */
  tone?: 'solid' | 'soft';
}

export function Segmented<T extends string>({ options, value, onChange, tone = 'solid' }: SegmentedProps<T>) {
  const soft = tone === 'soft';
  return (
    <View className={clsx('flex-row border border-border rounded-md p-1 gap-1', soft ? 'bg-bg-elevated' : 'bg-bg-surface')}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={clsx('flex-1 items-center rounded-sm', soft ? 'py-xs border' : 'py-sm', active && !soft && 'bg-primary')}
            style={soft ? { backgroundColor: active ? Colors.primary + '22' : 'transparent', borderColor: active ? Colors.primary : 'transparent' } : undefined}
            onPress={() => {
              if (active) return;
              Haptic.selection();
              onChange(o.value);
            }}
          >
            <Text className={clsx('text-sm', active ? (soft ? 'text-primary font-bevn-bold' : 'text-text-inverse font-bevn-bold') : 'text-text-secondary font-bevn-medium')}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
