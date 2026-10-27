// constants/terms.ts
// Kỳ học & quy tắc đăng ký muộn (khớp web MemberTermBanner + BE course-enrollment):
// sau hạn đăng ký kỳ học, hội viên VẪN đăng ký được khóa nếu gói đang hiệu lực còn ít nhất
// 50% tổng thời hạn đã mua, tính tại lúc đăng ký (vd gói 180 ngày còn ≥ 90 ngày). BE là nơi quyết định cuối.

import { Colors } from './theme';

/** Tỷ lệ thời hạn gói tối thiểu còn lại để được đăng ký sau hạn đăng ký kỳ học */
export const LATE_REGISTRATION_MIN_REMAINING_RATIO = 0.5;

/** Mã BE trả khi đã quá hạn đăng ký kỳ học mà hội viên không đủ điều kiện đăng ký muộn */
export const TERM_REGISTRATION_CLOSED_CODE = 'TERM_REGISTRATION_CLOSED';

/** Giai đoạn đăng ký của kỳ học — giống nhãn web: Đang chuẩn bị / Sắp mở / Đang mở / Đã đóng / Đã kết thúc */
export type TermPhase = 'planning' | 'upcoming' | 'open' | 'closed' | 'ended';

export const TERM_PHASE_LABEL: Record<TermPhase, string> = {
  planning: 'Đang chuẩn bị',
  upcoming: 'Sắp mở đăng ký',
  open: 'Đang mở đăng ký',
  closed: 'Đã đóng đăng ký',
  ended: 'Đã kết thúc',
};

export type TermNoticeTone = 'success' | 'warning' | 'info' | 'muted';

export const TERM_NOTICE_COLOR: Record<TermNoticeTone, string> = {
  success: Colors.status.success,
  warning: Colors.status.pending,
  info: Colors.status.scheduled,
  muted: Colors.text.muted,
};

export const TERM_NOTICE_ICON: Record<TermNoticeTone, string> = {
  success: 'event-available',
  warning: 'event-busy',
  info: 'schedule',
  muted: 'event-note',
};

/** Màu nhãn kỳ học trên thẻ lớp theo giai đoạn đăng ký */
export const TERM_PHASE_TONE: Record<TermPhase, TermNoticeTone> = {
  planning: 'info',
  upcoming: 'info',
  open: 'success',
  closed: 'warning',
  ended: 'muted',
};

export const LATE_REGISTRATION_TEXT = {
  lateBadge: 'Đăng ký muộn',
  viewPlans: 'Xem gói tập',
  rule: 'Sau hạn đăng ký, chỉ hội viên có gói còn ít nhất 50% tổng thời hạn mới được đăng ký muộn.',
} as const;
