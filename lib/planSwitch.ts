// lib/planSwitch.ts
// Quy tắc đổi gói khi hội viên mua gói mới — khớp BE (subscription-purchase.service.ts › inspectPlanPurchase)
// và web (businessRules.detectPlanSwitchType + MembershipPage):
// - NEW: chưa có gói trả phí → kích hoạt ngay
// - RENEW_SAME_TIER: cùng hạng → BE tự nối tiếp sau ngày hết hạn gói hiện tại
// - UPGRADE: lên hạng → kích hoạt ngay hoặc hẹn ngày (tối đa N ngày)
// - DOWNGRADE: xuống hạng → chỉ bắt đầu từ ngày gói hiện tại hết hạn (tối đa N ngày sau đó)

import { formatDate } from './format';
import { compareDate, parseIsoDate, todayParts, type DateParts } from './profileFields';
import type { PlanSwitchType } from './types';

const TIER_ORDER: Record<string, number> = { FREE: 0, MEMBERSHIP: 1, PREMIUM: 2 };

export interface CurrentSubscriptionLike {
  tier?: string;
  endDate?: string;
  durationDaysSnapshot?: number;
  plan?: { tier?: string; durationDays?: number };
}

export interface PlanLike {
  tier: string;
  durationDays: number;
}

function addDays({ year, month, day }: DateParts, days: number): DateParts {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Gói hiện tại còn chạy tới tương lai không */
function endsInFuture(current: CurrentSubscriptionLike | null | undefined, now: Date) {
  return Boolean(current?.endDate && Date.parse(current.endDate) > now.getTime());
}

export function detectPlanSwitchType(current: CurrentSubscriptionLike | null | undefined, plan: PlanLike): PlanSwitchType {
  const tier = current?.tier ?? current?.plan?.tier;
  if (!current || !tier || tier === 'FREE') return 'NEW';
  const from = TIER_ORDER[tier] ?? 0;
  const to = TIER_ORDER[plan.tier] ?? 0;
  if (to === from) return 'RENEW_SAME_TIER';
  return to > from ? 'UPGRADE' : 'DOWNGRADE';
}

/** Cảnh báo (KHÔNG chặn) khi gia hạn cùng hạng bằng gói ngắn hơn gói hiện tại — như tooltip của web */
export function shorterSameTierWarning(current: CurrentSubscriptionLike | null | undefined, plan: PlanLike) {
  if (detectPlanSwitchType(current, plan) !== 'RENEW_SAME_TIER') return '';
  const currentDays = Number(current?.durationDaysSnapshot ?? current?.plan?.durationDays);
  return Number.isFinite(currentDays) && plan.durationDays < currentDays ? 'Gói này ngắn hơn gói bạn đang dùng.' : '';
}

/** Dòng giải thích dưới nút mua của thẻ gói */
export function planSwitchHint(current: CurrentSubscriptionLike | null | undefined, plan: PlanLike, now = new Date()) {
  const type = detectPlanSwitchType(current, plan);
  const parts: string[] = [];
  if (endsInFuture(current, now)) {
    if (type === 'RENEW_SAME_TIER') parts.push(`Gia hạn tự động nối tiếp sau ${formatDate(current!.endDate!)}.`);
    if (type === 'DOWNGRADE') parts.push(`Gói sẽ kích hoạt sau ngày ${formatDate(current!.endDate!)}.`);
  }
  const warning = shorterSameTierWarning(current, plan);
  if (warning) parts.push(warning);
  return parts.join(' ');
}

export interface PlanStartWindow {
  min: DateParts;
  max: DateParts;
  /** Ngày chọn sẵn khi mở bộ chọn */
  initial: DateParts;
}

/**
 * Khoảng ngày (giờ Việt Nam) được phép hẹn kích hoạt; null nếu loại đổi gói này không cho chọn ngày.
 * - NEW / UPGRADE: từ ngày mai tới hôm nay + maxDays (hôm nay = "Kích hoạt ngay")
 * - DOWNGRADE: từ ngày gói hiện tại hết hạn tới ngày đó + maxDays
 */
export function planStartWindow(
  type: PlanSwitchType,
  current: CurrentSubscriptionLike | null | undefined,
  maxDays: number,
  now = new Date(),
): PlanStartWindow | null {
  const today = todayParts(now);
  if (type === 'NEW' || type === 'UPGRADE') {
    const min = addDays(today, 1);
    return { min, max: addDays(today, maxDays), initial: min };
  }
  if (type === 'DOWNGRADE' && endsInFuture(current, now)) {
    const end = todayParts(new Date(current!.endDate!));
    return { min: end, max: addDays(end, maxDays), initial: end };
  }
  return null;
}

/** Ngày gói mới tự bắt đầu khi hội viên không chọn ngày (gia hạn / hạ cấp); null = kích hoạt ngay */
export function automaticStartDate(type: PlanSwitchType, current: CurrentSubscriptionLike | null | undefined, now = new Date()) {
  return (type === 'RENEW_SAME_TIER' || type === 'DOWNGRADE') && endsInFuture(current, now) ? current!.endDate! : null;
}

/**
 * Giá trị `startDate` gửi lên POST /payments/sepay/checkout; undefined = để BE tự quyết
 * (kích hoạt ngay, hoặc nối tiếp ĐÚNG giờ hết hạn gói hiện tại).
 * Ngày chọn được gửi là 00:00 giờ Việt Nam của ngày đó. Hạ cấp chọn đúng ngày hết hạn thì KHÔNG gửi:
 * 00:00 của ngày đó sớm hơn giờ hết hạn thật nên BE sẽ từ chối.
 */
export function checkoutStartDate(
  type: PlanSwitchType,
  chosenDate: string | undefined,
  current: CurrentSubscriptionLike | null | undefined,
): string | undefined {
  const chosen = parseIsoDate(chosenDate);
  if (!chosen || type === 'RENEW_SAME_TIER') return undefined;
  if (type === 'DOWNGRADE' && current?.endDate && compareDate(chosen, todayParts(new Date(current.endDate))) <= 0) return undefined;
  return new Date(`${chosenDate}T00:00:00+07:00`).toISOString();
}

