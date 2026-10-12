// services/notificationService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { AppNotification } from '../lib/types';

export interface NotificationQuery {
  isRead?: 'true' | 'false';
  type?: string;
  page?: string;
  limit?: string;
}

/** GET /notifications */
export const getNotifications = (query?: NotificationQuery) =>
  api.get<AppNotification[]>('/notifications', query as Record<string, string | undefined>);

/** GET /notifications/unread-count */
export const getUnreadNotificationCount = () =>
  api.get<{ unreadCount: number }>('/notifications/unread-count');

/** PATCH /notifications/mark-all-read */
export const markAllNotificationsRead = () =>
  api.patch('/notifications/mark-all-read');

/** PATCH /notifications/:id/read */
export const markNotificationRead = (id: string) =>
  api.patch<AppNotification>(`/notifications/${id}/read`);
