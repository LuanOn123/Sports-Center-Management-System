// hooks/shared/useNotificationsScreen.ts
// Màn Thông báo (web: Notifications): danh sách phân trang, lọc "chỉ xem chưa đọc", đánh dấu đã đọc, và mở màn đích khi bấm
// vào một thông báo (navigation/notificationRoute)

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useUnreadNotificationCount } from './useNotifications';
import { NOTIFICATION_TEXT as TEXT } from '../../constants/notifications';
import { Haptic } from '../../lib/haptics';
import { notificationActionLabel, resolveNotificationTarget } from '../../navigation/notificationRoute';
import type { AppNotification } from '../../lib/types';

export function useNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useNotifications({ unreadOnly });
  const unreadCount = useUnreadNotificationCount();

  return {
    notifications: list.notifications,
    isLoading: list.isLoading,
    error: list.error,
    unreadOnly,
    toggleUnreadOnly: () => setUnreadOnly((value) => !value),
    /** "N thông báo chưa đọc" hoặc "Cập nhật từ trung tâm" khi không còn thông báo chưa đọc (web) */
    subtitle: unreadCount > 0 ? TEXT.subtitleUnread(unreadCount) : TEXT.subtitleDefault,
    /** Số chưa đọc do BE đếm (đúng cả khi mới tải một vài trang) */
    canMarkAll: unreadCount > 0,
    isMarkingAllRead: list.isMarkingAllRead,
    /** Nhãn nút hành động của một thông báo; null nếu loại này không có màn đích */
    actionLabelOf: (item: AppNotification) => {
      const target = resolveNotificationTarget(item, role);
      return target ? notificationActionLabel(target.kind, role) : null;
    },
    /** Bấm vào một thông báo: đánh dấu đã đọc rồi mở đúng màn (nếu loại này có màn đích) */
    open: (item: AppNotification) => {
      Haptic.light();
      if (!item.isRead) list.markRead(item.id);
      const target = resolveNotificationTarget(item, role);
      if (target) router.push(target.route);
    },
    markAll: () => {
      Haptic.medium();
      list.markAllRead();
    },
    refresh: () => {
      Haptic.light();
      void list.refresh();
    },
    /** Kéo xuống cuối danh sách: tải trang kế (nếu còn và chưa đang tải) */
    loadMore: () => {
      if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
    },
    isFetchingMore: list.isFetchingNextPage,
  };
}
