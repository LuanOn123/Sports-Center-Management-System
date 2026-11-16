// lib/payment.ts
// Quy tắc thuần của đơn SePay (VietQR) — màn thanh toán (hooks/member/usePayment) và Trang chủ dùng chung

import type { SepayCheckout } from './types';

/** Tiền đã về nhưng gói chưa kích hoạt được — chờ trung tâm đối soát */
export function requiresReview(checkout: SepayCheckout) {
  return Boolean(checkout.requiresReview || checkout.activationStatus === 'REQUIRES_REVIEW');
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
