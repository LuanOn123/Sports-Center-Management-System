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
}
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
