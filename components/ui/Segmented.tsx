// components/ui/Segmented.tsx
// Bộ chuyển đổi phân đoạn (tab con trong một màn), vd. Sắp tới / Đã đặt / Lịch sử

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Haptic } from '../../lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex-row bg-bg-surface border border-border rounded-md p-1 gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={clsx('flex-1 items-center rounded-sm py-sm', active && 'bg-primary')}
            onPress={() => {
              if (active) return;
              Haptic.selection();
              onChange(o.value);
            }}
          >
            <Text className={clsx('text-sm', active ? 'text-text-inverse font-bevn-bold' : 'text-text-secondary font-bevn-medium')}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
