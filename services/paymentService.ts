// services/paymentService.ts
// Tầng gọi API thuần túy — thanh toán gói hội viên qua SePay (VietQR)

import { api, ApiError } from '../lib/api';
import type { SepayCheckout, SepayMockConfirmResult } from '../lib/types';

/** POST /payments/sepay/checkout — tạo đơn VietQR (PENDING) cho gói đã chọn */
export const createSepayCheckout = (planId: string) =>
  api.post<SepayCheckout>('/payments/sepay/checkout', { planId });

/** GET /payments/sepay/:id — trạng thái đơn (BE tự đối soát với SePay khi poll) */
export const getSepayCheckout = (paymentId: string) =>
  api.get<SepayCheckout>(`/payments/sepay/${encodeURIComponent(paymentId)}`);

/** POST /payments/sepay/mock-confirm — DEV: giả lập SePay đã thu tiền (BE cần SEPAY_MOCK_MODE=true) */
export const mockConfirmSepay = (paymentId: string) =>
  api.post<SepayMockConfirmResult>('/payments/sepay/mock-confirm', { paymentId });

/**
 * 409 SEPAY_PAYMENT_PENDING: hội viên còn đơn chờ cho cùng gói — BE trả kèm thông tin
 * đơn cũ trong `errors` (object, không phải mảng) để tiếp tục hiển thị QR đó.
 */
export function pendingCheckoutFromError(error: unknown): SepayCheckout | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const d = error.errors as unknown as (Partial<SepayCheckout> & { code?: string }) | undefined;
  if (
    d?.code !== 'SEPAY_PAYMENT_PENDING' ||
    !d.paymentId ||
    !d.orderCode ||
    typeof d.amount !== 'number' ||
    !d.expiresAt ||
    !d.qrUrl ||
    !d.transferContent
  ) {
    return null;
  }
  return {
    paymentId: d.paymentId,
    orderCode: d.orderCode,
    amount: d.amount,
    currency: d.currency ?? 'VND',
    status: 'PENDING',
    gateway: d.gateway ?? 'SEPAY',
    expiresAt: d.expiresAt,
    qrUrl: d.qrUrl,
    transferContent: d.transferContent,
    bank: d.bank,
    plan: d.plan,
  };
}
