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

/** Màu nhãn trạng thái từng buổi trong khóa (lib/classPlan › sessionStatusLabel) */
export const SESSION_TONE_COLOR = {
  booked: Colors.status.success,
  completed: Colors.status.scheduled,
  full: Colors.status.failed,
  conflict: Colors.status.pending,
  none: Colors.text.muted,
} as const;

/** Còn ít chỗ hơn hoặc bằng số này thì báo "Sắp kín" */
export const LOW_SLOT_THRESHOLD = 3;

/** Khung "Quyền đăng ký lớp học" ở Lớp của tôi (web MyClassesPage) — câu chữ khớp BE concurrentClassLimitMessage */
export const ENROLLMENT_QUOTA_TEXT = {
  lockedTitle: 'Mở quyền đăng ký lớp học',
  lockedFree: 'Tài khoản Free chưa bao gồm lớp học. Chọn gói Membership hoặc Premium để bắt đầu đăng ký.',
  lockedNoPlan: 'Bạn cần một gói tập còn hiệu lực để đăng ký lớp học.',
  viewPlans: 'Xem các gói tập',
  title: 'Quyền đăng ký lớp học',
  remaining: (n: number) => `Bạn có thể đăng ký thêm ${n} lớp khác nhau.`,
  full: 'Bạn đã đăng ký đủ số lớp của gói hiện tại. Hãy hoàn thành hoặc hủy lớp chưa bắt đầu trước khi đăng ký lớp mới.',
  note: 'Mỗi lớp có nhiều buổi vẫn chỉ tính là một lớp. Giới hạn áp dụng chung tại mọi cơ sở.',
  usedLabel: 'Lớp đang đăng ký',
} as const;
