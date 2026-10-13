import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getInvoice } from '../../services/workflowService';
import { exportInvoice } from '../../lib/invoice';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState, workflowStatus } from '../../components/shared/WorkflowScreen';
import { formatDate, formatVnd } from '../../lib/format';

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const detail = useQuery({ queryKey: ['invoice', id], enabled: Boolean(id), queryFn: () => getInvoice(id) });
  const invoice = detail.data?.data;
  return <WorkflowScreen title="Hóa đơn thanh toán">
    <WorkflowState pending={detail.isPending} error={detail.error || error} retry={() => { void detail.refetch(); }} />
    {invoice && <WorkflowCard title={invoice.invoiceNumber}>
      <WorkflowText>PULSE SPORTS CENTER</WorkflowText><WorkflowText>Hội viên: {invoice.memberName || 'Chưa lưu tên tại thời điểm phát hành'}</WorkflowText>
      <WorkflowText>Gói tập: {invoice.planName || '—'}</WorkflowText><WorkflowText>Ngày phát hành: {formatDate(invoice.issuedAt)}</WorkflowText>
      <WorkflowText>{workflowStatus(invoice.status)}</WorkflowText><WorkflowText>Tạm tính: {formatVnd(invoice.subtotal)} · Giảm giá: {formatVnd(invoice.discount)}</WorkflowText>
      <WorkflowText>Tổng thanh toán: {formatVnd(invoice.total)}</WorkflowText>
      <WorkflowButton title="In / Lưu PDF" busy={busy} onPress={() => { setBusy(true); setError(undefined); void exportInvoice(invoice).catch(setError).finally(() => setBusy(false)); }} />
    </WorkflowCard>}
  </WorkflowScreen>;
}
