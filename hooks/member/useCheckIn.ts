// hooks/member/useCheckIn.ts
// Check-in cơ sở của hội viên: mã QR thẻ hội viên cho lễ tân quét, lịch sử vào cửa, check-in tự khai (web: FacilityVisits)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { checkInFacility, getMyVisits } from '../../services/workflowService';
import { memberProfileIdOf } from '../../lib/businessRules';
import { memberCardPayload } from '../../lib/memberCard';
import { useCheckInWatcher } from './useCheckInWatcher';

export function useCheckIn() {
  const { user, currentFacility } = useAuth();
  const cache = useQueryClient();
  const hasProfile = Boolean(memberProfileIdOf(user));
  const watcher = useCheckInWatcher(hasProfile);

  const visits = useQuery({
    queryKey: ['facility-visits', currentFacility?.id],
    enabled: hasProfile,
    queryFn: ({ signal }) => getMyVisits(signal),
  });
  const checkIn = useMutation({
    mutationFn: checkInFacility,
    onSuccess: () => cache.invalidateQueries({ queryKey: ['facility-visits'] }),
  });

  // Lượt do chính nút "Check-in" vừa tạo đã có dòng "Đã ghi nhận lúc…" nên không báo thêm lần nữa
  const arrived = watcher.arrived && watcher.arrived.id !== checkIn.data?.data.id ? watcher.arrived : null;

  return {
    hasProfile,
    canCheckIn: Boolean(currentFacility) && hasProfile,
    visits,
    checkIn,
    card: { name: user?.fullName ?? '', avatarUrl: user?.avatarUrl, payload: memberCardPayload(user?.id) },
    arrived,
    dismissArrived: watcher.dismiss,
  };
}
