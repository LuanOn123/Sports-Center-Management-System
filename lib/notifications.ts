// lib/notifications.ts
// Quy tắc thuần của màn Thông báo: phân trang theo trang của BE, gộp các trang đã tải, cắt gọn nội dung dài

import { NOTIFICATION_BODY_PREVIEW_CHARS } from '../constants/notifications';
import type { Envelope } from './api';
import type { AppNotification } from './types';

type NotificationPage = Pick<Envelope<AppNotification[]>, 'data' | 'pagination'>;

/** Số trang kế tiếp theo phân trang của BE; undefined khi đã hết trang (hoặc BE không trả phân trang) */
export function nextNotificationPage(last: Pick<Envelope<unknown>, 'pagination'>): number | undefined {
  const pagination = last.pagination;
  return pagination && pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
}

/**
 * Gộp các trang đã tải thành một danh sách. Phân trang theo vị trí nên khi có thông báo mới chen vào đầu, trang sau có thể
 * lặp lại thông báo cuối của trang trước — bỏ trùng theo id, giữ thứ tự BE trả (mới nhất trước).
 */
export function mergeNotificationPages(pages: readonly NotificationPage[]): AppNotification[] {
  const seen = new Set<string>();
  const merged: AppNotification[] = [];
  for (const page of pages) {
    for (const item of page.data) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/** Nội dung dài thì cắt gọn và có nút "Xem đầy đủ" (web: NotificationBody) */
export const isLongNotification = (body: string) => body.length > NOTIFICATION_BODY_PREVIEW_CHARS;
