// components/account/HelpAccordion.tsx
// Một mục đóng / mở của Hướng dẫn sử dụng (web: <details>): bấm tiêu đề để mở nội dung

import React, { useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';

export function HelpAccordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between gap-md p-lg"
        onPress={() => setOpen((value) => !value)}
        activeOpacity={0.7}
      >
        <Text className="flex-1 text-md text-text-primary font-bevn-bold">{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="arrow-drop-down" size={22} color={Colors.text.secondary} />
        </View>
      </TouchableOpacity>
      {open && <View className="px-lg pb-lg gap-sm">{children}</View>}
    </View>
  );
}
