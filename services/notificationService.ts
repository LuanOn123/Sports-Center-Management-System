// services/notificationService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api, apiRequest } from '../lib/api';
import type { AppNotification } from '../lib/types';

export interface NotificationQuery {
  isRead?: 'true' | 'false';
  type?: string;
  page?: string;
  limit?: string;
}

/**
 * GET /notifications — MỘT trang (BE: page, limit tối đa 100, isRead, type) kèm phân trang.
 * Không tải hết mọi trang: người dùng lâu năm có hàng trăm thông báo, màn hình tải trang kế khi kéo xuống cuối.
 */
export const getNotificationsPage = (query: NotificationQuery, signal?: AbortSignal) =>
  apiRequest<AppNotification[]>('/notifications', 'GET', { query: { ...query }, signal });

/** GET /notifications/unread-count */
export const getUnreadNotificationCount = () =>
  api.get<{ unreadCount: number }>('/notifications/unread-count');

/** PATCH /notifications/mark-all-read */
export const markAllNotificationsRead = () =>
  api.patch('/notifications/mark-all-read');

/** PATCH /notifications/:id/read */
export const markNotificationRead = (id: string) =>
  api.patch<AppNotification>(`/notifications/${id}/read`);
