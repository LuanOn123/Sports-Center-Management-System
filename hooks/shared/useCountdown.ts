// hooks/shared/useCountdown.ts
// Đếm ngược tới một mốc thời gian (ISO) — cập nhật mỗi giây

import { useEffect, useMemo, useState } from 'react';
import { formatCountdown } from '../../lib/format';

const TICK_MS = 1000;

export function useCountdown(targetIso: string | undefined) {
  const target = useMemo(() => (targetIso ? Date.parse(targetIso) : 0), [targetIso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [target]);

  const remaining = Math.max(0, target - now);
  return { expired: remaining <= 0, label: formatCountdown(remaining) };
}
