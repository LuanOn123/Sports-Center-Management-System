// hooks/member/useInvoices.ts
// Hóa đơn và khoản thanh toán của hội viên (web: MemberPaymentsPage + InvoiceDialog)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getInvoice, getMemberInvoices, getPayment } from '../../services/workflowService';
import { exportInvoice } from '../../lib/invoice';
import { memberProfileIdOf } from '../../lib/businessRules';

/** Danh sách hóa đơn của chính hội viên (cần hồ sơ hội viên) */
export function useMemberInvoices() {
  const { user } = useAuth();
  const memberId = memberProfileIdOf(user);
  const list = useQuery({
    queryKey: ['member-invoices', memberId],
    enabled: Boolean(memberId),
    queryFn: ({ signal }) => getMemberInvoices(memberId!, signal),
  });
  return { memberId, list };
}

/** Một hóa đơn + xuất PDF / in */
export function useInvoice(id: string | undefined) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>();
  const detail = useQuery({ queryKey: ['invoice', id], enabled: Boolean(id), queryFn: () => getInvoice(id!) });
  const invoice = detail.data?.data;

  const print = () => {
    if (!invoice) return;
    setExporting(true);
    setExportError(undefined);
    void exportInvoice(invoice).catch(setExportError).finally(() => setExporting(false));
  };

  return { detail, invoice, exporting, exportError, print };
}

/** Chi tiết một khoản thanh toán */
export function usePaymentRecord(id: string | undefined) {
  const detail = useQuery({ queryKey: ['payment-record', id], enabled: Boolean(id), queryFn: () => getPayment(id!) });
  return { detail, payment: detail.data?.data };
}
