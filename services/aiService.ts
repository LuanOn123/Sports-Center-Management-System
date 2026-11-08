// services/aiService.ts
// Trợ lý AI: POST /ai/chat { message, history? } → { reply } (BE: Groq + dữ liệu cơ sở/lớp/gói tập/lịch sắp tới).

import { apiRequest } from '../lib/api';
import { AI_CHAT_PATH } from '../constants/assistant';
import { normalizeReply, type AiHistoryItem } from '../lib/aiChat';

export interface AiChatReply {
  reply: string;
}

/** Gửi một câu hỏi kèm lịch sử và trả về câu trả lời đã làm sạch (rỗng nếu AI không trả nội dung) */
export async function sendAiMessage(message: string, history: readonly AiHistoryItem[], signal?: AbortSignal) {
  const res = await apiRequest<AiChatReply>(AI_CHAT_PATH, 'POST', {
    body: history.length > 0 ? { message, history } : { message },
    signal,
  });
  return normalizeReply(res.data?.reply);
}
