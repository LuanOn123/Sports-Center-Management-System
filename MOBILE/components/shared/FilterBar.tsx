// components/shared/FilterBar.tsx
// Hàng "Bộ lọc" trải hết bề ngang (Lịch dạy của HLV): MỘT nút mở bảng lọc, thay cho các hàng chip lọc luôn hiện.
// Chưa bật bộ lọc nào: gợi ý bảng lọc theo gì. Có bộ lọc đang bật: viền + icon chuyển màu chính và hiện số bộ lọc
// (không tô nền cả hàng — các chip gỡ nhanh bên dưới đã mang màu nhấn).

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';
import { FILTER_TEXT } from '../../constants/filters';
import { Haptic } from '../../lib/haptics';

interface FilterBarProps {
  /** Gợi ý khi chưa bật bộ lọc nào, vd. "Lọc theo lớp và trạng thái" */
  hint: string;
  /** Số bộ lọc đang bật */
  count: number;
  onPress: () => void;
}

export function FilterBar({ hint, count, onPress }: FilterBarProps) {
  const active = count > 0;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={active ? `${FILTER_TEXT.button}, ${FILTER_TEXT.active(count)}` : hint}
      className="flex-row items-center gap-sm h-12 px-md bg-bg-surface rounded-lg border"
      style={{ borderColor: active ? Colors.primary : Colors.border }}
      onPress={() => { Haptic.selection(); onPress(); }}
    >
      <Icon name="tune" size={20} color={active ? Colors.primary : Colors.text.secondary} />
      <Text className="flex-1 text-md font-bevn-medium" style={{ color: active ? Colors.text.primary : Colors.text.secondary }}>
        {active ? FILTER_TEXT.button : hint}
      </Text>
      {active ? (
        <View className="min-w-[22px] h-[22px] rounded-full bg-primary items-center justify-center px-1">
          <Text className="text-xs font-bevn-bold text-text-inverse">{count}</Text>
        </View>
      ) : (
        <Icon name="arrow-drop-down" size={20} color={Colors.text.muted} />
      )}
    </TouchableOpacity>
  );
}
