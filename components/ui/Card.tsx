// components/ui/Card.tsx
// Thẻ nền surface dùng chung. `accent` tô viền theo màu (hạng gói, trạng thái); `onPress` biến thẻ thành nút.

import React from 'react';
import { View, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import clsx from 'clsx';
import { Colors } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  /** Màu viền nhấn (hex) — để trống dùng viền mặc định */
  accent?: string;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ children, accent, onPress, className, style, accessibilityLabel }: CardProps) {
  const classes = clsx('bg-bg-surface rounded-lg p-lg border', className);
  const merged = [{ borderColor: accent ? accent + '66' : Colors.border }, style];
  if (onPress) {
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel} className={classes} style={merged} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View className={classes} style={merged}>{children}</View>;
}
