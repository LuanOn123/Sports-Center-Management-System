// hooks/member/useMemberHome.ts
// Logic cho Trang chủ Hội viên (Member)

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMembershipData } from './useMembership';
import { usePendingPayment, type PaymentScope } from './usePayment';
import { useMyQuota, useUpcomingEnrollments } from './useEnrollments';
import { Haptic } from '../../lib/haptics';

export function useMemberHome(memberId: string | undefined, scope: PaymentScope) {
  const {
    activeSub,
    scheduledSub,
    status,
    statusLoading,
    refetchSubs,
    onRefresh: refreshMembership,
  } = useMembershipData(memberId);

  const { pendingPayment, refetchPending } = usePendingPayment(scope);
  // Số lớp đang giữ chỗ / giới hạn theo gói (3 hoặc 6) — GET /enrollments/my/quota
  const quota = useMyQuota();

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
    await Promise.all([refreshMembership(), refetchEnroll(), refetchPending(), quota.refetch()]);
  };

  return {
    activeSub,
    scheduledSub,
    quota: quota.data,
    status,
    statusLoading,
    pendingPayment,
    upcoming,
    enrollLoading,
    onRefresh,
  };
}
