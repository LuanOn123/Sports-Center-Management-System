// hooks/shared/useClassesExplore.ts
// Logic màn Khám phá / Lớp dạy: tìm kiếm + lọc môn + lọc hạng lớp (+ khu vực và kỳ học cho hội viên như web),
// tải danh sách lớp. HLV chỉ thấy lớp mình phụ trách (giống web).

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useClasses, useSports } from './useClasses';
import { useCurrentTerm, useFacilityTerms } from './useTerms';
import type { AreaType, ClassType } from '../../lib/types';

export function useClassesExplore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isCoach = user?.role === 'COACH';
  const coachId = user?.coachProfile?.id;
  const [search, setSearch] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [classType, setClassType] = useState<ClassType | undefined>();
  const [areaType, setAreaType] = useState<AreaType | undefined>();
  const [termId, setTermId] = useState<string | undefined>();

  const sports = useSports();
  // Kỳ học chỉ để hội viên chọn lớp theo kỳ đăng ký; HLV xem lớp được phân công nên không cần
  const facilityTerms = useFacilityTerms({ enabled: !isCoach });
  const currentTerm = useCurrentTerm({ enabled: !isCoach });
  const classes = useClasses(
    { search: search || undefined, sportId, classType, areaType, termId, coachId: isCoach ? coachId : undefined },
    { enabled: !isCoach || Boolean(coachId) },
  );

  /** Số bộ lọc trong bảng "Bộ lọc" (khu vực, kỳ học) — để hiện số trên nút */
  const advancedFilterCount = Number(Boolean(areaType)) + Number(Boolean(termId));
  const hasFilters = Boolean(search || sportId || classType) || advancedFilterCount > 0;
  const clearFilters = () => {
    setSearch('');
    setSportId(undefined);
    setClassType(undefined);
    setAreaType(undefined);
    setTermId(undefined);
  };
  const clearAdvancedFilters = () => {
    setAreaType(undefined);
    setTermId(undefined);
  };

  return {
    isCoach,
    search, setSearch,
    sportId, setSportId,
    classType, setClassType,
    areaType, setAreaType,
    termId, setTermId,
    terms: facilityTerms.terms,
    currentTermId: currentTerm.data?.id,
    advancedFilterCount,
    hasFilters, clearFilters, clearAdvancedFilters,
    sports: sports.data?.data ?? [],
    classes: classes.data?.data ?? [],
    isLoading: classes.isLoading,
    // Làm mới cả danh sách lớp lẫn lịch học / chỗ trống của từng thẻ
    refresh: () => Promise.all([classes.refetch(), queryClient.invalidateQueries({ queryKey: ['course-plan'] })]),
  };
}
