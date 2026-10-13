import React from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMemberInvoices } from '../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState, workflowStatus } from '../../components/shared/WorkflowScreen';
import { formatDate, formatVnd } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';
import { memberProfileIdOf } from '../../lib/businessRules';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const memberId = memberProfileIdOf(user);
  const list = useQuery({ queryKey: ['member-invoices', memberId], enabled: Boolean(memberId), queryFn: ({ signal }) => getMemberInvoices(memberId!, signal) });
  return <WorkflowScreen title="Thanh toán & hóa đơn" refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
    <WorkflowText>Các khoản thu của bạn được ghi nhận tại trung tâm. Liên hệ trung tâm nếu cần đối chiếu hoặc hoàn tiền.</WorkflowText>
    <WorkflowState pending={Boolean(memberId) && list.isPending} error={list.error} retry={() => { void list.refetch(); }} empty={!memberId ? 'Chưa có hồ sơ hội viên.' : list.isSuccess && !list.data.data.length ? 'Chưa có hóa đơn.' : undefined} />
    {list.data?.data.map((invoice) => <WorkflowCard key={invoice.id} title={invoice.invoiceNumber}>
      <WorkflowText>{formatDate(invoice.issuedAt)} · {workflowStatus(invoice.status)}</WorkflowText><WorkflowText>{formatVnd(invoice.total)}</WorkflowText>
      <WorkflowButton title="Xem / Lưu hóa đơn" secondary onPress={() => router.push(ROUTES.invoice(invoice.id))} />
      {invoice.paymentId && <WorkflowButton title="Chi tiết thanh toán" secondary onPress={() => router.push(ROUTES.paymentDetail(invoice.paymentId!))} />}
    </WorkflowCard>)}
  </WorkflowScreen>;
}
