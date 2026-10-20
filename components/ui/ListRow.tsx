// components/ui/ListRow.tsx
// Danh sách dạng hàng (menu Tài khoản, danh sách gọn): ListGroup = khung có tiêu đề nhóm, ListRow = một hàng.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import { Colors, TINT_ALPHA } from '../../constants/theme';

export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="mb-xl">
      {title && <Text className="text-xs text-text-muted font-bevn-semibold uppercase tracking-wide mb-sm px-xs">{title}</Text>}
      <View className="bg-bg-surface rounded-lg border border-border overflow-hidden">{children}</View>
    </View>
  );
}

interface ListRowProps {
  icon?: string;
  /** Màu icon + nền icon nhạt */
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Giá trị bên phải (vd. "92%", số lượng) */
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Hàng cuối nhóm thì bỏ đường kẻ dưới */
  last?: boolean;
}

export function ListRow({ icon, iconColor = Colors.text.secondary, title, subtitle, value, valueColor, onPress, danger, last }: ListRowProps) {
  const titleColor = danger ? Colors.status.failed : Colors.text.primary;
  const content = (
    <View className={clsx('flex-row items-center gap-md px-lg py-md', !last && 'border-b border-divider')}>
      {icon && (
        <View className="w-9 h-9 rounded-md items-center justify-center" style={{ backgroundColor: (danger ? Colors.status.failed : iconColor) + TINT_ALPHA }}>
          <Icon name={icon} size={18} color={danger ? Colors.status.failed : iconColor} />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-md font-bevn-medium" style={{ color: titleColor }}>{title}</Text>
        {subtitle && <Text className="text-xs text-text-muted font-bevn-regular mt-0.5" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {value !== undefined && <Text className="text-sm font-bevn-semibold" style={{ color: valueColor ?? Colors.text.secondary }}>{value}</Text>}
      {onPress && !danger && <Icon name="chevron-right" size={18} color={Colors.text.muted} />}
    </View>
  );
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
  ) : content;
}
