// components/ui/StatusBadge.tsx
// Nhãn trạng thái dạng viên thuốc: nền nhạt + chữ cùng màu

import React from 'react';
import { View, Text } from 'react-native';

export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View className="self-start rounded-full px-sm py-0.5" style={{ backgroundColor: color + '22' }}>
      <Text className="text-xs font-bevn-semibold" style={{ color }}>{label}</Text>
    </View>
  );
}
