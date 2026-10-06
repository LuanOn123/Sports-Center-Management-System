import { useQuery } from '@tanstack/react-query';
import { getClasses, getSports, getCoursePlan, ClassFilters } from '../../services/classService';
import type { CoursePlan } from '../../lib/types';

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

export function useCoursePlan(classId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['course-plan', classId],
    queryFn: () => getCoursePlan(classId!),
    select: (res) => res.data,
    enabled: Boolean(classId) && (options?.enabled ?? true),
  });
}


