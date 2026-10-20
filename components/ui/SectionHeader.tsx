// components/ui/SectionHeader.tsx
// Tiêu đề một khối nội dung + liên kết "Xem tất cả" (tuỳ chọn)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-md">
      <Text className="text-lg font-bevn-bold text-text-primary">{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity className="flex-row items-center gap-0.5" onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-primary font-bevn-semibold">{actionLabel}</Text>
          <Icon name="chevron-right" size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
