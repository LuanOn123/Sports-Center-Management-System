// components/shared/FilterSheet.tsx
// Khung chung của bảng "Bộ lọc" (Khám phá lớp, Lịch dạy của HLV): các nhóm chip chọn một + chân bảng gồm
// "Xóa bộ lọc" và nút chính cho biết đang có bao nhiêu kết quả. Chạm chip là áp dụng ngay; nút chính chỉ đóng bảng.

import React, { type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from '../ui';
import { FILTER_TEXT } from '../../constants/filters';

/** Một nhóm lọc trong bảng: tên nhóm + các chip (bọc bằng ChipGroup) */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-sm">
      <Text className="text-sm text-text-secondary font-bevn-semibold">{title}</Text>
      {children}
    </View>
  );
}

interface FilterSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Số bộ lọc đang bật; 0 thì "Xóa bộ lọc" không bấm được */
  activeCount: number;
  onClear: () => void;
  /** Chữ nút chính, đã tính theo số kết quả (lib/filters.applyFilterLabel) */
  applyLabel: string;
  children: ReactNode;
}

export function FilterSheet({ visible, title, onClose, activeCount, onClear, applyLabel, children }: FilterSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <View className="flex-row gap-md">
          <Button className="flex-1" variant="secondary" title={FILTER_TEXT.clear} disabled={activeCount === 0} onPress={onClear} />
          <Button className="flex-[2]" title={applyLabel} onPress={onClose} />
        </View>
      }
    >
      {children}
    </BottomSheet>
  );
}
