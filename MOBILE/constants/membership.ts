// constants/membership.ts
// Nhãn/biểu tượng hạng hội viên và tham số chính sách gói tập (khớp BE / FE web)

import type { MaterialIconName } from '../navigation/tabConfig';
import type { MembershipTier, SubscriptionStatus } from '../lib/types';
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
  SUSPENDED: 'Tạm dừng',
};

export const SUBSCRIPTION_STATUS_COLOR: Record<SubscriptionStatus, string> = {
  ACTIVE: Colors.status.active,
  EXPIRED: Colors.status.expired,
  CANCELLED: Colors.status.cancelled,
  SUSPENDED: Colors.status.suspended,
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
