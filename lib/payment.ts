// lib/payment.ts
// Quy tắc thuần của đơn SePay (VietQR) — màn thanh toán (hooks/member/usePayment) và Trang chủ dùng chung

import { SEPAY_LATE_PAYMENT_REASON, SEPAY_REVIEW_TEXT } from '../constants/sepayReview';
import type { SepayCheckout } from './types';

/**
 * Tiền đã về nhưng gói chưa kích hoạt được — chờ trung tâm đối soát. Đơn đã được ghi nhận hoàn tiền (REFUNDED) thì hết chờ dù
 * BE còn giữ cờ đối soát — web: SepayCheckout `status !== "REFUNDED" && (…)`.
 */
export function requiresReview(checkout: SepayCheckout) {
  return checkout.status !== 'REFUNDED' && Boolean(checkout.requiresReview || checkout.activationStatus === 'REQUIRES_REVIEW');
}

/**
 * Lời nhắn cho đơn đang chờ đối soát (web: SepayCheckout): tiền về sau khi đơn hết hạn/đã đóng (LATE_PAYMENT) có câu riêng
 * về hoàn tiền; lý do khác thì kèm ghi chú của BE. Không bao giờ hiện mã lý do thô như "LATE_PAYMENT" cho người dùng.
 */
export function reviewMessage(checkout: SepayCheckout) {
  if (checkout.reviewReason === SEPAY_LATE_PAYMENT_REASON) return SEPAY_REVIEW_TEXT.late(checkout.orderCode);
  const note = checkout.reviewReason ? SEPAY_REVIEW_TEXT.note(checkout.reviewReason) : '';
  return `${SEPAY_REVIEW_TEXT.notActivated(checkout.orderCode)}${note}`;
}

/** Thanh toán xong và gói đã kích hoạt (web: onConfirmed) */
export function isConfirmed(checkout: SepayCheckout) {
  return checkout.status === 'SUCCESS' && !requiresReview(checkout);
}

/** Đơn còn đang chờ chuyển khoản: PENDING và chưa tới `expiresAt` (hạn không đọc được thì coi như đã hết) */
export function isAwaitingPayment(checkout: SepayCheckout, now: number) {
  return checkout.status === 'PENDING' && Date.parse(checkout.expiresAt) > now;
}

/**
 * Thẻ "Xem trạng thái giao dịch" ở Trang chủ chỉ hiện khi còn thời gian thanh toán, hoặc tiền đã về nhưng đang chờ đối soát.
 * Hết thời gian (hoặc BE đã đóng đơn: FAILED / REFUNDED) thì ẩn — màn Gói thành viên vẫn giữ thẻ để tạo mã mới.
 */
export function isPaymentStatusShownOnHome(checkout: SepayCheckout, now: number) {
  return requiresReview(checkout) || isAwaitingPayment(checkout, now);
}
