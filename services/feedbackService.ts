// services/feedbackService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { CoachFeedback, CoachFeedbackSummary } from '../lib/types';

export interface CreateFeedbackPayload {
  coachId: string;
  classId?: string;
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
}

/** GET /feedbacks?coachId=... — data trả về { feedbacks, summary } */
export const getCoachFeedbacks = (coachId: string, classId?: string) =>
  api.get<{ feedbacks: CoachFeedback[]; summary: CoachFeedbackSummary }>('/feedbacks', {
    coachId,
    classId,
    limit: '20',
  });

/** GET /feedbacks/my */
export const getMyFeedbacks = () => api.get<CoachFeedback[]>('/feedbacks/my');

/** POST /feedbacks — upsert: gửi lại cùng (coachId, classId) sẽ sửa đánh giá cũ */
export const createFeedback = (body: CreateFeedbackPayload) =>
  api.post<CoachFeedback>('/feedbacks', body);

/** DELETE /feedbacks/:id */
export const deleteFeedback = (id: string) => api.delete(`/feedbacks/${id}`);
