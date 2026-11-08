// lib/aiChat.ts
// Logic thuần của chat AI: làm sạch câu trả lời, dựng lịch sử gửi BE, kiểm tra tin nhắn, đổi lỗi sang câu tiếng Việt.
// Không phụ thuộc React/Expo nên chạy được trong test.

import { ApiError } from './api';
import {
  ASSISTANT_COUNTER_THRESHOLD,
  ASSISTANT_ERRORS,
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_MAX_MESSAGE_LENGTH,
} from '../constants/assistant';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Chỉ tin của người dùng: `failed` = chưa được trả lời (lỗi, mất mạng, người dùng bấm dừng) */
  status?: 'sent' | 'failed';
  /** Lý do thất bại, hiển thị dưới tin nhắn */
  error?: string;
}

/** Phần tử lịch sử đúng như BE nhận ở POST /ai/chat */
export interface AiHistoryItem {
  role: ChatRole;
  content: string;
}

/**
 * Mô hình lập luận (vd. Qwen) có thể trả cả khối <think>…</think> trong nội dung; người dùng chỉ cần phần trả lời.
 * Cắt khối đầy đủ, thẻ đóng lẻ (mô hình bỏ thẻ mở) và khối chưa đóng (bị cắt giữa chừng).
 */
export function stripThinking(text: string) {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const lastClose = out.search(/<\/think>(?![\s\S]*<\/think>)/i);
  if (lastClose >= 0) out = out.slice(lastClose + '</think>'.length);
  out = out.replace(/<think>[\s\S]*$/i, '');
  return out.trim();
}

/** Câu trả lời hiển thị được; chuỗi rỗng nghĩa là AI chưa trả về nội dung */
export function normalizeReply(reply: unknown) {
  return typeof reply === 'string' ? stripThinking(reply) : '';
}

/** Tin nhắn hợp lệ để gửi: không rỗng sau khi cắt khoảng trắng và không vượt giới hạn */
export type DraftCheck =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'too-long' };

export function checkDraft(raw: string): DraftCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > ASSISTANT_MAX_MESSAGE_LENGTH) return { ok: false, reason: 'too-long' };
  return { ok: true, text };
}

/**
 * Lịch sử gửi kèm: chỉ các lượt đã được trả lời (bỏ tin lỗi), tối đa ASSISTANT_HISTORY_LIMIT tin gần nhất,
 * và luôn bắt đầu bằng tin của người dùng (cắt lẻ một câu trả lời đứng đầu do cửa sổ cắt giữa cặp hỏi–đáp).
 */
export function buildHistory(messages: readonly ChatMessage[], limit = ASSISTANT_HISTORY_LIMIT): AiHistoryItem[] {
  const answered = messages.filter((m) => m.status !== 'failed' && m.content.trim().length > 0);
  const window = answered.slice(-limit);
  const firstUser = window.findIndex((m) => m.role === 'user');
  return (firstUser <= 0 ? window : window.slice(firstUser)).map(({ role, content }) => ({ role, content }));
}

/** Đánh dấu một tin của người dùng là chưa được trả lời, kèm lý do (không đổi danh sách gốc) */
export function withFailure(messages: readonly ChatMessage[], id: string, error: string): ChatMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, status: 'failed' as const, error } : m));
}

/** Bỏ một tin khỏi danh sách (dùng khi gửi lại: tin được đưa xuống cuối như lượt mới) */
export function withoutMessage(messages: readonly ChatMessage[], id: string): ChatMessage[] {
  return messages.filter((m) => m.id !== id);
}

/** Đổi lỗi gọi API sang câu thân thiện: không lộ tên biến cấu hình của BE (GROQ_API_KEY…) */
export function aiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 503) return ASSISTANT_ERRORS.unavailable;
    if (error.status === 429) return ASSISTANT_ERRORS.tooManyRequests;
    if (error.status === 413) return ASSISTANT_ERRORS.tooLong;
    // status 0 = mất mạng / quá thời gian: ApiError đã có câu tiếng Việt riêng
    if (error.status === 0 || error.status === 400 || error.status === 422) return error.message || ASSISTANT_ERRORS.generic;
    if (error.status >= 500) return ASSISTANT_ERRORS.unavailable;
    return error.message || ASSISTANT_ERRORS.generic;
  }
  return error instanceof Error && error.message ? error.message : ASSISTANT_ERRORS.generic;
}

/** Lỗi do chính người dùng bấm "Dừng" (AbortController) — không phải sự cố */
export function isAbortError(error: unknown) {
  const e = error as { code?: string; name?: string } | null;
  return Boolean(e && (e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError'));
}

let sequence = 0;
/** Mã tin nhắn cục bộ (chỉ dùng làm key danh sách) */
export function nextMessageId(role: ChatRole) {
  sequence += 1;
  return `${role}-${Date.now().toString(36)}-${sequence}`;
}

/** Dòng đếm ký tự (chỉ khi đã dùng gần hết giới hạn), vd. "950/1000" */
export function counterLabel(length: number, max = ASSISTANT_MAX_MESSAGE_LENGTH, threshold = ASSISTANT_COUNTER_THRESHOLD) {
  return length >= Math.floor(max * threshold) ? `${length}/${max}` : null;
}

