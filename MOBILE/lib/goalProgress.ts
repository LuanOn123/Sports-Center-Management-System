// lib/goalProgress.ts
// Tính toán thuần cho mục tiêu & tiến độ khóa học — khớp web (shared/Attendance.tsx: getProgressTheme, AttendanceRow).
// Tiến độ do BE lưu; ở đây chỉ chuẩn hóa giá trị người dùng chỉnh và tính chênh lệch để hiển thị.

import { PROGRESS_LEVELS, PROGRESS_MAX, PROGRESS_MIN, PROGRESS_STEP, type ProgressLevel } from '../constants/goals';
import type { ScheduleEvaluationItem } from './types';

/** Tiến độ nguyên trong [0, 100]; giá trị không phải số → 0 (BE cũng ép về khoảng này) */
export function clampProgress(value: number) {
  const n = Number.isFinite(value) ? Math.round(value) : PROGRESS_MIN;
  return Math.max(PROGRESS_MIN, Math.min(PROGRESS_MAX, n));
}

/** Mức tiến độ (màu + nhãn): dưới 20% cần nỗ lực, 20–69% đang tiến bộ, từ 70% tốt */
export function progressLevel(progress: number): ProgressLevel {
  const p = clampProgress(progress);
  return PROGRESS_LEVELS.find((level) => p < level.below) ?? PROGRESS_LEVELS[PROGRESS_LEVELS.length - 1];
}

/** Nhích tiến độ tới bội số kế tiếp của bước (web: thanh trượt step 5), ví dụ 42 → 45 khi tăng, 42 → 40 khi giảm */
export function stepProgress(progress: number, direction: 1 | -1, step = PROGRESS_STEP) {
  const p = clampProgress(progress);
  return clampProgress(direction > 0 ? (Math.floor(p / step) + 1) * step : (Math.ceil(p / step) - 1) * step);
}

/** Chênh lệch so với mốc trước, ví dụ 45 → 60 là +15 */
export const progressDiff = (previous: number, next: number) => clampProgress(next) - clampProgress(previous);

/** "+15%", "-5%", "0%" */
export const formatProgressDiff = (diff: number) => (diff > 0 ? `+${diff}%` : `${diff}%`);

/** Lời dặn của HLV: bỏ khoảng trắng thừa, rỗng → null (BE nhận nullable) */
export const evaluationNoteOrNull = (text: string) => text.trim() || null;

/**
 * Giá trị ban đầu của sheet đánh giá (web AttendanceRow): buổi đã được đánh giá thì lấy kết quả đó, chưa thì lấy
 * tiến độ hiện tại của mục tiêu; mốc "trước" để tính chênh lệch lấy tương tự.
 */
export function evaluationDraft(item: Pick<ScheduleEvaluationItem, 'currentProgress' | 'evaluation'> | undefined) {
  const evaluation = item?.evaluation;
  const current = item?.currentProgress ?? PROGRESS_MIN;
  return {
    progress: clampProgress(evaluation ? evaluation.newProgress : current),
    previousProgress: clampProgress(evaluation ? evaluation.previousProgress : current),
    note: evaluation?.description ?? '',
  };
}
