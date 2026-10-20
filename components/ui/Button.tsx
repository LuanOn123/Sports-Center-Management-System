// components/ui/Button.tsx
// Nút dùng chung: primary (nền lime) / secondary (nền nổi) / outline / danger / ghost; hỗ trợ icon + loading.

import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Chiếm hết chiều ngang (mặc định true) */
  block?: boolean;
  className?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, block = true, className }: ButtonProps) {
  const color = TEXT_COLOR[variant];
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      className={clsx(
        'flex-row items-center justify-center gap-sm rounded-md border',
        size === 'md' ? 'px-lg py-md' : 'px-md py-xs',
        block ? 'self-stretch' : 'self-start',
        CONTAINER[variant],
        inactive && 'opacity-50',
        className,
      )}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={color} /> : null}
      <Text className={clsx('font-bevn-bold', size === 'md' ? 'text-md' : 'text-sm')} style={{ color }}>{title}</Text>
    </TouchableOpacity>
  );
}
