// hooks/member/useMembership.ts
// Business logic cho membership của hội viên — React Query.
// Gói hiệu lực tính từ danh sách subscription như FE web (effectiveSubscription);
// API /members/:id/membership-status chỉ dành cho staff nên không dùng ở mobile.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMembershipPlans, getSubscriptions, cancelSubscription } from '../../services/membershipService';
import { effectiveSubscription, isEffectiveSubscription, selfCancelRefundEstimate } from '../../lib/businessRules';
import { daysUntil } from '../../lib/date';
import type { MembershipStatus, MembershipTier, Subscription, MembershipPlan } from '../../lib/types';

// ─── Query hooks ──────────────────────────────────────────────────────────────

function useMembershipPlans() {
  return useQuery({
    queryKey: ['membership-plans-active'],
    queryFn: getMembershipPlans,
  });
}

function useSubscriptions(memberId: string | undefined) {
  return useQuery({
    queryKey: ['subscriptions', memberId],
    queryFn: () => getSubscriptions(memberId!),
    enabled: Boolean(memberId),
  });
}

// ─── Combined hook — computes derived state ───────────────────────────────────

export function useMembershipData(memberId: string | undefined) {
  const plansQuery = useMembershipPlans();
  const subsQuery = useSubscriptions(memberId);

  const subscriptions: Subscription[] = Array.isArray(subsQuery.data?.data) ? subsQuery.data!.data : [];
  const plans: MembershipPlan[] = plansQuery.data?.data ?? [];

  const activeSub = effectiveSubscription(subscriptions) ?? null;
  const effectiveTier: MembershipTier = activeSub?.tier ?? activeSub?.plan?.tier ?? 'FREE';
  const daysRemaining = activeSub ? daysUntil(activeSub.endDate) : null;

  const status: MembershipStatus = {
    effectiveTier,
    activeSubscription: activeSub,
    daysRemaining: daysRemaining ?? undefined,
  };

  return {
    /** Gói đang hiệu lực (null nếu chưa có) */
    activeSub,
    effectiveTier,
    daysRemaining,
    status,
    subscriptions,
    plans,
    /** Đang tải trạng thái gói (danh sách subscription) */
    statusLoading: subsQuery.isLoading,
    plansLoading: plansQuery.isLoading,
    refetchSubs: subsQuery.refetch,
    refetchPlans: plansQuery.refetch,
    onRefresh: async () => {
      await Promise.all([plansQuery.refetch(), subsQuery.refetch()]);
    },
  };
}

// ─── Cancel subscription ──────────────────────────────────────────────────────

/** Ước tính hoàn tiền phía client trước khi gọi API — BE là nguồn chính thức */
export function estimateSelfCancelRefund(sub: Subscription) {
  return selfCancelRefundEstimate(sub.endDate, Number(sub.plan?.price ?? 0));
}

/** Gói hiệu lực của hội viên đúng bằng plan này (khớp theo planId như FE web) — dùng để hiện "Gia hạn" */
export function findRegisteredSubscription(subscriptions: Subscription[], planId: string) {
  return subscriptions.find((s) => s.planId === planId && isEffectiveSubscription(s));
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelSubscription(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}
