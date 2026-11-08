// hooks/member/useMembershipScreen.ts
// Logic màn "Gói thành viên" (Member) — tương ứng FE/src/pages/member/MembershipPage.tsx

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useMembershipData, useCancelSubscription, findRegisteredSubscription,
} from './useMembership';
import { usePendingPayment, useStartCheckout, type PaymentScope } from './usePayment';
import { canSelfCancelSubscription, cancelRefundEstimate } from '../../lib/businessRules';
import { detectPlanSwitchType, planSwitchHint } from '../../lib/planSwitch';
import type { MembershipPlan, SepayCheckout, Subscription } from '../../lib/types';

export function useMembershipScreen(memberId: string | undefined, scope: PaymentScope) {
  const membership = useMembershipData(memberId);
  const { activeSub, subscriptions, refetchPlans, refetchSubs, onRefresh: refreshMembership } = membership;

  const { pendingPayment, refetchPending } = usePendingPayment(scope);
  const checkoutMutation = useStartCheckout(scope);
  const cancelMutation = useCancelSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  /** Gói đang xem trong hộp thoại hủy — gói đang dùng hoặc gói chờ kích hoạt (web: CancelSubscription) */
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
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
  const openCancel = (sub: Subscription | null | undefined) => {
    if (!sub || !canSelfCancelSubscription(sub)) return;
    cancelMutation.reset();
    setCancelReason('');
    setCancelTarget(sub);
    setCancelOpen(true);
  };

  const closeCancel = () => {
    setCancelOpen(false);
    if (cancelMutation.isSuccess) refreshMembership();
  };

  const confirmCancel = () => {
    if (!cancelTarget || !canSelfCancelSubscription(cancelTarget)) return;
    cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason.trim() || undefined });
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
    /** Có gói chờ kích hoạt → BE chặn mua/gia hạn tiếp (409 SCHEDULED_SUBSCRIPTION_EXISTS): khóa nút mua như web */
    purchaseBlocked: Boolean(membership.scheduledSub),
    switchSheet: {
      plan: switchPlan,
      open: (plan: MembershipPlan) => setSwitchPlan(plan),
      close: () => setSwitchPlan(null),
    },
    cancel: {
      open: cancelOpen,
      target: cancelTarget,
      reason: cancelReason,
      setReason: setCancelReason,
      estimate: cancelTarget && canSelfCancelSubscription(cancelTarget) ? cancelRefundEstimate(cancelTarget) : null,
      mutation: cancelMutation,
      openModal: openCancel,
      close: closeCancel,
      confirm: confirmCancel,
    },
  };
}
