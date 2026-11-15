// components/member/InvoiceView.tsx
// Một hóa đơn thanh toán (web: InvoiceDialog): thông tin hóa đơn + in / lưu PDF. Logic ở hooks/member/useInvoices.

import React from 'react';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';
import { useInvoice } from '../../hooks/member/useInvoices';
import { INVOICE_TEXT } from '../../constants/workflow';
import { formatDate, formatVnd } from '../../lib/format';
import { workflowStatus } from '../../lib/workflow';

export function InvoiceView({ id }: { id: string | undefined }) {
  const { detail, invoice, exporting, exportError, print } = useInvoice(id);

  return (
    <WorkflowScreen title={INVOICE_TEXT.title}>
      <WorkflowState pending={detail.isPending} error={detail.error || exportError} retry={() => { void detail.refetch(); }} />
      {invoice && (
        <WorkflowCard title={invoice.invoiceNumber}>
          <WorkflowText>{INVOICE_TEXT.brand}</WorkflowText>
          <WorkflowText>{INVOICE_TEXT.member(invoice.memberName || INVOICE_TEXT.memberFallback)}</WorkflowText>
          <WorkflowText>{INVOICE_TEXT.plan(invoice.planName || INVOICE_TEXT.emptyValue)}</WorkflowText>
          <WorkflowText>{INVOICE_TEXT.issuedAt(formatDate(invoice.issuedAt))}</WorkflowText>
          <WorkflowText>{workflowStatus(invoice.status)}</WorkflowText>
          <WorkflowText>{INVOICE_TEXT.amounts(formatVnd(invoice.subtotal), formatVnd(invoice.discount))}</WorkflowText>
          <WorkflowText>{INVOICE_TEXT.total(formatVnd(invoice.total))}</WorkflowText>
          <WorkflowButton title={INVOICE_TEXT.print} busy={exporting} onPress={print} />
        </WorkflowCard>
      )}
    </WorkflowScreen>
  );
}
