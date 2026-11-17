// components/ui/Button.tsx
// Nút dùng chung: primary (nền lime) / secondary (nền nổi) / outline / danger / ghost; hỗ trợ icon + loading.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary border-primary',
  secondary: 'bg-bg-elevated border-border',
  outline: 'bg-transparent border-border',
  danger: 'bg-transparent border-status-failed',
  ghost: 'bg-transparent border-transparent',
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: Colors.text.inverse,
  secondary: Colors.text.primary,
  outline: Colors.text.primary,
  danger: Colors.status.failed,
  ghost: Colors.primary,
};

interface ButtonBaseProps {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Chiếm hết chiều ngang (mặc định true) */
  block?: boolean;
  className?: string;
}

/**
 * `asLabel`: chỉ VẼ nút, không tự bấm được — dùng khi nút nằm trong một khối đã bấm được (vd. thẻ "Buổi tập tiếp theo").
 * Nút lồng trong nút là HTML không hợp lệ trên web (cảnh báo hydration) và trên điện thoại hai vùng bấm chồng lên nhau.
 */
type ButtonProps = ButtonBaseProps & ({ asLabel: true; onPress?: never } | { asLabel?: false; onPress: () => void });

export function Button({ title, variant = 'primary', size = 'md', icon, loading, disabled, block = true, className, ...mode }: ButtonProps) {
  const color = TEXT_COLOR[variant];
  const inactive = disabled || loading;
  const classes = clsx(
    'flex-row items-center justify-center gap-sm rounded-md border',
    size === 'md' ? 'px-lg py-md' : 'px-md py-xs',
    block ? 'self-stretch' : 'self-start',
    CONTAINER[variant],
    inactive && 'opacity-50',
    className,
  );
  const content = (
    <>
      {loading ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={color} /> : null}
      <Text className={clsx('font-bevn-bold', size === 'md' ? 'text-md' : 'text-sm')} style={{ color }}>{title}</Text>
    </>
  );
  if (mode.asLabel) return <View className={classes}>{content}</View>;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      className={classes}
      onPress={mode.onPress}
      disabled={inactive}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  );
}
