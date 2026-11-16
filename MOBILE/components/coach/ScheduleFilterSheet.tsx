// components/coach/ScheduleFilterSheet.tsx
// Bảng "Bộ lọc" của Lịch dạy HLV (web: hai ô chọn "Lớp học" và "Trạng thái"): chọn một lớp, chọn một trạng thái buổi.
// Khung bảng + chân bảng là components/shared/FilterSheet (dùng chung với Khám phá lớp). Chạm chip là áp dụng ngay.

import React from 'react';
import { FilterChip } from '../shared/FilterChip';
import { FilterSection, FilterSheet } from '../shared/FilterSheet';
import { ChipGroup } from '../shared/FormField';
import { SCHEDULE_FILTER_TEXT as TEXT, SCHEDULE_STATUSES, SCHEDULE_STATUS_LABEL } from '../../constants/schedule';
import { applyFilterLabel } from '../../lib/filters';
import type { ScheduleStatus } from '../../lib/types';

interface ScheduleFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Lớp chọn được: cả lớp được phân công lẫn lớp HLV dạy thay trong kỳ đang xem */
  classes: readonly { id: string; name: string }[];
  classId: string | null;
  onClass: (value: string | null) => void;
  status: ScheduleStatus | null;
  onStatus: (value: ScheduleStatus | null) => void;
  /** Số bộ lọc đang bật; 0 thì "Xóa bộ lọc" không bấm được */
  activeCount: number;
  onClear: () => void;
  /** Số buổi dạy trong kỳ đang xem sau khi lọc (cập nhật sau mỗi lần chọn); undefined khi đang tải */
  resultCount: number | undefined;
}

export function ScheduleFilterSheet({ visible, onClose, classes, classId, onClass, status, onStatus, activeCount, onClear, resultCount }: ScheduleFilterSheetProps) {
  return (
    <FilterSheet
      visible={visible}
      title={TEXT.sheetTitle}
      onClose={onClose}
      activeCount={activeCount}
      onClear={onClear}
      applyLabel={applyFilterLabel(resultCount, TEXT)}
    >
      <FilterSection title={TEXT.class}>
        <ChipGroup>
          <FilterChip label={TEXT.allClasses} active={!classId} onPress={() => onClass(null)} />
          {classes.map((cls) => (
            <FilterChip key={cls.id} label={cls.name} active={classId === cls.id} onPress={() => onClass(cls.id)} />
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection title={TEXT.status}>
        <ChipGroup>
          <FilterChip label={TEXT.allStatuses} active={!status} onPress={() => onStatus(null)} />
          {SCHEDULE_STATUSES.map((value) => (
            <FilterChip key={value} label={SCHEDULE_STATUS_LABEL[value]} active={status === value} onPress={() => onStatus(value)} />
          ))}
        </ChipGroup>
      </FilterSection>
    </FilterSheet>
  );
}
