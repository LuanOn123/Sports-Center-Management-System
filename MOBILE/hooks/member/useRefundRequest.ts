// hooks/member/useRefundRequest.ts
// Yêu cầu hoàn tiền một giao dịch từ danh sách hóa đơn (web: MemberRefundDialog): chọn giao dịch → ghi lý do → gửi → biết lễ tân
// phụ trách. BE hủy gói gắn với giao dịch ngay khi nhận yêu cầu nên sau khi gửi, các dữ liệu liên quan được tải lại.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestPaymentRefund } from '../../services/workflowService';
import { REFUND_REFRESH_KEYS } from '../../constants/refund';
import { isRefundReasonValid } from '../../lib/refund';

/** Giao dịch đang xin hoàn: id và số tiền đã thanh toán */
export interface RefundTarget {
  paymentId: string;
  amount: string | number;
}

export function useRefundRequest() {
  const cache = useQueryClient();
  const [target, setTarget] = useState<RefundTarget | null>(null);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) => requestPaymentRefund(input.paymentId, input.reason),
    onSuccess: () => {
      for (const key of REFUND_REFRESH_KEYS) void cache.invalidateQueries({ queryKey: [key] });
    },
  });
  const valid = isRefundReasonValid(reason);

  return {
    target,
    reason,
    setReason,
    /** Mở bảng cho một giao dịch: lý do và kết quả của lần trước được xóa */
    open: (next: RefundTarget) => {
      mutation.reset();
      setReason('');
      setTarget(next);
    },
    /** Đóng bảng; bị chặn khi đang gửi để không mất thao tác giữa chừng */
    close: () => {
      if (!mutation.isPending) setTarget(null);
    },
    canSubmit: valid && !mutation.isPending,
    submit: () => {
      if (target && valid && !mutation.isPending) mutation.mutate({ paymentId: target.paymentId, reason: reason.trim() });
    },
    isPending: mutation.isPending,
    error: mutation.error,
    /** Có khi BE đã nhận yêu cầu: câu báo của BE + lễ tân phụ trách (null khi cơ sở chưa có lễ tân) */
    done: mutation.isSuccess ? { message: mutation.data.message, receptionist: mutation.data.data.refundReceptionist ?? null } : null,
  };
}

export type RefundRequestState = ReturnType<typeof useRefundRequest>;
