// components/ui/EmptyState.tsx
// Trạng thái trống gọn: icon + tiêu đề + mô tả + hành động (tuỳ chọn)

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Button } from './Button';
import { Colors } from '../../constants/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="bg-bg-surface rounded-lg border border-border items-center px-xl py-xxl">
      <Icon name={icon} size={32} color={Colors.text.muted} />
      <Text className="text-md text-text-primary font-bevn-semibold text-center mt-sm">{title}</Text>
      {description && <Text className="text-sm text-text-muted font-bevn-regular text-center mt-xs">{description}</Text>}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} size="sm" block={false} className="mt-lg self-center" />}
    </View>
  );
}
