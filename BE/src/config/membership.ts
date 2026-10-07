import type { MemberTier } from "@prisma/client";

/**
 * Quota lớp học song song (MembershipPlan.maxConcurrentClasses) — nguồn duy nhất cho con số
 * nghiệp vụ mặc định, KHÔNG hard-code trong service đặt chỗ.
 *
 * Luật: một hội viên được giữ đồng thời tối đa N Class KHÁC NHAU
 * (đếm DISTINCT Class có Enrollment BOOKED ở buổi SCHEDULED chưa bắt đầu).
 */
export const DEFAULT_MAX_CONCURRENT_CLASSES: Record<MemberTier, number> = {
  FREE: 0,
  MEMBERSHIP: 3,
  PREMIUM: 6,
};

/**
 * Quota dùng khi Manager tạo MembershipPlan mà không chỉ định `maxConcurrentClasses`.
 * Cùng giá trị với backfill của migration `20260923150000_add_max_concurrent_classes`.
 */
export function resolveMaxConcurrentClasses(tier: MemberTier, provided?: number): number {
  return provided ?? DEFAULT_MAX_CONCURRENT_CLASSES[tier] ?? 0;
}

/**
 * B07 — Vòng đời gói tập (job định kỳ trong server.ts):
 * - Gói ACTIVE/SUSPENDED quá `endDate` ⇒ chuyển stored-state sang `EXPIRED` + thông báo.
 * - Nhắc hết hạn trước N ngày (dedupe theo subscription trong cửa sổ giờ).
 * - Tự đóng giao dịch SePay PENDING quá TTL (tiền về muộn vẫn vào nhánh LATE để đối soát).
 * Lưu ý: quyền sử dụng hiệu lực vẫn được suy ra theo `startDate <= now <= endDate` ở mọi query —
 * stored-state chỉ đồng bộ để báo cáo/thông báo, KHÔNG thay đổi luật hiệu lực.
 */
export const SUBSCRIPTION_LIFECYCLE = {
  /** Nhắc trước khi gói hết hạn (ngày). */
  REMINDER_DAYS_BEFORE: 3,
  /** Không gửi nhắc lại cho cùng một gói trong vòng bao nhiêu giờ. */
  REMINDER_DEDUPE_HOURS: 24,
  /** Số gói xử lý tối đa mỗi lượt job (tránh block lâu). */
  EXPIRE_BATCH: 500,
  /** Số giao dịch PENDING đóng tối đa mỗi lượt. */
  CLOSE_PENDING_BATCH: 200,
} as const;

/**
 * FREE plan hệ thống (tier FREE, maxConcurrentClasses = 0, isActive = true).
 *
 * Member mới được auto-provision một MembershipSubscription ACTIVE với plan này
 * (`ensureActiveFreeSubscription`) để không rơi vào trạng thái "không có subscription".
 * Chỉ dùng ĐÚNG MỘT plan FREE: provisioning reuse plan FREE active đang có, seed upsert `plan-free-001`.
 */
export const FREE_PLAN = {
  name: "FREE",
  description:
    "Gói mặc định cấp khi tạo tài khoản hội viên: chưa bao gồm lớp học (0 lớp song song).",
  price: 0,
  /**
   * 10 năm — đủ dài để subscription FREE luôn ACTIVE theo thời hạn của hội viên.
   * LƯU Ý: đây chỉ là thời hạn "giữ chỗ" của gói hệ thống.
   * Ngày dư từ gói cũ KHÔNG được cộng dồn vào gói mới (xem `activateSubscriptionForPayment`).
   */
  durationDays: 3650,
  tier: "FREE" as MemberTier,
} as const;

/**
 * Phase 1 — check-in vào cơ sở (FacilityVisit).
 * Cửa sổ chống check-in trùng vô tình (quét QR 2 lần liên tiếp / double-click):
 * cùng (member × facility) trong N phút → trả về lượt đã có thay vì tạo mới.
 * Tập trung một nơi để tránh hard-code trong service.
 */
export const FACILITY_CHECKIN = {
  DEDUPE_MINUTES: 5,
} as const;

/**
 * Phase 4 — travel buffer liên cơ sở (phút).
 * Cùng facility: giữ nguyên luật trùng giờ (chạm biên cho phép).
 * Khác facility: 2 buổi coi như xung đột nếu khoảng nghỉ < buffer
 * (không đủ thời gian di chuyển). Không dùng khoảng cách địa lý/map —
 * đây là business rule lịch học, không phải hệ thống định vị.
 * Đọc env động để vận hành chỉnh không cần deploy lại code.
 */
export function crossFacilityTravelBufferMinutes(): number {
  const raw = Number(process.env.CROSS_FACILITY_TRAVEL_BUFFER_MINUTES ?? 30);
  if (!Number.isFinite(raw) || raw < 0) return 30;
  return Math.min(180, Math.floor(raw));
}

