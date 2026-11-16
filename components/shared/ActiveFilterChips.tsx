// components/shared/ActiveFilterChips.tsx
// Chip các bộ lọc ĐANG BẬT (Khám phá lớp, Lịch dạy của HLV) — chạm để gỡ từng cái. Không có bộ lọc nào thì không hiện hàng này,
// nên màn hình mặc định không còn hàng chip "Tất cả" luôn sáng.

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { ChipRow } from './ChipRow';
import { Colors } from '../../constants/theme';
import { FILTER_TEXT } from '../../constants/filters';
import { Haptic } from '../../lib/haptics';

interface ActiveFilterChipsProps<K extends string> {
  filters: readonly { key: K; label: string }[];
  onRemove: (key: K) => void;
}

export function ActiveFilterChips<K extends string>({ filters, onRemove }: ActiveFilterChipsProps<K>) {
  if (filters.length === 0) return null;
  return (
    <ChipRow>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.key}
          accessibilityRole="button"
          accessibilityLabel={FILTER_TEXT.remove(filter.label)}
          className="flex-row items-center gap-1 pl-md pr-sm py-xs rounded-full border"
          style={{ backgroundColor: Colors.primary + '22', borderColor: Colors.primary }}
          onPress={() => { Haptic.selection(); onRemove(filter.key); }}
        >
          <Text className="text-sm font-bevn-medium" style={{ color: Colors.primary }}>{filter.label}</Text>
          <Icon name="close" size={14} color={Colors.primary} />
        </TouchableOpacity>
      ))}
    </ChipRow>
  );
}
