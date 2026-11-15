// hooks/coach/useCoachFeedbackScreen.ts
// Màn "Đánh giá của hội viên" dành cho huấn luyện viên: điểm trung bình + các đánh giá, phân trang (web: CoachFeedback, vai trò COACH)

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCoachFeedbacks } from '../shared/useFeedback';

export function useCoachFeedbackScreen() {
  const { user } = useAuth();
  const coachId = user?.coachProfile?.id;
  const [page, setPage] = useState(1);
  const list = useCoachFeedbacks(coachId, undefined, page);
  const totalPages = list.data?.pagination?.totalPages || 1;

  return {
    coachId,
    list,
    page,
    totalPages,
    canGoBack: page > 1 && !list.isFetching,
    canGoForward: Boolean(list.data) && page < totalPages && !list.isFetching,
    previous: () => setPage((n) => n - 1),
    next: () => setPage((n) => n + 1),
  };
}
