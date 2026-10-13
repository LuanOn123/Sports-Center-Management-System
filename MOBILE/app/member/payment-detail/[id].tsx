import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getPayment } from '../../../services/workflowService';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowState, workflowStatus } from '../../../components/shared/WorkflowScreen';
import { formatDate, formatVnd } from '../../../lib/format';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['payment-record', id], enabled: Boolean(id), queryFn: () => getPayment(id) });
  const payment = detail.data?.data;
  return <WorkflowScreen title="Chi tiết thanh toán"><WorkflowState pending={detail.isPending} error={detail.error} retry={() => { void detail.refetch(); }} />
    {payment && <WorkflowCard title={formatVnd(payment.amount)}><WorkflowText>{workflowStatus(payment.status)}</WorkflowText>
      <WorkflowText>{payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản ngân hàng'}</WorkflowText><WorkflowText>Mã giao dịch: {payment.transactionCode || '—'}</WorkflowText>
      <WorkflowText>Ngày tạo: {formatDate(payment.createdAt)}</WorkflowText>{payment.paidAt && <WorkflowText>Đã thanh toán: {formatDate(payment.paidAt)}</WorkflowText>}
    </WorkflowCard>}
  </WorkflowScreen>;
}
