// lib/pullRefresh.ts
// Vòng xoay "kéo để tải lại" chỉ hiện khi NGƯỜI DÙNG kéo, không hiện khi dữ liệu tự làm mới ngầm (mở màn có cache cũ,
// quay lại màn…). Trước đây trạng thái làm mới ngầm (isRefetching) được gắn thẳng vào RefreshControl nên mỗi lần dữ liệu
// tự làm mới là một vòng xoay hiện thêm ở đầu trang, ngoài vòng tải của chính trang → cảm giác "loading hai lần".

export interface PullState {
  /** Vòng xoay đang hiện do người dùng kéo */
  pulling: boolean;
  /** Đã thấy màn báo "đang làm mới" kể từ lúc kéo (để biết khi nào lần kéo này xong) */
  sawBusy: boolean;
}

export const IDLE_PULL: PullState = { pulling: false, sawBusy: false };

/** Người dùng vừa kéo; `busy` = màn đang làm mới sẵn (vd. refetch ngầm đang chạy) */
export const startPull = (busy: boolean): PullState => ({ pulling: true, sawBusy: busy });

/** Màn báo trạng thái làm mới đổi: xong khi từng bận rồi hết bận */
export function pullBusyChanged(state: PullState, busy: boolean): PullState {
  if (!state.pulling) return state;
  if (busy) return state.sawBusy ? state : { pulling: true, sawBusy: true };
  return state.sawBusy ? IDLE_PULL : state;
}

/** Màn không báo trạng thái làm mới nào sau lần kéo → tự tắt để vòng xoay không kẹt */
export const pullIdleTimedOut = (state: PullState): PullState => (state.sawBusy ? state : IDLE_PULL);
