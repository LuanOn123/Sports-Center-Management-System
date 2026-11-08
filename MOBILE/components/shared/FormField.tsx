// components/shared/FormField.tsx
// Khối "nhãn + ô nhập + thông báo lỗi" và nhóm chip dùng chung cho các form (hồ sơ cá nhân, đăng ký)

import React from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Hiện dấu * sau nhãn */
  required?: boolean;
  /** Để màn cha biết vị trí ô khi cần cuộn tới (hooks/shared/useFieldScroll) */
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}

export function FormField({ label, hint, error, required, onLayout, children }: FormFieldProps) {
  return (
    <View className="mb-lg" onLayout={onLayout}>
      <Text className="text-sm text-text-secondary mb-sm font-bevn-medium">
        {label}
        {required ? <Text className="text-status-failed font-bevn-medium">{' *'}</Text> : null}
        {hint ? <Text className="text-xs text-text-muted font-bevn-regular">{`  ${hint}`}</Text> : null}
      </Text>
      {children}
      {error ? <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{error}</Text> : null}
    </View>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-sm">{children}</View>;
}
