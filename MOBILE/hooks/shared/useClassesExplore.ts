// hooks/shared/useClassesExplore.ts
// Logic màn Khám phá / Lớp dạy: tìm kiếm + lọc môn + lọc hạng lớp, tải danh sách lớp.
// HLV chỉ thấy lớp mình phụ trách (giống web).

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useClasses, useSports } from './useClasses';
import type { ClassType } from '../../lib/types';

export function useClassesExplore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isCoach = user?.role === 'COACH';
  const coachId = user?.coachProfile?.id;
  const [search, setSearch] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [classType, setClassType] = useState<ClassType | undefined>();

  const sports = useSports();
  const classes = useClasses(
    { search: search || undefined, sportId, classType, coachId: isCoach ? coachId : undefined },
    { enabled: !isCoach || Boolean(coachId) },
  );

  const hasFilters = Boolean(search || sportId || classType);
  const clearFilters = () => {
    setSearch('');
    setSportId(undefined);
    setClassType(undefined);
  };

  return {
    isCoach,
    search, setSearch,
    sportId, setSportId,
    classType, setClassType,
    hasFilters, clearFilters,
    sports: sports.data?.data ?? [],
    classes: classes.data?.data ?? [],
    isLoading: classes.isLoading,
    // Làm mới cả danh sách lớp lẫn lịch học / chỗ trống của từng thẻ
    refresh: () => Promise.all([classes.refetch(), queryClient.invalidateQueries({ queryKey: ['course-plan'] })]),
  };
}
