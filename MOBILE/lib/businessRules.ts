// lib/businessRules.ts
// Luật nghiệp vụ phía client — bản sao 1-1 của FE web (FE/src/shared/businessRules.ts),
// chỉ giữ các luật màn hình Member/Coach dùng. BE luôn là nguồn chính thức.

import {
  SELF_CANCEL_REFUND_RATE,
  SELF_CANCEL_REFUND_THRESHOLD_DAYS,
} from '../constants/membership';
import { ATTENDANCE_OPEN_BEFORE_MS } from '../constants/attendance';
import { MAX_MEMBER_AGE, MIN_MEMBER_AGE, VN_PHONE_MAX_DIGITS, VN_PHONE_MIN_DIGITS, VN_PHONE_PREFIX } from '../constants/profile';
import { birthDateError, todayParts } from './profileFields';
import { daysUntil } from './date';

/**
 * Id hồ sơ hội viên của tài khoản; null nếu tài khoản chưa có hồ sơ.
 * KHÔNG dùng tạm user.id: BE sẽ trả "Member not found" — màn hình phải báo thiếu hồ sơ như web.
 */
export function memberProfileIdOf(user: { memberProfile?: { id?: string | null } | null } | null | undefined) {
  return user?.memberProfile?.id || null;
}

/** Đang trong cửa sổ điểm danh: chưa hủy, từ 30' trước giờ bắt đầu tới khi kết thúc (web: canWrite) */
export function canTakeAttendance(
  schedule: { status?: string; startTime: string; endTime: string },
  now = Date.now(),
) {
  return (
    schedule.status !== 'CANCELLED' &&
    Date.parse(schedule.startTime) - ATTENDANCE_OPEN_BEFORE_MS <= now &&
    now <= Date.parse(schedule.endTime)
  );
}

/** Được tạo QR điểm danh: buổi SCHEDULED và đang trong cửa sổ điểm danh (web: canGenerateAttendanceQr) */
export function canGenerateAttendanceQr(
  schedule: { status?: string; startTime: string; endTime: string },
  now = Date.now(),
) {
  return schedule.status === 'SCHEDULED' && canTakeAttendance(schedule, now);
}

/** Gói đang cấp quyền: ACTIVE và startDate <= now <= endDate */
export function isEffectiveSubscription(
  s: { status: string; startDate: string; endDate: string },
  now = Date.now(),
) {
  return s.status === 'ACTIVE' && Date.parse(s.startDate) <= now && Date.parse(s.endDate) >= now;
}

/** Gói hiệu lực của hội viên — ưu tiên PREMIUM, rồi gói hết hạn muộn nhất */
export function effectiveSubscription<
  T extends { status: string; startDate: string; endDate: string; tier?: string },
>(subscriptions: T[], now = Date.now()): T | undefined {
  return subscriptions
    .filter((s) => isEffectiveSubscription(s, now))
    .sort(
      (a, b) =>
        Number(b.tier === 'PREMIUM') - Number(a.tier === 'PREMIUM') ||
        Date.parse(b.endDate) - Date.parse(a.endDate),
    )[0];
}

/** Giá trung bình mỗi ngày của gói (web: "Khoảng … đ/ngày"); null nếu gói miễn phí/không có thời hạn */
export function planDailyPrice(plan: { price: string | number; durationDays: number }) {
  const price = Number(plan.price);
  return price > 0 && plan.durationDays > 0 ? Math.round(price / plan.durationDays) : null;
}

/** Gói mua được qua SePay (BE chặn gói FREE / giá 0) */
export function isPurchasablePlan(plan: { price: string | number }) {
  return Number(plan.price) > 0;
}

/** Ước tính hoàn tiền khi hội viên tự hủy gói */
export function selfCancelRefundEstimate(endDate: string, amount: number, now = Date.now()) {
  const daysLeft = daysUntil(endDate, now);
  const refundAmount =
    daysLeft > SELF_CANCEL_REFUND_THRESHOLD_DAYS ? Math.round(amount * SELF_CANCEL_REFUND_RATE) : 0;
  return { daysLeft, refundAmount, willRefund: refundAmount > 0 };
}

/** Lỗi ngày sinh theo độ tuổi cho phép (hồ sơ + đăng ký); null nếu hợp lệ hoặc bỏ trống */
export function memberBirthDateError(value: string | null | undefined, now = new Date()) {
  return birthDateError(value, todayParts(now), MIN_MEMBER_AGE, MAX_MEMBER_AGE);
}

/**
 * Chuẩn hoá số điện thoại khi gõ: chỉ giữ chữ số, đầu số luôn là 0 (gõ "9..." → "09...",
 * dán "+84..." → "0..."), tối đa VN_PHONE_MAX_DIGITS số.
 */
export function normalizeVnPhoneInput(text: string) {
  const digits = text.trim().replace(/^\+84/, VN_PHONE_PREFIX).replace(/\D/g, '');
  if (!digits) return '';
  const withPrefix = digits.startsWith(VN_PHONE_PREFIX) ? digits : VN_PHONE_PREFIX + digits;
  return withPrefix.slice(0, VN_PHONE_MAX_DIGITS);
}

/** Lỗi số điện thoại Việt Nam; null nếu hợp lệ hoặc bỏ trống (không bắt buộc) */
export function vnPhoneError(value: string | null | undefined) {
  if (!value) return null;
  const pattern = new RegExp(`^${VN_PHONE_PREFIX}\\d{${VN_PHONE_MIN_DIGITS - 1},${VN_PHONE_MAX_DIGITS - 1}}$`);
  return pattern.test(value) ? null : `Số điện thoại phải bắt đầu bằng ${VN_PHONE_PREFIX} và có ${VN_PHONE_MIN_DIGITS}–${VN_PHONE_MAX_DIGITS} chữ số`;
}
