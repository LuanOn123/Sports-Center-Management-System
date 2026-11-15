// components/classes/ClassFilterSheet.tsx
// Bảng "Bộ lọc" của Khám phá lớp học (web: ô chọn "khu vực" và "kỳ học"): chạm chip là áp dụng ngay, "Xong" để đóng.
// Môn tập và hạng lớp vẫn là hai hàng chip ngay trên màn hình.

import React from 'react';
import { View, Text } from 'react-native';
import { BottomSheet } from '../shared/BottomSheet';
import { FilterChip } from '../shared/FilterChip';
import { ChipGroup } from '../shared/FormField';
import { Button } from '../ui';
import { CLASS_AREA_FILTERS, CLASS_AREA_LABEL, CLASS_FILTER_TEXT as TEXT } from '../../constants/classes';
import type { AreaType, Term } from '../../lib/types';

interface ClassFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  areaType: AreaType | undefined;
  onAreaType: (value: AreaType | undefined) => void;
  /** Kỳ học của cơ sở đang chọn */
  terms: readonly Term[];
  termId: string | undefined;
  onTerm: (value: string | undefined) => void;
  /** Kỳ học hiện tại — gắn nhãn "(Kỳ hiện tại)" như web */
  currentTermId: string | undefined;
  /** Số bộ lọc đang bật; 0 thì "Xóa bộ lọc" không bấm được */
  activeCount: number;
  onClear: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-sm">
      <Text className="text-sm text-text-secondary font-bevn-semibold">{title}</Text>
      {children}
    </View>
  );
}

export function ClassFilterSheet({ visible, onClose, areaType, onAreaType, terms, termId, onTerm, currentTermId, activeCount, onClear }: ClassFilterSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title={TEXT.sheetTitle}
      onClose={onClose}
      footer={
        <View className="flex-row gap-md">
          <Button className="flex-1" variant="secondary" title={TEXT.clear} disabled={activeCount === 0} onPress={onClear} />
          <Button className="flex-[2]" title={TEXT.done} onPress={onClose} />
        </View>
      }
    >
      <Section title={TEXT.area}>
        <ChipGroup>
          {CLASS_AREA_FILTERS.map((area) => (
            <FilterChip key={area ?? 'all'} label={area ? CLASS_AREA_LABEL[area] : TEXT.all} active={areaType === area} onPress={() => onAreaType(area)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title={TEXT.term}>
        {terms.length === 0 ? (
          <Text className="text-sm text-text-muted font-bevn-regular">{TEXT.noTerms}</Text>
        ) : (
          <ChipGroup>
            <FilterChip label={TEXT.all} active={!termId} onPress={() => onTerm(undefined)} />
            {terms.map((term) => (
              <FilterChip
                key={term.id}
                label={term.id === currentTermId ? `${term.name} (${TEXT.currentTerm})` : term.name}
                active={termId === term.id}
                onPress={() => onTerm(term.id)}
              />
            ))}
          </ChipGroup>
        )}
      </Section>
    </BottomSheet>
  );
}
