// services/chatService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { ChatConversation, ChatContact, ChatMessage } from '../lib/types';

// Sentinel route param cho "phòng chung" (không phải id user thật — BE dùng
// receiverId = null để biểu diễn phòng chung trên cùng bảng ChatMessage/route
// /chat/messages, không có endpoint/room riêng). Không trùng UUID user thật.
export const GENERAL_CHAT_ID = 'general';

/** GET /chat/conversations */
export const getConversations = () =>
  api.get<ChatConversation[]>('/chat/conversations');

/** GET /chat/contacts */
export const getContacts = () =>
  api.get<ChatContact[]>('/chat/contacts');

/** GET /chat/messages?targetId=... — bỏ targetId (undefined) để lấy phòng chung */
export const getMessages = (targetId?: string) =>
  api.get<ChatMessage[]>(`/chat/messages`, { targetId });

/** POST /chat/messages — bỏ receiverId (undefined) để gửi vào phòng chung */
export const sendMessage = (body: { receiverId?: string; content: string }) =>
  api.post<ChatMessage>('/chat/messages', body);

/** PATCH /chat/messages/read — phòng chung không có khái niệm đã đọc, BE trả count:0 */
export const markMessagesRead = (targetId?: string) =>
  api.patch('/chat/messages/read', { targetId });
