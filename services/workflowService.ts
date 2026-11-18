import { api } from '../lib/api';
import { allPages } from '../lib/pagedApi';

export interface WaitlistEntry {
  id: string; scheduleId: string; position: number; status: 'WAITING' | 'PROMOTED' | 'CANCELLED';
  schedule?: { startTime: string; class?: { name: string } };
}
export interface FacilityVisit {
  id: string; checkInAt: string; method: string; facility?: { name: string };
}
export interface SupportIssue {
  id: string; title: string; description: string; status: string; response?: string; createdAt?: string;
}
export interface PaymentRecord {
  id: string; amount: string; status: string; method: string; transactionCode?: string; paidAt?: string; createdAt: string;
  /** Hội viên đã gửi yêu cầu hoàn tiền, đang chờ lễ tân xử lý (BE: refundRequestedAt / refundRequestedAmount) */
  refundRequestedAt?: string | null;
  refundRequestedAmount?: string | number | null;
}
/** Lễ tân phụ trách hoàn tiền tại cơ sở của giao dịch (BE: findRefundReceptionist) */
export interface RefundReceptionist { id: string; fullName: string }
/** Giao dịch sau khi gửi yêu cầu hoàn tiền, kèm lễ tân phụ trách (null khi cơ sở chưa có lễ tân) */
export type RefundRequestResult = PaymentRecord & { refundReceptionist?: RefundReceptionist | null };
export interface Invoice {
  id: string; invoiceNumber: string; issuedAt: string; status: string; total: string; subtotal: string; discount: string;
  memberName?: string; planName?: string; planTier?: string; paymentId?: string; payment?: PaymentRecord;
}
export const getMyWaitlist = (signal?: AbortSignal) => allPages<WaitlistEntry>('/waitlist/my', {}, signal);
export const joinWaitlist = (scheduleId: string) => api.post<WaitlistEntry>('/waitlist', { scheduleId });
export const leaveWaitlist = (id: string) => api.delete(`/waitlist/${encodeURIComponent(id)}`);
export const getMyVisits = (signal?: AbortSignal) => allPages<FacilityVisit>('/facility-visits/my', {}, signal);
export const checkInFacility = () => api.post<FacilityVisit>('/facility-visits/check-in', { method: 'QR' });
/** Lượt vào cửa mới nhất của hội viên (mọi cơ sở, mới nhất trước) — trang 1 cỡ 1; null khi chưa có lượt nào */
export const getLatestVisit = async () => (await api.get<FacilityVisit[]>('/facility-visits/my', { page: '1', limit: '1' })).data[0] ?? null;
export const getMyIssues = (signal?: AbortSignal) => allPages<SupportIssue>('/issues', {}, signal);
export const createIssue = (body: { title: string; description: string }) => api.post<SupportIssue>('/issues', body);
export const deleteIssue = (id: string) => api.delete(`/issues/${encodeURIComponent(id)}`);
export const getMemberInvoices = (memberId: string, signal?: AbortSignal) => allPages<Invoice>(`/invoices/member/${encodeURIComponent(memberId)}`, {}, signal);
export const getInvoice = (id: string) => api.get<Invoice>(`/invoices/${encodeURIComponent(id)}`);
export const getPayment = (id: string) => api.get<PaymentRecord>(`/payments/${encodeURIComponent(id)}`);
/**
 * POST /payments/:id/refund/request — hội viên xin hoàn tiền một giao dịch đã thanh toán (web: MemberRefundDialog).
 * BE hủy gói gắn với giao dịch, thu hồi các buổi đã đặt và báo lễ tân phụ trách của cơ sở.
 */
export const requestPaymentRefund = (paymentId: string, reason: string) =>
  api.post<RefundRequestResult>(`/payments/${encodeURIComponent(paymentId)}/refund/request`, { reason });
