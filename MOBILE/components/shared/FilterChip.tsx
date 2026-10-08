// components/shared/FilterChip.tsx
// Nút lọc dạng chip (đang chọn: nền primary)

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      className="px-md py-xs rounded-full border"
      style={{
        backgroundColor: active ? Colors.primary : Colors.bg.surface,
        borderColor: active ? Colors.primary : Colors.border,
      }}
      onPress={() => {
        Haptic.selection();
        onPress();
      }}
    >
      <Text className="text-sm font-bevn-medium" style={{ color: active ? Colors.text.inverse : Colors.text.secondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
