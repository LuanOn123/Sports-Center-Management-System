// constants/enrollment.ts
// Điều kiện chặn đăng ký trọn khóa (BE: course-enrollment.service) và lời hướng dẫn gỡ vướng — khớp web
// (FE/src/pages/member/ClassDetailPage.tsx: blockerText / blockerActions). BE luôn là nơi quyết định cuối.

/** Mã `code` của blocker do BE trả trong course-plan và trong lỗi 409 COURSE_ENROLLMENT_FAILED */
export const BLOCKER_CODE = {
  /** Hết quota lớp song song; hạng FREE có quota 0 nên cũng nhận mã này */
  quotaReached: 'CONCURRENT_CLASS_LIMIT_REACHED',
  noSubscription: 'NO_ACTIVE_SUBSCRIPTION',
  subscriptionEndsEarly: 'SUBSCRIPTION_ENDS_BEFORE_COURSE_END',
  premiumRequired: 'PREMIUM_REQUIRED',
  attendancePenalty: 'ATTENDANCE_PENALTY_ACTIVE',
} as const;

/** Blocker mà hội viên tự gỡ được bằng cách mua / nâng cấp / gia hạn gói (web: needsMembership) */
export const MEMBERSHIP_FIX_CODES: readonly string[] = [
  BLOCKER_CODE.noSubscription,
  BLOCKER_CODE.subscriptionEndsEarly,
  BLOCKER_CODE.premiumRequired,
];

/** Việc hội viên làm tiếp để gỡ vướng: các cách mở màn Gói thành viên, hoặc xem các lớp đang giữ chỗ */
export type EnrollAction = 'plans' | 'buy' | 'upgrade' | 'renew' | 'held';

export const ENROLL_TEXT = {
  /** Thẻ lý do khi BE báo chưa đủ điều kiện (course-plan.registration.eligible = false) */
  blockedTitle: 'Chưa thể đăng ký trọn khóa',
  blockedHint: 'Vui lòng xử lý các điều kiện dưới đây trước khi đăng ký.',
  /** Thẻ lý do khi đăng ký bị BE từ chối (409) */
  failedTitle: 'Không thể đăng ký trọn khóa',
  failedFallback: 'Đăng ký khóa học thất bại. Vui lòng thử lại.',
  /** Đang bị tạm khóa đặt lớp vì chuyên cần — chỉ quản lý gỡ được */
  contactManager: 'Vui lòng liên hệ quản lý trung tâm để được hỗ trợ.',
  /** Nhãn nút theo cách gỡ vướng — cùng chữ với web */
  action: {
    plans: 'Xem các gói tập',
    buy: 'Mua gói',
    upgrade: 'Nâng cấp gói',
    renew: 'Gia hạn ngay',
    held: 'Xem các lớp đang giữ',
  },
  /** Nút cố định dưới đáy chi tiết lớp khi không có việc gì để làm tiếp */
  footer: {
    registered: 'Đã đăng ký đủ khóa',
    blocked: 'Chưa thể đăng ký khóa này',
    enroll: (sessions: number) => `Đăng ký trọn khóa · ${sessions} buổi`,
    /** Kỳ học chưa/không còn nhận đăng ký (web: nhãn nút đăng ký theo giai đoạn kỳ) */
    term: {
      planning: 'Kỳ đang lập kế hoạch',
      upcoming: 'Chưa mở đăng ký',
      closed: 'Đã hết hạn đăng ký',
      ended: 'Đã hết hạn đăng ký',
    },
  },
} as const;
