// hooks/shared/useCoachProfile.ts
// Hồ sơ HLV xem từ chi tiết lớp (web: CoachProfileDialog) — chỉ tải khi mở hồ sơ.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoachProfile } from '../../services/coachService';
import { coachProfileView } from '../../lib/coachProfile';
import type { ClassCoach } from '../../lib/types';

export function useCoachProfile(assigned: ClassCoach | null) {
  const userId = assigned?.coach?.user?.id;
  const query = useQuery({
    queryKey: ['coach-profile', userId],
    queryFn: () => getCoachProfile(userId!),
    select: (res) => res.data,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
  // Hiện ngay dữ liệu đã có trong lớp, dữ liệu đầy đủ (ảnh, giới thiệu mới nhất) thay vào khi tải xong
  const view = useMemo(() => (assigned ? coachProfileView(assigned, query.data) : null), [assigned, query.data]);
  return { view, loading: query.isFetching, error: query.error, refetch: query.refetch };
}
