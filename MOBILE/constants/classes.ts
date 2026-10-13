// constants/classes.ts
// Nhãn / tham số hiển thị lớp học (khớp FE web: StatusBadge REGULAR / PREMIUM)

import type { ClassType } from '../lib/types';
import { Colors } from './theme';

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  REGULAR: 'Tiêu chuẩn',
  PREMIUM: 'Cao cấp',
};

export const CLASS_TYPE_COLOR: Record<ClassType, string> = {
  REGULAR: Colors.status.scheduled,
  PREMIUM: Colors.tier.PREMIUM,
};

/** Bộ lọc hạng lớp trên màn Khám phá (undefined = tất cả) */
export const CLASS_TYPE_FILTERS: (ClassType | undefined)[] = [undefined, 'REGULAR', 'PREMIUM'];

/** Số khung giờ trong tuần hiện trên thẻ lớp, phần còn lại gộp "+n khung giờ khác" */
export const CLASS_CARD_SLOT_PREVIEW = 2;

/** Còn ít chỗ hơn hoặc bằng số này thì báo "Sắp kín" */
export const LOW_SLOT_THRESHOLD = 3;
