// hooks/shared/useNowUntil.ts
// Giờ hiện tại (ms) để màn hình ẩn/hiện theo một mốc hạn (ISO) mà không đếm từng giây như useCountdown:
// chỉ cập nhật đúng khi tới mốc đó và khi màn được focus lại (đổi tab, mở lại app).

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** setTimeout chỉ nhận tối đa 2^31 − 1 ms; lớn hơn thì chạy ngay, nên mốc xa được hẹn từng đoạn */
const MAX_TIMER_MS = 2_147_483_647;

export function useNowUntil(targetIso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const target = targetIso ? Date.parse(targetIso) : NaN;

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const current = Date.now();
      setNow(current);
      const left = target - current;
      if (left > 0) timer = setTimeout(arm, Math.min(left, MAX_TIMER_MS));
    };
    arm();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [target]);

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, [])
  );

  return now;
}
