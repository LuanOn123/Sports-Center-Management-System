// hooks/shared/useAppStateFocus.ts
// Báo cho React Query biết app đang ở foreground/background (RN không có sự kiện "window focus").
// Khi người dùng quay lại app (vd. sau khi chuyển khoản trong app ngân hàng), các query
// đang hiển thị được tải lại ngay thay vì đợi chu kỳ polling kế tiếp.

import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

export function useAppStateFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return; // web đã có window focus sẵn
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);
}
