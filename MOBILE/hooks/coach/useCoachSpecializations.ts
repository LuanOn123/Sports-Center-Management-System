// hooks/coach/useCoachSpecializations.ts
// Bộ môn một HLV được phép giảng dạy: danh sách sportId của HLV + danh mục bộ môn → danh sách tên

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getAllSports } from '../../services/classService';
import { getCoachSpecializations } from '../../services/coachService';
import { specializationNames } from '../../lib/coachProfile';

export function useCoachSpecializations(coachId: string) {
  const { currentFacility } = useAuth();
  return useQuery({
    queryKey: ['coach-assigned-sports', coachId, currentFacility?.id],
    queryFn: async ({ signal }) => {
      const [assigned, sports] = await Promise.all([getCoachSpecializations(coachId, signal), getAllSports(signal)]);
      return specializationNames(assigned.data, sports.data);
    },
  });
}
