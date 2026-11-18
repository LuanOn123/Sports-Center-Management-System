// components/member/PaymentsView.tsx
// Thanh toán & hóa đơn của hội viên (web: MemberPaymentsPage): danh sách hóa đơn → xem / lưu hóa đơn, chi tiết thanh toán,
// yêu cầu hoàn tiền một giao dịch đã thanh toán (bảng ở components/member/payment/RefundRequestSheet).

import React from 'react';
import { useRouter } from 'expo-router';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { Button } from '../ui/Button';
import { RefundRequestSheet } from './payment/RefundRequestSheet';
import { useMemberInvoices } from '../../hooks/member/useInvoices';
import { useRefundRequest } from '../../hooks/member/useRefundRequest';
import { MEMBER_PROFILE_MISSING, PAYMENTS_TEXT } from '../../constants/workflow';
import { REFUND_TEXT } from '../../constants/refund';
import { formatDate, formatVnd } from '../../lib/format';
import { canRequestRefund, hasRefundRequest, refundChatDraft } from '../../lib/refund';
import { workflowStatus } from '../../lib/workflow';
import { ROUTES } from '../../navigation/routes';
import type { RefundReceptionist } from '../../services/workflowService';

export function PaymentsView() {
  const router = useRouter();
  const { memberId, list } = useMemberInvoices();
  const refund = useRefundRequest();
  const empty = !memberId ? MEMBER_PROFILE_MISSING : list.isSuccess && !list.data.data.length ? PAYMENTS_TEXT.empty : undefined;

  // Sau khi gửi yêu cầu: nhắn lễ tân phụ trách với câu chào soạn sẵn (web: refundChatPath)
  const chatWithReceptionist = (receptionist: RefundReceptionist) => {
    const paymentId = refund.target?.paymentId ?? '';
    refund.close();
    router.push(ROUTES.chatThread(receptionist.id, receptionist.fullName, refundChatDraft(receptionist.fullName, paymentId)));
  };

  return (
    <WorkflowScreen title={PAYMENTS_TEXT.title} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); }}>
      <WorkflowText>{PAYMENTS_TEXT.intro}</WorkflowText>
      <WorkflowState pending={Boolean(memberId) && list.isPending} error={list.error} retry={() => { void list.refetch(); }} empty={empty} />
      {list.data?.data.map((invoice) => (
        <WorkflowCard key={invoice.id} title={invoice.invoiceNumber}>
          <WorkflowText>{formatDate(invoice.issuedAt)} · {workflowStatus(invoice.status)}</WorkflowText>
          <WorkflowText>{formatVnd(invoice.total)}</WorkflowText>
          {hasRefundRequest(invoice) && <WorkflowText>{REFUND_TEXT.requestedShort}</WorkflowText>}
          <WorkflowButton title={PAYMENTS_TEXT.viewInvoice} secondary onPress={() => router.push(ROUTES.invoice(invoice.id))} />
          {invoice.paymentId && (
            <WorkflowButton title={PAYMENTS_TEXT.paymentDetail} secondary onPress={() => router.push(ROUTES.paymentDetail(invoice.paymentId!))} />
          )}
          {canRequestRefund(invoice) && (
            <Button
              variant="danger"
              icon="currency-exchange"
              title={REFUND_TEXT.action}
              className="mt-xs"
              onPress={() => refund.open({ paymentId: invoice.paymentId!, amount: invoice.payment?.amount ?? invoice.total })}
            />
          )}
        </WorkflowCard>
      ))}
      <RefundRequestSheet refund={refund} onChat={chatWithReceptionist} />
    </WorkflowScreen>
  );
}
