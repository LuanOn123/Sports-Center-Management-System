// components/ui/StatTile.tsx
// Ô chỉ số gọn: giá trị lớn + nhãn nhỏ (dùng trong hàng 2–4 ô)

import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../constants/theme';

export function StatTile({ label, value, color = Colors.text.primary }: { label: string; value: string | number; color?: string }) {
  return (
    <View className="flex-1 bg-bg-surface rounded-md border border-border px-md py-sm">
      <Text className="text-xl font-bevn-bold" style={{ color }} numberOfLines={1}>{value}</Text>
      <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>{label}</Text>
    </View>
  );
}
