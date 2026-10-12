// hooks/member/useMemberHome.ts
// Logic cho Trang chủ Hội viên (Member)

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMembershipData } from './useMembership';
import { usePendingPayment, type PaymentScope } from './usePayment';
import { useUpcomingEnrollments } from './useEnrollments';
import { Haptic } from '../../lib/haptics';

export function useMemberHome(memberId: string | undefined, scope: PaymentScope) {
  const {
    activeSub,
    status,
    statusLoading,
    refetchSubs,
    onRefresh: refreshMembership,
  } = useMembershipData(memberId);

  const { pendingPayment, refetchPending } = usePendingPayment(scope);

  const {
    upcoming,
    isLoading: enrollLoading,
    refetch: refetchEnroll,
  } = useUpcomingEnrollments();

  useFocusEffect(
    useCallback(() => {
      refetchSubs();
      refetchEnroll();
    }, [refetchSubs, refetchEnroll])
  );

  const onRefresh = async () => {
    Haptic.light();
    await Promise.all([refreshMembership(), refetchEnroll(), refetchPending()]);
  };

  return {
    activeSub,
    status,
    statusLoading,
    pendingPayment,
    upcoming,
    enrollLoading,
    onRefresh,
  };
}
