// hooks/member/useWaitlistScreen.ts
// Màn "Danh sách chờ" của hội viên: các lượt chờ của mình, rời danh sách, và làm mới dữ liệu khi được xếp chỗ (web: Waitlist)

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getMyWaitlist, leaveWaitlist } from '../../services/workflowService';
import { memberProfileIdOf } from '../../lib/businessRules';
import { showConfirm } from '../../lib/alert';
import { WAITLIST_PROMOTED_REFRESH_KEYS, WAITLIST_REFRESH_MS, WAITLIST_TEXT } from '../../constants/workflow';

export function useWaitlistScreen() {
  const { user, currentFacility } = useAuth();
  const cache = useQueryClient();
  const hasProfile = Boolean(memberProfileIdOf(user));

  const list = useQuery({
    queryKey: ['waitlist', currentFacility?.id],
    enabled: hasProfile,
    queryFn: ({ signal }) => getMyWaitlist(signal),
    refetchInterval: WAITLIST_REFRESH_MS,
  });
  const leave = useMutation({
    mutationFn: leaveWaitlist,
    onSettled: () => cache.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  // Có lượt vừa được xếp chỗ → đăng ký, quota, lịch và kế hoạch khóa đều đổi
  const promoted = list.data?.data.filter((entry) => entry.status === 'PROMOTED').map((entry) => entry.id).sort().join(',') || '';
  useEffect(() => {
    if (promoted) for (const key of WAITLIST_PROMOTED_REFRESH_KEYS) void cache.invalidateQueries({ queryKey: [key] });
  }, [promoted, cache]);

  /** Hỏi lại trước khi rời vì sẽ mất vị trí chờ */
  const requestLeave = (id: string) =>
    showConfirm(WAITLIST_TEXT.leave, WAITLIST_TEXT.leaveConfirmBody, () => leave.mutate(id), undefined, WAITLIST_TEXT.leaveConfirmAction);

  return { hasProfile, list, leave, requestLeave };
}
