// constants/membership.ts
// Nhãn/biểu tượng hạng hội viên và tham số chính sách gói tập (khớp BE / FE web)

import type { MaterialIconName } from '../navigation/tabConfig';
import type { MembershipTier, PlanSwitchType, SubscriptionStatus } from '../lib/types';
import { Colors } from './theme';

// Nhãn giống FE web (FE/src/shared/config.ts)
export const TIER_LABEL: Record<MembershipTier, string> = {
  FREE: 'Miễn phí',
  MEMBERSHIP: 'Tiêu chuẩn',
  PREMIUM: 'Cao cấp',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Hiệu lực',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
  SUSPENDED: 'Đã thay thế / ngừng quyền lợi',
  SCHEDULED: 'Đã lên lịch',
};

export const SUBSCRIPTION_STATUS_COLOR: Record<SubscriptionStatus, string> = {
  ACTIVE: Colors.status.active,
  EXPIRED: Colors.status.expired,
  CANCELLED: Colors.status.cancelled,
  SUSPENDED: Colors.status.suspended,
  SCHEDULED: Colors.status.scheduled,
};

/** Thẻ "Tài khoản Free" ở màn Gói thành viên (web MembershipPage: membership-free-summary) */
export const FREE_PLAN_TEXT = {
  eyebrow: 'GÓI HIỆN TẠI',
  title: 'Tài khoản Free',
  description: 'Được cấp tự động khi tạo tài khoản. Bạn có thể check-in cơ sở; gói Free chưa bao gồm quyền đăng ký lớp học.',
  hint: 'Chọn một gói bên dưới để mở quyền đăng ký lớp học.',
} as const;

/** Hẹn ngày kích hoạt gói tối đa bao nhiêu ngày (BE: MAX_SCHEDULE_DAYS trong subscription-purchase) */
export const PLAN_SCHEDULE_MAX_DAYS = 60;

/** Nút mua trên thẻ gói theo loại đổi gói (web MembershipPage) */
export const PLAN_SWITCH_BUTTON_LABEL: Record<PlanSwitchType, string> = {
  NEW: 'Chuyển khoản VietQR',
  RENEW_SAME_TIER: 'Gia hạn qua VietQR',
  UPGRADE: 'Nâng cấp qua VietQR',
  DOWNGRADE: 'Lên lịch gói (Hạ cấp)',
};

/** Tiêu đề bảng xác nhận đổi gói */
export const PLAN_SWITCH_TITLE: Record<PlanSwitchType, string> = {
  NEW: 'Đăng ký gói tập',
  RENEW_SAME_TIER: 'Gia hạn gói tập',
  UPGRADE: 'Nâng cấp gói tập',
  DOWNGRADE: 'Lên lịch gói tập tiếp theo (Hạ cấp)',
};

/** Số dòng lịch sử đăng ký hiển thị trên màn Gói */
export const SUBSCRIPTION_HISTORY_LIMIT = 5;

/** Gói chờ kích hoạt (SCHEDULED): BE chặn mua/gia hạn tiếp (409 SCHEDULED_SUBSCRIPTION_EXISTS) cho tới khi hủy hoặc kích hoạt */
export const SCHEDULED_SUBSCRIPTION_TEXT = {
  cancelButton: 'Hủy gói chờ',
  purchaseBlocked: 'Bạn đã có gói chờ kích hoạt. Hãy xử lý gói chờ trước khi mua hoặc gia hạn.',
} as const;

/**
 * Hủy gói — câu chữ khớp web (shared/CancelSubscription): hoàn tiền là YÊU CẦU, chỉ được ghi nhận đã hoàn
 * khi quầy xác nhận biên nhận thực tế; chỉ thu hồi các lượt đặt lớp thuộc quyền của gói bị hủy.
 */
export const CANCEL_SUBSCRIPTION_TEXT = {
  title: 'Xác nhận hủy gói tập',
  doneTitle: 'Đã hủy gói tập',
  keepButton: 'Giữ gói tập',
  closeButton: 'Đóng',
  confirmButton: 'Xác nhận hủy gói',
  reasonLabel: 'Lý do hủy (không bắt buộc)',
  reasonPlaceholder: 'Nhập lý do (nếu có)...',
  failed: 'Hủy gói thất bại. Vui lòng thử lại.',
  defaultPlanName: 'gói tập',
  estimateNote: 'Ước tính theo khoản đã thu nếu có, hoặc giá gói hiện tại. Số tiền chính thức được xác định theo khoản thanh toán gốc và thời điểm xác nhận.',
  noRefund: 'Không phát sinh hoàn tiền.',
  refundRequested: (amount: string) => `Đã yêu cầu hoàn ${amount}. Khoản tiền chỉ được ghi nhận đã hoàn sau khi quầy xác nhận biên nhận thực tế.`,
  daysLeftAtCancel: (days: number) => `Còn ${days} ngày tại thời điểm hủy.`,
  active: {
    consequence: ' sẽ chấm dứt quyền lợi và thu hồi các lượt đặt lớp từ gói này ở mọi cơ sở. Quyền từ gói độc lập hợp lệ được giữ lại.',
    policy: (thresholdDays: number, percent: number) => `Còn trên ${thresholdDays} ngày: hoàn ${percent}% khoản thanh toán gốc. Còn từ ${thresholdDays} ngày trở xuống: không hoàn tiền.`,
    estimate: (days: number) => `Dự kiến còn ${days} ngày · Hoàn khoảng `,
    done: 'Đã hủy gói và thu hồi các lượt đặt lớp thuộc quyền của gói này.',
  },
  scheduled: {
    consequence: ' chỉ hủy gói chờ này, không ảnh hưởng gói đang dùng.',
    policy: 'Gói chưa kích hoạt: yêu cầu hoàn 100% khoản thanh toán gốc. Gói đang dùng được giữ nguyên.',
    estimate: 'Hoàn khoảng ',
    done: 'Đã hủy gói chờ. Gói đang sử dụng được giữ nguyên.',
  },
} as const;

export const TIER_ICON: Record<MembershipTier, MaterialIconName> = {
  FREE: 'star-border',
  MEMBERSHIP: 'star',
  PREMIUM: 'workspace-premium',
};

/** Hội viên tự hủy: còn > 15 ngày thì hoàn 30% khoản đã thanh toán (BE là nguồn chính thức) */
export const SELF_CANCEL_REFUND_THRESHOLD_DAYS = 15;
export const SELF_CANCEL_REFUND_RATE = 0.3;
export const CANCEL_REASON_MAX_LENGTH = 500;
