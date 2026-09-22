// hooks/shared/useClasses.ts
// Business logic cho classes & sports — Dùng chung cho Member & Coach

import { useQuery } from '@tanstack/react-query';
import { getClasses, getSports, ClassFilters } from '../../services/classService';

export function useSports() {
  return useQuery({
    queryKey: ['sports-list'],
    queryFn: getSports,
  });
}

export function useClasses(filters?: ClassFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['classes', filters?.search, filters?.sportId, filters?.classType, filters?.coachId],
    queryFn: () => getClasses({ ...filters, isActive: 'true', limit: '20' }),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  });
}
