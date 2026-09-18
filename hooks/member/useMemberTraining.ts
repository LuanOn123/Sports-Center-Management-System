// hooks/member/useMemberTraining.ts
// Logic cho màn hình Tập luyện của Hội viên (Kế hoạch & Lịch sử tập)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMemberTrainingPlans, getMemberEnrollments } from '../../services/memberService';
import type { Enrollment, TrainingPlan } from '../../lib/types';

export function useMemberTraining(memberId: string | undefined) {
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');

  const {
    data: plansData,
    isLoading: plansLoading,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ['training-plans', memberId],
    queryFn: () => getMemberTrainingPlans(memberId!),
    enabled: Boolean(memberId),
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['my-enrollments-completed'],
    queryFn: () => getMemberEnrollments('COMPLETED'),
    enabled: activeTab === 'history',
  });

  const plans: TrainingPlan[] = plansData?.data ?? [];
  const history: Enrollment[] = historyData?.data ?? [];

  const onRefresh = () => {
    if (activeTab === 'plans') refetchPlans();
    else refetchHistory();
  };

  const isLoading = activeTab === 'plans' ? plansLoading : historyLoading;

  return {
    activeTab,
    setActiveTab,
    plans,
    history,
    isLoading,
    onRefresh,
  };
}
