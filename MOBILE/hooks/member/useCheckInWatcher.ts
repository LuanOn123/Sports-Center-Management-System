// hooks/member/useCheckInWatcher.ts
// Báo ngay khi lễ tân vừa quét mã QR của hội viên: trong lúc màn Check-in đang hiện, hỏi lượt vào cửa mới nhất mỗi vài giây
// và so với lượt mới nhất lúc mở màn (lib/facilityVisit › newVisitSince). App ra nền thì React Query tự dừng hỏi.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { getLatestVisit, type FacilityVisit } from '../../services/workflowService';
import { CHECKIN_WATCH_INTERVAL_MS } from '../../constants/workflow';
import { Haptic } from '../../lib/haptics';
import { newVisitSince } from '../../lib/facilityVisit';

export function useCheckInWatcher(enabled: boolean) {
  const queryClient = useQueryClient();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  const latest = useQuery({
    // Cùng tiền tố 'facility-visits' với lịch sử nên check-in hay làm mới lịch sử cũng làm mới mốc này
    queryKey: ['facility-visits', 'latest'],
    enabled: enabled && focused,
    queryFn: () => getLatestVisit(),
    refetchInterval: CHECKIN_WATCH_INTERVAL_MS,
  });

  // Mốc = id lượt mới nhất lúc mở màn (null = lúc đó chưa có lượt nào); undefined = chưa hỏi được lần nào
  const baseline = useRef<string | null | undefined>(undefined);
  const [arrived, setArrived] = useState<FacilityVisit | null>(null);

  useEffect(() => {
    if (!latest.isSuccess) return;
    if (baseline.current === undefined) {
      baseline.current = latest.data?.id ?? null;
      return;
    }
    const fresh = newVisitSince(baseline.current, latest.data);
    if (!fresh) return;
    baseline.current = fresh.id;
    setArrived(fresh);
    Haptic.success();
    // Lịch sử vào cửa bên dưới phải có lượt mới ngay, không để lệch với thông báo
    void queryClient.invalidateQueries({ queryKey: ['facility-visits'] });
  }, [latest.isSuccess, latest.data, queryClient]);

  return { arrived, dismiss: () => setArrived(null) };
}
