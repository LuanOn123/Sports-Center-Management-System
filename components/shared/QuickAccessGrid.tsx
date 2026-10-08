// components/shared/QuickAccessGrid.tsx
// Lưới "Truy cập nhanh" trên Trang chủ — icon ở trên, tên + mô tả bên dưới, căn giữa ô

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { TINT_ALPHA } from '../../constants/theme';
import type { QuickAccessItem } from '../../navigation/quickAccessConfig';

const ICON_SIZE = 28;

export function QuickAccessGrid({ items }: { items: QuickAccessItem[] }) {
  const router = useRouter();
  return (
    <View className="mb-xl">
      <Text className="text-lg font-bevn-bold text-text-primary mb-md">Truy cập nhanh</Text>
      <View className="flex-row flex-wrap gap-md">
        {items.map((item) => (
          <TouchableOpacity
            key={item.label}
            className="flex-1 min-w-[46%] bg-bg-surface rounded-xl p-md border border-border items-center"
            onPress={() => router.push(item.route)}
            activeOpacity={0.75}
          >
            <View
              className="w-14 h-14 rounded-xl justify-center items-center mb-sm"
              style={{ backgroundColor: item.color + TINT_ALPHA }}
            >
              <Icon name={item.icon} size={ICON_SIZE} color={item.color} />
            </View>
            <Text className="text-sm font-bevn-semibold text-text-primary text-center">{item.label}</Text>
            <Text className="text-[11px] text-text-muted font-bevn-regular mt-0.5 text-center" numberOfLines={1}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
