export function isEffectiveSubscription(
  s: { status: string; startDate: string; endDate: string },
  now = Date.now(),
) {
  return (
    s.status === "ACTIVE" &&
    Date.parse(s.startDate) <= now &&
    Date.parse(s.endDate) >= now
  );
}

export function effectiveSubscription<
  T extends {
    status: string;
    startDate: string;
    endDate: string;
    tier: string;
  },
>(subscriptions: T[], now = Date.now()): T | undefined {
  return subscriptions
    .filter((s) => isEffectiveSubscription(s, now))
    .sort(
      (a, b) =>
        Number(b.tier === "PREMIUM") - Number(a.tier === "PREMIUM") ||
        Date.parse(b.endDate) - Date.parse(a.endDate),
    )[0];
}

export function paymentTransitions(
  status: string,
  role: string,
  gateway?: unknown,
): string[] {
  if (role !== "MANAGER" || gateway) return [];
  return status === "PENDING"
    ? ["SUCCESS", "FAILED"]
    : status === "SUCCESS"
      ? ["REFUNDED"]
      : [];
}

export function subscriptionTransitions(
  s: { status: unknown; remainingDays?: unknown },
  role: string,
): string[] {
  if (role !== "MANAGER") return [];
  if (s.status === "ACTIVE") return ["SUSPENDED", "CANCELLED"];
  // Policy A: historical subscriptions never resume; remainingDays is audit only.
  return [];
}

export function canCompleteSchedule(
  s: { status?: unknown; endTime?: unknown },
  now = Date.now(),
) {
  return s.status === "SCHEDULED" && Date.parse(String(s.endTime)) <= now;
}

export function terminalSessionError(message: string) {
  return /^Unauthorized: (account is locked|role has changed, please login again|user not found)$/i.test(
    message.trim(),
  );
}

// ---------------------------------------------------------------------------
// Membership transition helpers (ma trận chuyển đổi gói)
// ---------------------------------------------------------------------------

/** Loại chuyển đổi gói hội viên */
export type PlanSwitchType = "NEW" | "RENEW_SAME_TIER" | "UPGRADE" | "DOWNGRADE";

/**
 * Xác định loại chuyển đổi khi hội viên chọn mua một gói mới.
 * - NEW: chưa có gói hoặc đang ở FREE
 * - RENEW_SAME_TIER: cùng hạng → BE tự nối tiếp ngày hết hạn
 * - UPGRADE: lên hạng cao hơn → được chọn kích hoạt ngay hoặc hẹn ngày
 * - DOWNGRADE: xuống hạng thấp hơn → gói mới chỉ bắt đầu sau khi gói cũ hết
 */
export function detectPlanSwitchType(
  currentActiveSub: { tier?: unknown } | undefined | null,
  newPlan: { tier: unknown },
): PlanSwitchType {
  if (!currentActiveSub || String(currentActiveSub.tier) === "FREE") return "NEW";
  const TIER_ORDER: Record<string, number> = { FREE: 0, MEMBERSHIP: 1, PREMIUM: 2 };
  const currentVal = TIER_ORDER[String(currentActiveSub.tier)] ?? 0;
  const newVal = TIER_ORDER[String(newPlan.tier)] ?? 0;
  if (newVal === currentVal) return "RENEW_SAME_TIER";
  if (newVal > currentVal) return "UPGRADE";
  return "DOWNGRADE";
}

/**
 * Trả về lý do cảnh báo (KHÔNG CHẶN) khi mua gói cùng hạng nhưng thời hạn ngắn hơn.
 * Việc hạ cấp sang tier thấp hơn nay được cho phép (gói mới sẽ bắt đầu sau gói cũ
 * hết hạn) và KHÔNG còn bị chặn ở đây — dùng detectPlanSwitchType + Smart Date Picker.
 */
export function downgradeReason(
  current:
    | {
        tier: unknown;
        durationDaysSnapshot?: unknown;
        plan?: { durationDays?: unknown };
      }
    | undefined,
  plan: { tier: unknown; durationDays: unknown },
) {
  if (!current) return "";
  // Chỉ còn cảnh báo cho cùng hạng mà thời hạn ngắn hơn (vẫn hiển thị tooltip)
  if (
    plan.tier === current.tier &&
    Number(plan.durationDays) <
      Number(current.durationDaysSnapshot ?? current.plan?.durationDays)
  )
    return "Không thể mua gói ngắn hơn cùng hạng.";
  return "";
}

export function refundEstimate(
  endDate: string,
  amount: number,
  durationDays: number,
  role: "MEMBER" | "MANAGER",
  now = Date.now(),
) {
  const daysLeft = Math.max(
    0,
    Math.ceil((Date.parse(endDate) - now) / 86400000),
  );
  const refundAmount =
    role === "MEMBER"
      ? daysLeft > 15
        ? Math.round(amount * 0.3)
        : 0
      : durationDays > 0
        ? Math.min(amount, Math.round((amount / durationDays) * daysLeft))
        : 0;
  return { daysLeft, refundAmount };
}

export function canGenerateAttendanceQr(
  schedule: { status?: unknown; startTime?: unknown; endTime?: unknown },
  now = Date.now(),
) {
  return (
    schedule.status === "SCHEDULED" &&
    now >= Date.parse(String(schedule.startTime)) - 30 * 60_000 &&
    now <= Date.parse(String(schedule.endTime))
  );
}
