// hooks/member/useMemberHome.ts
// Logic cho Trang chủ Hội viên (Member)

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMembershipData, usePendingRequest } from './useMembership';
import { useUpcomingEnrollments } from './useEnrollments';

export function useMemberHome(userId: string | undefined, memberId: string | undefined) {
  const {
    activeSub,
    status,
    statusLoading,
    refetchStatus,
    refetchSubs,
    onRefresh: refreshMembership,
  } = useMembershipData(memberId);

  const { pendingRequest, loadPending } = usePendingRequest(userId, activeSub);

  const {
    upcoming,
    isLoading: enrollLoading,
    refetch: refetchEnroll,
  } = useUpcomingEnrollments();

  useFocusEffect(
    useCallback(() => {
      refetchStatus();
      refetchSubs();
      refetchEnroll();
      loadPending();
    }, [refetchStatus, refetchSubs, refetchEnroll, loadPending])
  );

  const onRefresh = async () => {
    await Promise.all([refreshMembership(), refetchEnroll()]);
    await loadPending();
  };

  return {
    activeSub,
    status,
    statusLoading,
    pendingRequest,
    upcoming,
    enrollLoading,
    onRefresh,
  };
}
