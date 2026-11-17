// components/coach/AttendanceEmpty.tsx
// Trạng thái trống của các màn Điểm danh (danh sách buổi, danh sách học viên): icon lớn + tiêu đề + dòng gợi ý

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors, Spacing } from '../../constants/theme';

export function AttendanceEmpty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <View className="items-center justify-center py-[60px]">
      <Icon name={icon} size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
      <Text className="text-md font-bevn-semibold text-text-secondary mb-1">{title}</Text>
      {Boolean(hint) && <Text className="text-xs text-text-muted font-bevn-regular text-center">{hint}</Text>}
    </View>
  );
}
