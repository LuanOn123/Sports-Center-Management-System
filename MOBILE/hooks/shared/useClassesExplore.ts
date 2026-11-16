// hooks/shared/useClassesExplore.ts
// Logic màn Khám phá / Lớp dạy: tìm kiếm + lọc môn + lọc hạng lớp (+ khu vực và kỳ học cho hội viên như web),
// tải danh sách lớp. HLV chỉ thấy lớp mình phụ trách (giống web).

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useClasses, useSports } from './useClasses';
import { useCurrentTerm, useFacilityTerms } from './useTerms';
import { activeClassFilters, classFilterCount, type ClassFilterKey } from '../../lib/classFilters';
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

  const sportList = sports.data?.data ?? [];
  const filterState = { sportId, classType, areaType, termId };
  /** Số bộ lọc trong bảng "Bộ lọc" (môn tập, hạng lớp, khu vực, kỳ học) — hiện trên nút; ô tìm kiếm không tính vì luôn hiện trên màn hình */
  const filterCount = classFilterCount(filterState);
  /** Bộ lọc đang bật, mỗi cái một chip gỡ được ở màn chính */
  const activeFilters = activeClassFilters(filterState, { sports: sportList, terms: facilityTerms.terms });
  const hasFilters = Boolean(search) || filterCount > 0;
  const clearSelectedFilters = () => {
    setSportId(undefined);
    setClassType(undefined);
    setAreaType(undefined);
    setTermId(undefined);
  };
  const clearFilters = () => {
    setSearch('');
    clearSelectedFilters();
  };
  const clearFilter = (key: ClassFilterKey) => {
    if (key === 'sport') setSportId(undefined);
    else if (key === 'type') setClassType(undefined);
    else if (key === 'area') setAreaType(undefined);
    else setTermId(undefined);
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
    filterCount, activeFilters,
    hasFilters, clearFilters, clearSelectedFilters, clearFilter,
    sports: sportList,
    classes: classes.data?.data ?? [],
    isLoading: classes.isLoading,
    // Làm mới cả danh sách lớp lẫn lịch học / chỗ trống của từng thẻ
    refresh: () => Promise.all([classes.refetch(), queryClient.invalidateQueries({ queryKey: ['course-plan'] })]),
  };
}
