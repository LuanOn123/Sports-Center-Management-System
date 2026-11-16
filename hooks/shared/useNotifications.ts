// hooks/shared/useNotifications.ts
// Business logic cho thông báo — dùng chung cho mọi role: danh sách phân trang (trang kế tải khi kéo xuống cuối), bộ lọc
// "chưa đọc" do BE lọc (isRead=false), đánh dấu đã đọc. Quy tắc thuần ở lib/notifications.

import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationsPage,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService';
import { NOTIFICATION_PAGE_SIZE } from '../../constants/notifications';
import { mergeNotificationPages, nextNotificationPage } from '../../lib/notifications';

export function useNotifications(options: { unreadOnly?: boolean } = {}) {
  const queryClient = useQueryClient();
  const unreadOnly = Boolean(options.unreadOnly);

  const query = useInfiniteQuery({
    queryKey: ['notifications', unreadOnly ? 'unread' : 'all'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getNotificationsPage(
        { page: String(pageParam), limit: String(NOTIFICATION_PAGE_SIZE), ...(unreadOnly ? { isRead: 'false' as const } : {}) },
        signal,
      ),
    getNextPageParam: nextNotificationPage,
  });

  // Đã đọc đổi cả hai danh sách (tất cả / chưa đọc) lẫn số chưa đọc trên chuông
  const refreshAfterRead = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  };
  const markReadMutation = useMutation({ mutationFn: (id: string) => markNotificationRead(id), onSuccess: refreshAfterRead });
  const markAllReadMutation = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refreshAfterRead });

  const notifications = useMemo(() => mergeNotificationPages(query.data?.pages ?? []), [query.data]);

  return {
    notifications,
    isLoading: query.isLoading,
    error: query.error,
    /** Tải lại các trang đang xem và số chưa đọc */
    refresh: () => Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })]),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}

export function useUnreadNotificationCount() {
  const query = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
  });

  return query.data?.data?.unreadCount ?? 0;
}
