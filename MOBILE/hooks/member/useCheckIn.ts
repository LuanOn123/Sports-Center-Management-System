// hooks/member/useCheckIn.ts
// Check-in cơ sở của hội viên: lịch sử vào cửa + ghi nhận lượt mới (web: FacilityVisits)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { checkInFacility, getMyVisits } from '../../services/workflowService';
import { memberProfileIdOf } from '../../lib/businessRules';

export function useCheckIn() {
  const { user, currentFacility } = useAuth();
  const cache = useQueryClient();
  const hasProfile = Boolean(memberProfileIdOf(user));

  const visits = useQuery({
    queryKey: ['facility-visits', currentFacility?.id],
    enabled: hasProfile,
    queryFn: ({ signal }) => getMyVisits(signal),
  });
  const checkIn = useMutation({
    mutationFn: checkInFacility,
    onSuccess: () => cache.invalidateQueries({ queryKey: ['facility-visits'] }),
  });

  return { hasProfile, canCheckIn: Boolean(currentFacility) && hasProfile, visits, checkIn };
}
