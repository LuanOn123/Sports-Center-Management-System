// components/classes/ClassFilterSheet.tsx
// Bảng "Bộ lọc" của Khám phá lớp học (web: bốn ô chọn bộ môn / hạng lớp / khu vực / kỳ học): TẤT CẢ bộ lọc nằm ở đây để màn chính gọn.
// Khung bảng + chân bảng là components/shared/FilterSheet (dùng chung với Lịch dạy của HLV). Chạm chip là áp dụng ngay;
// nút chính cho biết đang có bao nhiêu lớp. Khu vực + kỳ học chỉ có ở hội viên (đăng ký theo kỳ như web).

import React from 'react';
import { Text } from 'react-native';
import { FilterChip } from '../shared/FilterChip';
import { FilterSection, FilterSheet } from '../shared/FilterSheet';
import { ChipGroup } from '../shared/FormField';
import { CLASS_AREA_FILTERS, CLASS_AREA_LABEL, CLASS_FILTER_TEXT as TEXT, CLASS_TYPE_FILTERS, CLASS_TYPE_LABEL } from '../../constants/classes';
import { applyFilterLabel } from '../../lib/filters';
import type { AreaType, ClassType, Term } from '../../lib/types';

interface ClassFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  sports: readonly { id: string; name: string }[];
  sportId: string | undefined;
  onSport: (value: string | undefined) => void;
  classType: ClassType | undefined;
  onClassType: (value: ClassType | undefined) => void;
  /** Khu vực + kỳ học: chỉ hội viên */
  showRegistrationFilters: boolean;
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
  /** Số lớp đang hiện sau khi lọc (cập nhật sau mỗi lần chọn); undefined khi đang tải */
  resultCount: number | undefined;
}

export function ClassFilterSheet({
  visible, onClose, sports, sportId, onSport, classType, onClassType, showRegistrationFilters,
  areaType, onAreaType, terms, termId, onTerm, currentTermId, activeCount, onClear, resultCount,
}: ClassFilterSheetProps) {
  return (
    <FilterSheet
      visible={visible}
      title={TEXT.sheetTitle}
      onClose={onClose}
      activeCount={activeCount}
      onClear={onClear}
      applyLabel={applyFilterLabel(resultCount, TEXT)}
    >
      <FilterSection title={TEXT.sport}>
        <ChipGroup>
          <FilterChip label={TEXT.all} active={!sportId} onPress={() => onSport(undefined)} />
          {sports.map((sport) => (
            <FilterChip key={sport.id} label={sport.name} active={sportId === sport.id} onPress={() => onSport(sport.id)} />
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection title={TEXT.type}>
        <ChipGroup>
          {CLASS_TYPE_FILTERS.map((type) => (
            <FilterChip key={type ?? 'all'} label={type ? CLASS_TYPE_LABEL[type] : TEXT.all} active={classType === type} onPress={() => onClassType(type)} />
          ))}
        </ChipGroup>
      </FilterSection>

      {showRegistrationFilters && (
        <>
          <FilterSection title={TEXT.area}>
            <ChipGroup>
              {CLASS_AREA_FILTERS.map((area) => (
                <FilterChip key={area ?? 'all'} label={area ? CLASS_AREA_LABEL[area] : TEXT.all} active={areaType === area} onPress={() => onAreaType(area)} />
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection title={TEXT.term}>
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
          </FilterSection>
        </>
      )}
    </FilterSheet>
  );
}
