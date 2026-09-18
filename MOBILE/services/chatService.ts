// services/chatService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { ChatConversation, ChatContact, ChatMessage } from '../lib/types';

/** GET /chat/conversations */
export const getConversations = () =>
  api.get<ChatConversation[]>('/chat/conversations');

/** GET /chat/contacts */
export const getContacts = () =>
  api.get<ChatContact[]>('/chat/contacts');

/** GET /chat/messages?targetId=... */
export const getMessages = (targetId: string) =>
  api.get<ChatMessage[]>(`/chat/messages`, { targetId });

/** POST /chat/messages */
export const sendMessage = (body: { receiverId: string; content: string }) =>
  api.post<ChatMessage>('/chat/messages', body);

/** PATCH /chat/messages/read */
export const markMessagesRead = (targetId: string) =>
  api.patch('/chat/messages/read', { targetId });
