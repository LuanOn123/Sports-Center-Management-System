import { useQuery } from '@tanstack/react-query';
import { getClasses, getSports, type ClassFilters } from '../../services/classService';

export function useSports() {
  return useQuery({
    queryKey: ['sports-list'],
    queryFn: getSports,
  });
}

export function useClasses(filters?: ClassFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['classes', filters?.search, filters?.sportId, filters?.classType, filters?.coachId],
    queryFn: () => getClasses({ ...filters, isActive: filters?.coachId ? undefined : 'true' }),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  });
}
