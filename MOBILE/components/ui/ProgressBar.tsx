// components/ui/ProgressBar.tsx
// Thanh tiến độ mảnh (số ngày còn lại của gói, quota lớp…)

import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../constants/theme';

export function ProgressBar({ value, color = Colors.primary }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
      <View className="h-1.5 rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
    </View>
  );
}
