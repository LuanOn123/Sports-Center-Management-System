// hooks/shared/useTerms.ts
// Kỳ học cho hội viên: kỳ hiện tại (banner) và danh sách kỳ của cơ sở đang chọn (bộ lọc Khám phá)

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { TERM_STALE_MS } from '../../constants/terms';
import { termsForFacility } from '../../lib/termRegistration';
import { getCurrentTerm, getTerms } from '../../services/termService';
import type { Term } from '../../lib/types';

/** Kỳ học hiện tại; chưa có kỳ nào (hoặc BE từ chối) thì không có dữ liệu và banner tự ẩn như web */
export function useCurrentTerm(options?: { enabled?: boolean }) {
  const { currentFacility } = useAuth();
  return useQuery({
    queryKey: ['terms', 'current', currentFacility?.id],
    queryFn: getCurrentTerm,
    select: (res) => res.data,
    staleTime: TERM_STALE_MS,
    retry: false,
    enabled: options?.enabled ?? true,
  });
}

/** Kỳ học thuộc cơ sở đang chọn (kỳ không gắn cơ sở nào dùng chung mọi cơ sở) — lớp ở cơ sở khác không thể nằm trong kỳ này */
export function useFacilityTerms(options?: { enabled?: boolean }) {
  const { currentFacility } = useAuth();
  const facilityId = currentFacility?.id;
  const query = useQuery({
    queryKey: ['terms', 'list', facilityId],
    queryFn: getTerms,
    select: (res) => res.data,
    staleTime: TERM_STALE_MS,
    enabled: options?.enabled ?? true,
  });
  const terms = useMemo<Term[]>(() => termsForFacility(query.data ?? [], facilityId), [query.data, facilityId]);
  return { ...query, terms };
}
