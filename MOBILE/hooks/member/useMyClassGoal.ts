// hooks/member/useMyClassGoal.ts
// Mục tiêu + tiến độ + nhật ký đánh giá của hội viên cho một lớp (web: classGoalQuery ở ClassDetailPage).
// data = null khi hội viên chưa đăng ký lớp → thẻ tiến độ không hiện.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyClassGoal } from '../../services/goalService';

export function useMyClassGoal(classId: string, options?: { enabled?: boolean }) {
  const { currentFacility } = useAuth();
  return useQuery({
    // Tiền tố 'my-class-goal' dùng chung để làm mới sau khi đăng ký lớp hoặc khi HLV vừa đánh giá
    queryKey: ['my-class-goal', classId, currentFacility?.id],
    enabled: Boolean(classId) && (options?.enabled ?? true),
    queryFn: ({ signal }) => getMyClassGoal(classId, signal),
    select: (res) => res.data,
  });
}
