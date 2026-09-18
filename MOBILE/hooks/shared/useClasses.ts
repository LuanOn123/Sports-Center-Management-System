// hooks/shared/useClasses.ts
// Business logic cho classes & sports — Dùng chung cho Member & Coach

import { useQuery } from '@tanstack/react-query';
import { getClasses, getClassById, getSports, ClassFilters } from '../../services/classService';

export function useSports() {
  return useQuery({
    queryKey: ['sports-list'],
    queryFn: getSports,
  });
}

export function useClasses(filters?: ClassFilters) {
  return useQuery({
    queryKey: ['classes', filters?.search, filters?.sportId, filters?.classType],
    queryFn: () => getClasses({ ...filters, isActive: 'true', limit: '20' }),
    placeholderData: (prev) => prev,
  });
}

export function useClassById(id: string | undefined) {
  return useQuery({
    queryKey: ['class', id],
    queryFn: () => getClassById(id!),
    enabled: Boolean(id),
  });
}
