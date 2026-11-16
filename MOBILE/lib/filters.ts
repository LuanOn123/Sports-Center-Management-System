// lib/filters.ts
// Quy tắc chung của bảng "Bộ lọc" (Khám phá lớp, Lịch dạy của HLV).

/** Phần chữ của bảng lọc mà nút chính cần (CLASS_FILTER_TEXT, SCHEDULE_FILTER_TEXT đều có) */
export interface ApplyFilterText {
  done: string;
  noResult: string;
  apply: (count: number) => string;
}

/**
 * Chữ của nút chính trong bảng lọc — cho biết đang có bao nhiêu kết quả sau mỗi lần chọn:
 * đang tải (chưa biết số kết quả) → "Xong"; không có kết quả → câu báo; còn lại → "Xem N …".
 */
export function applyFilterLabel(resultCount: number | undefined, text: ApplyFilterText) {
  if (resultCount === undefined) return text.done;
  return resultCount === 0 ? text.noResult : text.apply(resultCount);
}
