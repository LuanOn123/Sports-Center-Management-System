// hooks/member/useJoinWaitlist.ts
// Nút "Vào danh sách chờ" của một buổi hết chỗ (web: WaitlistAction): lượt chờ hiện có của buổi này + vào danh sách chờ.
// Dùng chung khóa ['waitlist'] với màn Danh sách chờ (useWaitlistScreen) nên hai nơi luôn khớp nhau.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyWaitlist, joinWaitlist } from '../../services/workflowService';

export function useJoinWaitlist(scheduleId: string) {
  const cache = useQueryClient();
  const { currentFacility } = useAuth();
  const list = useQuery({ queryKey: ['waitlist', currentFacility?.id], queryFn: ({ signal }) => getMyWaitlist(signal) });
  const existing = list.data?.data.find((entry) => entry.scheduleId === scheduleId && entry.status === 'WAITING');
  const join = useMutation({
    mutationFn: () => joinWaitlist(scheduleId),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['waitlist'] }),
  });
  return { list, existing, join };
}
