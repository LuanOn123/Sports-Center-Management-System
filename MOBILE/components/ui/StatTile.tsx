// components/ui/StatTile.tsx
// Ô chỉ số gọn: giá trị lớn + nhãn nhỏ (+ ghi chú nhỏ hơn, vd. tỷ lệ %) — dùng trong hàng 2–4 ô

import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../constants/theme';

interface StatTileProps {
  label: string;
  value: string | number;
  color?: string;
  /** Dòng phụ dưới nhãn, vd. "40% tất cả buổi" */
  note?: string;
}

export function StatTile({ label, value, color = Colors.text.primary, note }: StatTileProps) {
  return (
    <View className="flex-1 bg-bg-surface rounded-md border border-border px-md py-sm">
      <Text className="text-xl font-bevn-bold" style={{ color }} numberOfLines={1}>{value}</Text>
      <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>{label}</Text>
      {Boolean(note) && <Text className="text-[10px] text-text-muted font-bevn-regular mt-0.5" numberOfLines={1}>{note}</Text>}
    </View>
  );
}
