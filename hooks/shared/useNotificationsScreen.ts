// hooks/shared/useNotificationsScreen.ts
// Màn Thông báo: danh sách, đánh dấu đã đọc, và mở màn đích khi bấm vào một thông báo (navigation/notificationRoute)

import { useRouter } from 'expo-router';
import { useNotifications } from './useNotifications';
import { Haptic } from '../../lib/haptics';
import { resolveNotificationRoute } from '../../navigation/notificationRoute';
import type { AppNotification } from '../../lib/types';

export function useNotificationsScreen() {
  const router = useRouter();
  const { notifications, isLoading, refetch, markRead, markAllRead, isMarkingAllRead } = useNotifications();

  return {
    notifications,
    isLoading,
    isMarkingAllRead,
    hasUnread: notifications.some((n) => !n.isRead),
    /** Bấm vào một thông báo: đánh dấu đã đọc rồi mở đúng màn (nếu loại này có màn đích) */
    open: (item: AppNotification) => {
      Haptic.light();
      if (!item.isRead) markRead(item.id);
      const route = resolveNotificationRoute(item);
      if (route) router.push(route);
    },
    markAll: () => {
      Haptic.medium();
      markAllRead();
    },
    refresh: () => {
      Haptic.light();
      void refetch();
    },
  };
}
