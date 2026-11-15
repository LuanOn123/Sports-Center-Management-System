// components/member/PaymentsView.tsx
// Thanh toán & hóa đơn của hội viên (web: MemberPaymentsPage): danh sách hóa đơn → xem / lưu hóa đơn, chi tiết thanh toán.

import React from 'react';
import { useRouter } from 'expo-router';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { useMemberInvoices } from '../../hooks/member/useInvoices';
import { MEMBER_PROFILE_MISSING, PAYMENTS_TEXT } from '../../constants/workflow';
import { formatDate, formatVnd } from '../../lib/format';
import { workflowStatus } from '../../lib/workflow';
import { ROUTES } from '../../navigation/routes';

export function PaymentsView() {
  const router = useRouter();
  const { memberId, list } = useMemberInvoices();
  const empty = !memberId ? MEMBER_PROFILE_MISSING : list.isSuccess && !list.data.data.length ? PAYMENTS_TEXT.empty : undefined;

  return (
    <WorkflowScreen title={PAYMENTS_TEXT.title} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
      <WorkflowText>{PAYMENTS_TEXT.intro}</WorkflowText>
      <WorkflowState pending={Boolean(memberId) && list.isPending} error={list.error} retry={() => { void list.refetch(); }} empty={empty} />
      {list.data?.data.map((invoice) => (
        <WorkflowCard key={invoice.id} title={invoice.invoiceNumber}>
          <WorkflowText>{formatDate(invoice.issuedAt)} · {workflowStatus(invoice.status)}</WorkflowText>
          <WorkflowText>{formatVnd(invoice.total)}</WorkflowText>
          <WorkflowButton title={PAYMENTS_TEXT.viewInvoice} secondary onPress={() => router.push(ROUTES.invoice(invoice.id))} />
          {invoice.paymentId && (
            <WorkflowButton title={PAYMENTS_TEXT.paymentDetail} secondary onPress={() => router.push(ROUTES.paymentDetail(invoice.paymentId!))} />
          )}
        </WorkflowCard>
      ))}
    </WorkflowScreen>
  );
}
