// components/classes/ClassSearchBar.tsx
// Hàng tìm kiếm của Khám phá: ô tìm kiếm trải rộng + MỘT nút "Bộ lọc" (huy hiệu = số bộ lọc đang bật).
// Mọi bộ lọc khác nằm trong ClassFilterSheet nên màn hình chỉ có một hàng điều khiển.

import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';
import { CLASS_FILTER_TEXT as TEXT } from '../../constants/classes';
import { Haptic } from '../../lib/haptics';

interface ClassSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Số bộ lọc đang bật trong bảng "Bộ lọc" */
  filterCount: number;
  onOpenFilters: () => void;
}

export function ClassSearchBar({ value, onChange, placeholder, filterCount, onOpenFilters }: ClassSearchBarProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const active = filterCount > 0;

  return (
    <View className="flex-row items-center gap-sm px-xl mb-sm">
      <Pressable
        onPress={() => inputRef.current?.focus()}
        className="flex-1 flex-row items-center bg-bg-surface rounded-lg px-md border border-border"
      >
        <Icon name="search" size={20} color={Colors.text.muted} style={{ marginRight: 4 }} />
        <TextInput
          ref={inputRef}
          className="flex-1 py-md text-text-primary text-md font-bevn-regular"
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          value={value}
          onChangeText={onChange}
          returnKeyType="search"
        />
        {Boolean(value) && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Xóa tìm kiếm">
            <Icon name="close" size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </Pressable>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={active ? `${TEXT.button}, ${TEXT.active(filterCount)}` : TEXT.button}
        className="w-12 h-12 rounded-lg border items-center justify-center"
        style={{ backgroundColor: active ? Colors.primary + '22' : Colors.bg.surface, borderColor: active ? Colors.primary : Colors.border }}
        onPress={() => { Haptic.selection(); onOpenFilters(); }}
      >
        <Icon name="tune" size={20} color={active ? Colors.primary : Colors.text.secondary} />
        {active && (
          <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary items-center justify-center px-1">
            <Text className="text-[10px] font-bevn-bold text-text-inverse leading-[14px]">{filterCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
