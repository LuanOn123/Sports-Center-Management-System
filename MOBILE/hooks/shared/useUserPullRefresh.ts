// hooks/shared/useUserPullRefresh.ts
// Gắn vào RefreshControl: vòng xoay chỉ hiện khi người dùng kéo (logic ở lib/pullRefresh.ts).
// `busy` = màn đang làm mới dữ liệu (kể cả ngầm) — chỉ dùng để biết khi nào lần kéo kết thúc.

import { useCallback, useEffect, useState } from 'react';
import { PULL_IDLE_TIMEOUT_MS } from '../../constants/refresh';
import { IDLE_PULL, pullBusyChanged, pullIdleTimedOut, startPull, type PullState } from '../../lib/pullRefresh';

export function useUserPullRefresh(busy: boolean, onRefresh?: () => void) {
  const [state, setState] = useState<PullState>(IDLE_PULL);

  useEffect(() => {
    setState((current) => pullBusyChanged(current, busy));
  }, [busy]);

  useEffect(() => {
    if (!state.pulling || state.sawBusy) return;
    const timer = setTimeout(() => setState(pullIdleTimedOut), PULL_IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state.pulling, state.sawBusy]);

  const onPull = useCallback(() => {
    setState(startPull(busy));
    onRefresh?.();
  }, [busy, onRefresh]);

  return { pulling: state.pulling, onPull };
}
