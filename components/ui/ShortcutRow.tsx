// components/ui/ShortcutRow.tsx
// Hàng lối tắt trên Trang chủ (tối đa 4 ô, không trùng với tab) — cấu hình ở navigation/quickAccessConfig.ts

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { TINT_ALPHA } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import type { QuickAccessItem } from '../../navigation/quickAccessConfig';

export function ShortcutRow({ items }: { items: QuickAccessItem[] }) {
  const router = useRouter();
  return (
    <View className="flex-row justify-between mb-xl">
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          className="items-center flex-1"
          onPress={() => {
            Haptic.light();
            router.push(item.route);
          }}
          activeOpacity={0.75}
        >
          <View className="w-14 h-14 rounded-lg items-center justify-center mb-xs" style={{ backgroundColor: item.color + TINT_ALPHA }}>
            <Icon name={item.icon} size={24} color={item.color} />
          </View>
          <Text className="text-xs text-text-secondary font-bevn-medium text-center" numberOfLines={1}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
