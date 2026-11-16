// lib/classFilters.ts
// Bộ lọc của Khám phá lớp học (web: bốn ô chọn bộ môn / hạng lớp / khu vực / kỳ học cạnh ô tìm kiếm).
// Trên mobile các bộ lọc nằm trong bảng "Bộ lọc"; màn chính chỉ hiện chúng thành chip gỡ được khi đang bật.

import { CLASS_AREA_LABEL, CLASS_FILTER_TEXT, CLASS_TYPE_LABEL } from '../constants/classes';
import type { AreaType, ClassType } from './types';

export type ClassFilterKey = 'sport' | 'type' | 'area' | 'term';

export interface ClassFilterState {
  sportId?: string;
  classType?: ClassType;
  areaType?: AreaType;
  termId?: string;
}

export interface ClassFilterLookups {
  sports: readonly { id: string; name: string }[];
  terms: readonly { id: string; name: string }[];
}

export interface ActiveClassFilter {
  key: ClassFilterKey;
  label: string;
}

/** Số bộ lọc đang bật — ô tìm kiếm không tính vì luôn hiện trên màn hình */
export function classFilterCount(state: ClassFilterState) {
  return [state.sportId, state.classType, state.areaType, state.termId].filter(Boolean).length;
}

/**
 * Các bộ lọc đang bật theo thứ tự môn → hạng → khu vực → kỳ học. Bộ lọc chưa biết tên (danh sách môn / kỳ học chưa tải xong)
 * vẫn hiện, bằng tên nhóm lọc, để chip không biến mất khi dữ liệu đang tải.
 */
export function activeClassFilters(state: ClassFilterState, lookups: ClassFilterLookups): ActiveClassFilter[] {
  const filters: ActiveClassFilter[] = [];
  if (state.sportId) filters.push({ key: 'sport', label: lookups.sports.find((sport) => sport.id === state.sportId)?.name ?? CLASS_FILTER_TEXT.sport });
  if (state.classType) filters.push({ key: 'type', label: CLASS_TYPE_LABEL[state.classType] });
  if (state.areaType) filters.push({ key: 'area', label: CLASS_AREA_LABEL[state.areaType] });
  if (state.termId) filters.push({ key: 'term', label: lookups.terms.find((term) => term.id === state.termId)?.name ?? CLASS_FILTER_TEXT.term });
  return filters;
}
