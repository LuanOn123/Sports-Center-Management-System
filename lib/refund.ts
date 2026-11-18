// lib/refund.ts
// Quy tắc thuần của yêu cầu hoàn tiền một giao dịch (web: MemberPaymentsPage + refundChatPath) — dùng ở màn Thanh toán & hóa đơn
// và nút hành động của thông báo.

import {
  PAYMENT_CODE_LENGTH, REFUND_ELIGIBLE_PAYMENT_STATUS, REFUND_REASON_MIN_LENGTH, REFUND_RECEPTIONIST_FALLBACK, REFUND_TEXT,
} from '../constants/refund';
import type { Invoice } from '../services/workflowService';

type RefundableInvoice = Pick<Invoice, 'paymentId'> & { payment?: { status?: string; refundRequestedAt?: string | null } | null };

/** Chỉ giao dịch đã thanh toán thành công và chưa có yêu cầu hoàn tiền mới được xin hoàn (web: nút "Yêu cầu hoàn tiền") */
export function canRequestRefund(invoice: RefundableInvoice) {
  return Boolean(invoice.paymentId) && invoice.payment?.status === REFUND_ELIGIBLE_PAYMENT_STATUS && !invoice.payment.refundRequestedAt;
}

/** Hóa đơn của giao dịch đã gửi yêu cầu hoàn tiền (đang chờ lễ tân xử lý) */
export function hasRefundRequest(invoice: Pick<RefundableInvoice, 'payment'>) {
  return Boolean(invoice.payment?.refundRequestedAt);
}

/** Lý do hợp lệ: sau khi cắt khoảng trắng còn ít nhất 3 ký tự (BE: trim().min(3)) */
export function isRefundReasonValid(reason: string) {
  return reason.trim().length >= REFUND_REASON_MIN_LENGTH;
}

/** Mã giao dịch hiển thị cho người dùng */
export function paymentCode(paymentId: string) {
  return paymentId.slice(0, PAYMENT_CODE_LENGTH);
}

/** Tin nhắn soạn sẵn gửi lễ tân phụ trách hoàn tiền; thiếu tên thì gọi chung là "lễ tân" như web */
export function refundChatDraft(receptionistName: string | undefined, paymentId: string) {
  return REFUND_TEXT.chatDraft(receptionistName || REFUND_RECEPTIONIST_FALLBACK, paymentCode(paymentId));
}
