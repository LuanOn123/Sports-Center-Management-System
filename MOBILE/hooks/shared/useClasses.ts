import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getClasses, getCoursePlan, getSports, type ClassFilters } from '../../services/classService';

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

/** Kế hoạch khóa học của lớp — dùng chung cho thẻ lớp (Khám phá) và màn chi tiết (cùng cache) */
export function useCoursePlan(classId: string | undefined, options?: { enabled?: boolean }) {
  const { currentFacility } = useAuth();
  return useQuery({
    queryKey: ['course-plan', classId, currentFacility?.id],
    queryFn: ({ signal }) => getCoursePlan(classId!, signal),
    enabled: Boolean(classId) && (options?.enabled ?? true),
  });
}
