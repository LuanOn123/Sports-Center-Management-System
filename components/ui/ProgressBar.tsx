// components/ui/ProgressBar.tsx
// Thanh tiến độ (số ngày còn lại của gói, quota lớp, tiến độ mục tiêu…): mảnh (sm) hoặc dày (md).
// Thanh dày nằm trong khung nổi (bg-bg-elevated) nên nền thanh dùng màu tối hơn để thấy rõ phần còn lại tới 100%.

import React from 'react';
import { View } from 'react-native';
import clsx from 'clsx';
import { Colors } from '../../constants/theme';

export function ProgressBar({ value, color = Colors.primary, size = 'sm' }: { value: number; color?: string; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View className={clsx('rounded-full overflow-hidden', size === 'md' ? 'h-3 bg-bg-primary' : 'h-1.5 bg-bg-elevated')}>
      <View className={clsx('rounded-full', size === 'md' ? 'h-3' : 'h-1.5')} style={{ width: `${pct * 100}%`, backgroundColor: color }} />
    </View>
  );
}
