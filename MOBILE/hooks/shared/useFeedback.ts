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

export function useCoachFeedbacks(coachId: string | undefined, classId?: string) {
  const query = useQuery({
    queryKey: ['coach-feedbacks', coachId, classId],
    queryFn: () => getCoachFeedbacks(coachId!, classId),
    enabled: Boolean(coachId),
  });

  const feedbacks: CoachFeedback[] = query.data?.data?.feedbacks ?? [];
  const summary: CoachFeedbackSummary = query.data?.data?.summary ?? { averageRating: null, totalFeedbacks: 0 };
  return { ...query, feedbacks, summary };
}

export function useMyFeedbacks() {
  const query = useQuery({ queryKey: ['my-feedbacks'], queryFn: getMyFeedbacks });
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
