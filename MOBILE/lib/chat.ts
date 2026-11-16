// lib/chat.ts
// Quy tắc thuần của danh sách tin nhắn — theo web (shared/Communication.tsx › Chat)

import { CHAT_TEXT as TEXT } from '../constants/chat';
import type { ChatContact, ChatConversation } from './types';

const timeOf = (row: ChatConversation) => (row.latestMessage ? new Date(row.latestMessage.createdAt).getTime() : 0);

/** Thứ tự như web: có tin chưa đọc lên đầu, rồi mới nhắn gần nhất, rồi theo tên */
export function sortInboxRows(rows: readonly ChatConversation[]): ChatConversation[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.unreadCount > 0) - Number(a.unreadCount > 0) ||
      timeOf(b) - timeOf(a) ||
      a.user.fullName.localeCompare(b.user.fullName, 'vi'),
  );
}

/**
 * Gộp mọi liên hệ được phép nhắn (GET /chat/contacts) với các cuộc trò chuyện đã có (GET /chat/conversations): liên hệ chưa nhắn
 * lần nào vẫn có dòng (không tin nhắn, chưa đọc 0) để tìm tên rồi nhắn; cuộc trò chuyện với người không còn trong danh sách liên hệ
 * vẫn giữ (web gộp cả hai nguồn).
 */
export function buildInboxRows(contacts: readonly ChatContact[], conversations: readonly ChatConversation[]): ChatConversation[] {
  const byUser = new Map(conversations.map((c) => [c.user.id, c]));
  const rows: ChatConversation[] = contacts.map((contact) => byUser.get(contact.id) ?? { user: contact, latestMessage: null, unreadCount: 0 });
  const listed = new Set(contacts.map((contact) => contact.id));
  for (const conversation of conversations) {
    if (!listed.has(conversation.user.id)) rows.push(conversation);
  }
  return sortInboxRows(rows);
}

/** Lọc theo tên hoặc email (không phân biệt hoa thường); ô tìm trống thì giữ nguyên */
export function filterInboxRows(rows: readonly ChatConversation[], query: string): ChatConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => `${row.user.fullName} ${row.user.email ?? ''}`.toLowerCase().includes(q));
}

/** Chưa tìm: chỉ những người đã nhắn với mình (web); đang tìm: lọc theo tên / email trong mọi liên hệ để bắt đầu cuộc trò chuyện mới */
export function visibleInboxRows(rows: readonly ChatConversation[], query: string): ChatConversation[] {
  return query.trim() ? filterInboxRows(rows, query) : rows.filter((row) => row.latestMessage !== null);
}

/** Dòng xem trước của một hội thoại (web): "Bạn: nội dung", "Đã gửi tệp đính kèm", chưa có tin thì mời bắt đầu */
export function inboxPreview(row: ChatConversation, currentUserId: string | undefined): string {
  const latest = row.latestMessage;
  if (!latest) return TEXT.startConversation;
  const prefix = latest.senderId === currentUserId ? TEXT.youPrefix : '';
  return prefix + (latest.content || (latest.fileUrl ? TEXT.attachmentSent : TEXT.newMessage));
}

/** Tập người đang trực tuyến sau một sự kiện presenceChanged của BE; trả về chính tập cũ nếu không có gì đổi (khỏi dựng lại giao diện) */
export function applyPresence(current: ReadonlySet<string>, userId: string, online: boolean): ReadonlySet<string> {
  if (current.has(userId) === online) return current;
  const next = new Set(current);
  if (online) next.add(userId);
  else next.delete(userId);
  return next;
}
