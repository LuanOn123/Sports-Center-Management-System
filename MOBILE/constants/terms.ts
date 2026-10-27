// constants/terms.ts
// Kỳ học: giai đoạn đăng ký (khớp web MemberTermBanner / ClassDetailPage) và quy tắc "còn ≥ 50% thời hạn gói" của BE
// (HALF_REMAINING_TERM_V1): gói hết hạn TRƯỚC buổi cuối của khóa vẫn đăng ký được trọn kỳ nếu tại lúc đăng ký gói còn
// ít nhất 50% tổng thời hạn (ví dụ gói 180 ngày còn ≥ 90 ngày) — quyền học áp dụng đến hết kỳ. Hạn đăng ký của kỳ học
// không được nới. BE là nơi quyết định cuối.

import { Colors } from './theme';

/** Chính sách BE trả ở registration.membershipCoverage.policy */
export const TERM_MEMBERSHIP_POLICY = 'HALF_REMAINING_TERM_V1';

/** Tỷ lệ thời hạn gói tối thiểu còn lại (tại lúc đăng ký) để đăng ký trọn kỳ vượt hạn gói */
export const TERM_MEMBERSHIP_MIN_REMAINING_RATIO = 0.5;

/**
 * Mã BE chặn đăng ký vì giai đoạn của kỳ học (lập kế hoạch / chưa mở / hết hạn đăng ký / đã kết thúc).
 * Thẻ kỳ học đã nói đủ nên không lặp lại các dòng chặn này; mã khác (vd gói hết hạn trước khóa) vẫn hiện nguyên văn.
 */
export const TERM_STAGE_BLOCKER_CODES: readonly string[] = [
  'TERM_REGISTRATION_NOT_OPEN',
  'TERM_REGISTRATION_NOT_STARTED',
  'TERM_REGISTRATION_CLOSED',
  'TERM_CLOSED',
];

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

/** Banner "đủ điều kiện thời hạn cho trọn kỳ" — cùng lời với web (ClassDetailPage) */
export const MEMBERSHIP_COVERAGE_TEXT = {
  title: 'Đủ điều kiện thời hạn cho trọn kỳ',
  message: (validUntil: string, subscriptionEnd: string) =>
    `Gói còn ít nhất 50% thời hạn tại thời điểm xét đăng ký. Quyền học áp dụng cho lớp trong kỳ này đến ${validUntil}, kể cả khi gói hết hạn ngày ${subscriptionEnd}. Ngày hết hạn gói không thay đổi.`,
} as const;

/** Dòng giải thích tỷ lệ thời hạn còn lại ở thẻ gói đang dùng */
export const MEMBERSHIP_HALF_HINT_TEXT = {
  enough: (percent: number) => `Còn ${percent}% thời hạn gói — đủ điều kiện (≥ 50%) đăng ký trọn kỳ học dù gói hết hạn trước khi kỳ kết thúc.`,
  short: (percent: number) => `Còn ${percent}% thời hạn gói — cần còn ít nhất 50% để đăng ký trọn kỳ học vượt hạn gói.`,
} as const;
