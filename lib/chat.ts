// lib/chat.ts
// Quy tắc thuần của danh sách tin nhắn

import type { ChatContact, ChatConversation } from './types';

/**
 * Gộp mọi liên hệ được phép nhắn (GET /chat/contacts) với các cuộc trò chuyện đã có (GET /chat/conversations) thành một
 * danh sách duy nhất: liên hệ chưa nhắn lần nào vẫn hiện (không tin nhắn, chưa đọc 0). Mới nhắn gần nhất xếp trước.
 */
export function buildInboxRows(contacts: readonly ChatContact[], conversations: readonly ChatConversation[]): ChatConversation[] {
  const byUser = new Map(conversations.map((c) => [c.user.id, c]));
  const rows = contacts.map((contact) => byUser.get(contact.id) ?? { user: contact, latestMessage: null, unreadCount: 0 });
  const timeOf = (row: ChatConversation) => (row.latestMessage ? new Date(row.latestMessage.createdAt).getTime() : 0);
  return rows.sort((a, b) => timeOf(b) - timeOf(a));
}

/** Lọc theo tên hoặc email (không phân biệt hoa thường); ô tìm trống thì giữ nguyên */
export function filterInboxRows(rows: readonly ChatConversation[], query: string): ChatConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => `${row.user.fullName} ${row.user.email ?? ''}`.toLowerCase().includes(q));
}
