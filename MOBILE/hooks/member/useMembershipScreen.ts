// hooks/member/useMembershipScreen.ts
// Logic màn "Gói thành viên" (Member) — tương ứng FE/src/pages/member/MembershipPage.tsx

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useMembershipData, useCancelSubscription, estimateSelfCancelRefund, findRegisteredSubscription,
} from './useMembership';
import { usePendingPayment, useStartCheckout, type PaymentScope } from './usePayment';
import { canSelfCancelSubscription } from '../../lib/businessRules';
import { detectPlanSwitchType, planSwitchHint } from '../../lib/planSwitch';
import type { MembershipPlan, SepayCheckout } from '../../lib/types';

export function useMembershipScreen(memberId: string | undefined, scope: PaymentScope) {
  const membership = useMembershipData(memberId);
  const { activeSub, subscriptions, refetchPlans, refetchSubs, onRefresh: refreshMembership } = membership;

  const { pendingPayment, refetchPending } = usePendingPayment(scope);
  const checkoutMutation = useStartCheckout(scope);
  const cancelMutation = useCancelSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  /** Gói đang xem trong bảng xác nhận đổi gói (gia hạn / nâng cấp / hạ cấp) */
  const [switchPlan, setSwitchPlan] = useState<MembershipPlan | null>(null);
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

  // ─── Thanh toán ─────────────────────────────────────────────────────────────
  /** Tạo đơn VietQR; `startDate` chỉ có khi hội viên hẹn ngày kích hoạt */
  const startCheckout = (
    plan: MembershipPlan,
    startDate: string | undefined,
    onCreated: (checkout: SepayCheckout) => void,
    onError: (e: unknown) => void,
  ) => {
    checkoutMutation.reset();
    checkoutMutation.mutate({ planId: plan.id, startDate }, { onSuccess: onCreated, onError });
  };

  /** Loại đổi gói khi mua plan này so với gói đang dùng (giống web) */
  const switchTypeFor = (plan: MembershipPlan) => detectPlanSwitchType(activeSub, plan);
  /** Dòng giải thích dưới nút mua (nối tiếp sau ngày…, gói ngắn hơn…) */
  const hintFor = (plan: MembershipPlan) => planSwitchHint(activeSub, plan);

  /** Gói hội viên đang dùng đúng plan này → nút "Gia hạn" (khớp planId như web) */
  const registeredFor = (planId: string) => findRegisteredSubscription(subscriptions, planId);

  /** Đang tạo đơn cho plan nào (để hiện "Đang tạo mã...") */
  const creatingPlanId = checkoutMutation.isPending ? checkoutMutation.variables?.planId : undefined;

  // ─── Hủy gói ────────────────────────────────────────────────────────────────
  const openCancel = () => {
    if (!canSelfCancelSubscription(activeSub)) return;
    cancelMutation.reset();
    setCancelReason('');
    setCancelOpen(true);
  };

  const closeCancel = () => {
    setCancelOpen(false);
    if (cancelMutation.isSuccess) refreshMembership();
  };

  const confirmCancel = () => {
    if (!activeSub || !canSelfCancelSubscription(activeSub)) return;
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
    switchTypeFor,
    hintFor,
    switchSheet: {
      plan: switchPlan,
      open: (plan: MembershipPlan) => setSwitchPlan(plan),
      close: () => setSwitchPlan(null),
    },
    cancel: {
      open: cancelOpen,
      reason: cancelReason,
      setReason: setCancelReason,
      estimate: activeSub && canSelfCancelSubscription(activeSub) ? estimateSelfCancelRefund(activeSub) : null,
      mutation: cancelMutation,
      openModal: openCancel,
      close: closeCancel,
      confirm: confirmCancel,
    },
  };
}
