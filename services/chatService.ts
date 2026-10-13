// services/chatService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api, apiRequest, ApiError } from '../lib/api';
import { Platform } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';
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

export const CHAT_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export async function sendMessageWithFile(receiverId: string | undefined, content: string, file: DocumentPickerAsset) {
  if (file.size != null && file.size > 10 * 1024 * 1024) throw new ApiError('Tệp tối đa 10 MB.', 400);
  const mimeType = file.mimeType || file.file?.type || '';
  if (!CHAT_FILE_TYPES.includes(mimeType)) throw new ApiError('Chỉ gửi được ảnh JPEG/PNG/WebP/GIF hoặc PDF.', 400);
  const body = new FormData();
  if (receiverId) body.append('receiverId', receiverId);
  if (content.trim()) body.append('content', content.trim());
  if (Platform.OS === 'web') body.append('file', file.file || await fetch(file.uri).then((r) => r.blob()), file.name);
  else body.append('file', { uri: file.uri, name: file.name, type: mimeType } as unknown as Blob);
  return apiRequest<ChatMessage>('/chat/messages', 'POST', { body, headers: { 'Content-Type': 'multipart/form-data' } });
}

/** PATCH /chat/messages/read — phòng chung không có khái niệm đã đọc, BE trả count:0 */
export const markMessagesRead = (targetId?: string) =>
  api.patch('/chat/messages/read', { targetId });
