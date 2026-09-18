// hooks/member/useMembership.ts
// Business logic cho membership của hội viên — React Query + storage pending

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { getMembershipStatus, getMembershipPlans, getSubscriptions } from '../../services/membershipService';
import { storage } from '../../lib/storage';
import type { MembershipStatus, MembershipTier, Subscription, PendingMembershipRequest, MembershipPlan } from '../../lib/types';

// ─── Individual query hooks ───────────────────────────────────────────────────

export function useMembershipStatus(memberId: string | undefined) {
  return useQuery({
    queryKey: ['membership-status', memberId],
    queryFn: () => getMembershipStatus(memberId!),
    enabled: Boolean(memberId),
  });
}

export function useMembershipPlans() {
  return useQuery({
    queryKey: ['membership-plans-active'],
    queryFn: getMembershipPlans,
  });
}

export function useSubscriptions(memberId: string | undefined) {
  return useQuery({
    queryKey: ['subscriptions', memberId],
    queryFn: () => getSubscriptions(memberId!),
    enabled: Boolean(memberId),
  });
}

// ─── Combined hook — computes derived state ───────────────────────────────────

export interface MembershipDataResult {
  /** Gói đang active (null nếu chưa có) */
  activeSub: Subscription | null;
  /** Tier hiệu lực */
  effectiveTier: MembershipTier;
  /** Số ngày còn lại */
  daysRemaining: number | null;
  /** Computed MembershipStatus object */
  status: MembershipStatus;
  /** Danh sách tất cả subscriptions */
  subscriptions: Subscription[];
  /** Danh sách plans */
  plans: MembershipPlan[];
  /** Loading states */
  statusLoading: boolean;
  plansLoading: boolean;
  subsLoading: boolean;
  isRefreshing: boolean;
  /** Refetch functions */
  refetchStatus: () => void;
  refetchSubs: () => void;
  refetchPlans: () => void;
  onRefresh: () => Promise<void>;
}

export function useMembershipData(memberId: string | undefined): MembershipDataResult {
  const statusQuery = useMembershipStatus(memberId);
  const plansQuery = useMembershipPlans();
  const subsQuery = useSubscriptions(memberId);

  const subscriptions: Subscription[] = Array.isArray(subsQuery.data?.data)
    ? subsQuery.data!.data
    : [];

  const plans: MembershipPlan[] = plansQuery.data?.data ?? [];

  const activeSubFromList = subscriptions.find(
    (s) => s.status === 'ACTIVE' && new Date(s.endDate).getTime() >= Date.now()
  ) ?? null;

  const rawStatus = statusQuery.data?.data;
  const activeSub = rawStatus?.activeSubscription ?? activeSubFromList ?? null;

  const effectiveTier: MembershipTier =
    rawStatus?.effectiveTier && rawStatus.effectiveTier !== 'FREE'
      ? rawStatus.effectiveTier
      : activeSub?.tier ?? activeSub?.plan?.tier ?? 'FREE';

  const daysRemaining =
    rawStatus?.daysRemaining !== undefined && rawStatus?.daysRemaining !== null
      ? rawStatus.daysRemaining
      : activeSub
      ? Math.max(
          0,
          Math.ceil((new Date(activeSub.endDate).getTime() - Date.now()) / 86_400_000)
        )
      : null;

  const status: MembershipStatus = {
    effectiveTier,
    activeSubscription: activeSub,
    daysRemaining: daysRemaining ?? undefined,
  };

  const onRefresh = async () => {
    await Promise.all([
      statusQuery.refetch(),
      plansQuery.refetch(),
      subsQuery.refetch(),
    ]);
  };

  return {
    activeSub,
    effectiveTier,
    daysRemaining,
    status,
    subscriptions,
    plans,
    statusLoading: statusQuery.isLoading,
    plansLoading: plansQuery.isLoading,
    subsLoading: subsQuery.isLoading,
    isRefreshing: statusQuery.isLoading || plansQuery.isLoading || subsQuery.isLoading,
    refetchStatus: statusQuery.refetch,
    refetchSubs: subsQuery.refetch,
    refetchPlans: plansQuery.refetch,
    onRefresh,
  };
}

// ─── Pending request hook ─────────────────────────────────────────────────────

export interface PendingRequestResult {
  pendingRequest: PendingMembershipRequest | null;
  setPendingRequest: (req: PendingMembershipRequest | null) => void;
  loadPending: () => Promise<void>;
  clearPending: () => Promise<void>;
}

export function usePendingRequest(
  userId: string | undefined,
  activeSub: Subscription | null
): PendingRequestResult {
  const [pendingRequest, setPendingRequest] = useState<PendingMembershipRequest | null>(null);

  const loadPending = useCallback(async () => {
    if (!userId) return;
    if (activeSub) {
      // Staff đã kích hoạt → xóa pending
      await storage.clearPendingPlan(userId);
      setPendingRequest(null);
    } else {
      const stored = await storage.getPendingPlan(userId);
      setPendingRequest(stored);
    }
  }, [userId, activeSub]);

  const clearPending = useCallback(async () => {
    if (!userId) return;
    await storage.clearPendingPlan(userId);
    setPendingRequest(null);
  }, [userId]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useFocusEffect(
    useCallback(() => {
      loadPending();
    }, [loadPending])
  );

  return { pendingRequest, setPendingRequest, loadPending, clearPending };
}
