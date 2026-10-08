// components/shared/InfoRow.tsx
// Một dòng "nhãn — giá trị" trong thẻ thông tin; giá trị bôi đen được, có thể kèm nút sao chép

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';

interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  /** Có thì hiện nút sao chép bên phải */
  onCopy?: () => void;
}

export function InfoRow({ label, value, highlight, onCopy }: InfoRowProps) {
  return (
    <View className="flex-row justify-between items-center py-sm border-b border-divider gap-md">
      <Text className="text-sm text-text-secondary font-bevn-regular">{label}</Text>
      <View className="flex-row items-center gap-sm" style={{ flexShrink: 1 }}>
        <Text
          selectable
          className={highlight ? 'text-md text-primary font-bevn-bold' : 'text-sm text-text-primary font-bevn-semibold'}
          style={{ flexShrink: 1, textAlign: 'right' }}
        >
          {value}
        </Text>
        {onCopy && (
          <TouchableOpacity
            className="w-8 h-8 rounded-md bg-bg-elevated items-center justify-center"
            onPress={onCopy}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={`Sao chép ${label}`}
          >
            <Icon name="content-copy" size={15} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
