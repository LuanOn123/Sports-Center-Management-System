// hooks/shared/useFeedback.ts
// Business logic cho đánh giá HLV — dùng chung cho Member

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoachFeedbacks,
  getMyFeedbacks,
  createFeedback,
  deleteFeedback,
  type CreateFeedbackPayload,
} from '../../services/feedbackService';
import type { CoachFeedback, CoachFeedbackSummary } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';

export function useCoachFeedbacks(coachId: string | undefined, classId?: string, page = 1) {
  const query = useQuery({
    queryKey: ['coach-feedbacks', coachId, classId, page],
    queryFn: () => getCoachFeedbacks(coachId!, classId, page),
    enabled: Boolean(coachId),
  });

  const feedbacks: CoachFeedback[] = query.data?.data?.feedbacks ?? [];
  const summary: CoachFeedbackSummary = query.data?.data?.summary ?? { averageRating: null, totalFeedbacks: 0 };
  return { ...query, feedbacks, summary };
}

export function useMyFeedbacks() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['my-feedbacks', user?.id], queryFn: getMyFeedbacks, enabled: user?.role === 'MEMBER' });
  const feedbacks: CoachFeedback[] = query.data?.data ?? [];
  return { ...query, feedbacks };
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFeedbackPayload) => createFeedback(body),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['coach-feedbacks', vars.coachId] });
      queryClient.invalidateQueries({ queryKey: ['my-feedbacks'] });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feedbacks'] });
      queryClient.invalidateQueries({ queryKey: ['coach-feedbacks'] });
    },
  });
}
