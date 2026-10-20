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

export const TIER_ICON: Record<MembershipTier, MaterialIconName> = {
  FREE: 'star-border',
  MEMBERSHIP: 'star',
  PREMIUM: 'workspace-premium',
};

/** Hội viên tự hủy: còn > 15 ngày thì hoàn 30% khoản đã thanh toán (BE là nguồn chính thức) */
export const SELF_CANCEL_REFUND_THRESHOLD_DAYS = 15;
export const SELF_CANCEL_REFUND_RATE = 0.3;
export const CANCEL_REASON_MAX_LENGTH = 500;
