// components/member/PaymentDetailView.tsx
// Chi tiết một khoản thanh toán của hội viên (web: Modal "Chi tiết thanh toán"), kèm dòng báo khi đã gửi yêu cầu hoàn tiền.
// Logic ở hooks/member/useInvoices.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowState } from '../shared/WorkflowScreen';
import { InfoBanner } from '../shared/InfoBanner';
import { usePaymentRecord } from '../../hooks/member/useInvoices';
import { PAYMENT_DETAIL_TEXT as TEXT, PAYMENT_METHOD_CASH } from '../../constants/workflow';
import { REFUND_TEXT } from '../../constants/refund';
import { formatDate, formatVnd } from '../../lib/format';
import { workflowStatus } from '../../lib/workflow';

export function PaymentDetailView({ id }: { id: string | undefined }) {
  const { detail, payment } = usePaymentRecord(id);

  return (
    <WorkflowScreen title={TEXT.title}>
      <WorkflowState pending={detail.isPending} error={detail.error} retry={() => { void detail.refetch(); }} />
      {payment && (
        <WorkflowCard title={formatVnd(payment.amount)}>
          <WorkflowText>{workflowStatus(payment.status)}</WorkflowText>
          <WorkflowText>{payment.method === PAYMENT_METHOD_CASH ? TEXT.cash : TEXT.transfer}</WorkflowText>
          <WorkflowText>{TEXT.transactionCode(payment.transactionCode || TEXT.emptyValue)}</WorkflowText>
          <WorkflowText>{TEXT.createdAt(formatDate(payment.createdAt))}</WorkflowText>
          {payment.paidAt && <WorkflowText>{TEXT.paidAt(formatDate(payment.paidAt))}</WorkflowText>}
        </WorkflowCard>
      )}
      {payment?.refundRequestedAt && (
        <InfoBanner tone="warning" title={REFUND_TEXT.requested(formatVnd(payment.refundRequestedAmount ?? payment.amount))} />
      )}
    </WorkflowScreen>
  );
}
