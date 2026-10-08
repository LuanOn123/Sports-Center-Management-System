// hooks/member/useMembershipScreen.ts
// Logic màn "Gói thành viên" (Member) — tương ứng FE/src/pages/member/MembershipPage.tsx

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useMembershipData, useCancelSubscription, estimateSelfCancelRefund, findRegisteredSubscription,
} from './useMembership';
import { usePendingPayment, useStartCheckout, type PaymentScope } from './usePayment';
import type { MembershipPlan, SepayCheckout } from '../../lib/types';

export function useMembershipScreen(memberId: string | undefined, scope: PaymentScope) {
  const membership = useMembershipData(memberId);
  const { activeSub, subscriptions, refetchPlans, refetchSubs, onRefresh: refreshMembership } = membership;

  const { pendingPayment, refetchPending } = usePendingPayment(scope);
  const checkoutMutation = useStartCheckout(scope);
  const cancelMutation = useCancelSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      refetchPlans();
      refetchSubs();
    }, [refetchPlans, refetchSubs])
  );

  const onRefresh = async () => {
    await Promise.all([refreshMembership(), refetchPending()]);
  };

  // ─── Thanh toán (web: startCheckout — bấm là tạo đơn ngay, không hỏi xác nhận) ─
  const startCheckout = (
    plan: MembershipPlan,
    onCreated: (checkout: SepayCheckout) => void,
    onError: (e: unknown) => void,
  ) => {
    checkoutMutation.reset();
    checkoutMutation.mutate(plan.id, { onSuccess: onCreated, onError });
  };

  /** Gói hội viên đang dùng đúng plan này → nút "Gia hạn" (khớp planId như web) */
  const registeredFor = (planId: string) => findRegisteredSubscription(subscriptions, planId);

  /** Đang tạo đơn cho plan nào (để hiện "Đang tạo mã...") */
  const creatingPlanId = checkoutMutation.isPending ? checkoutMutation.variables : undefined;

  // ─── Hủy gói ────────────────────────────────────────────────────────────────
  const openCancel = () => {
    if (!activeSub) return;
    cancelMutation.reset();
    setCancelReason('');
    setCancelOpen(true);
  };

  const closeCancel = () => {
    setCancelOpen(false);
    if (cancelMutation.isSuccess) refreshMembership();
  };

  const confirmCancel = () => {
    if (!activeSub) return;
    cancelMutation.mutate({ id: activeSub.id, reason: cancelReason.trim() || undefined });
  };

  return {
    ...membership,
    onRefresh,
    pendingPayment,
    startCheckout,
    creatingPlanId,
    isCreatingCheckout: checkoutMutation.isPending,
    registeredFor,
    cancel: {
      open: cancelOpen,
      reason: cancelReason,
      setReason: setCancelReason,
      estimate: activeSub ? estimateSelfCancelRefund(activeSub) : null,
      mutation: cancelMutation,
      openModal: openCancel,
      close: closeCancel,
      confirm: confirmCancel,
    },
  };
}
