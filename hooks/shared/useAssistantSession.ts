// hooks/shared/useAssistantSession.ts
// Cuộc trò chuyện với trợ lý AI: danh sách tin, đang chờ trả lời, gửi / gửi lại / dừng / làm mới.
//
// Sống ở cấp gốc ứng dụng (context/AssistantContext.tsx) nên mở bong bóng, thoát ra rồi vào lại vẫn thấy cuộc trò
// chuyện đang dở. Chỉ nằm trong bộ nhớ — không ghi ra máy; đổi tài khoản, đổi cơ sở hoặc đăng xuất thì xóa sạch.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ASSISTANT_TEXT } from '../../constants/assistant';
import {
  aiErrorMessage,
  buildHistory,
  checkDraft,
  nextMessageId,
  withFailure,
  withoutMessage,
  type ChatMessage,
} from '../../lib/aiChat';
import { sendAiMessage } from '../../services/aiService';

export interface AssistantSession {
  messages: readonly ChatMessage[];
  /** Đang chờ AI trả lời */
  pending: boolean;
  /** Có câu trả lời mới khi chưa mở màn chat (hiện chấm trên bong bóng) */
  unread: boolean;
  /** Gửi tin; trả về false khi tin không hợp lệ hoặc đang chờ câu trả lời trước */
  send: (raw: string) => boolean;
  /** Gửi lại tin bị lỗi */
  retry: (id: string) => void;
  /** Dừng chờ câu trả lời đang bay */
  stop: () => void;
  /** Xóa cuộc trò chuyện */
  reset: () => void;
  /** Màn chat báo đang mở / đã đóng (đang mở thì câu trả lời mới không tính là chưa đọc) */
  setViewing: (viewing: boolean) => void;
}

/** `scopeKey`: định danh tài khoản + cơ sở; đổi giá trị này thì cuộc trò chuyện được làm lại từ đầu */
export function useAssistantSession(scopeKey: string): AssistantSession {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [unread, setUnread] = useState(false);

  // Bản mới nhất của danh sách để callback bất đồng bộ không đọc phải giá trị cũ
  const messagesRef = useRef<readonly ChatMessage[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const viewingRef = useRef(false);
  const scopeRef = useRef(scopeKey);

  const commit = useCallback((next: readonly ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const settle = useCallback(() => {
    controllerRef.current = null;
    activeIdRef.current = null;
    setPending(false);
  }, []);

  const markFailed = useCallback(
    (id: string, error: string) => {
      commit(withFailure(messagesRef.current, id, error));
    },
    [commit],
  );

  const send = useCallback(
    (raw: string) => {
      const draft = checkDraft(raw);
      if (!draft.ok || controllerRef.current) return false;

      const message: ChatMessage = { id: nextMessageId('user'), role: 'user', content: draft.text, status: 'sent' };
      // Lịch sử là các lượt đã được trả lời TRƯỚC tin này (tin lỗi không gửi lại cho AI)
      const history = buildHistory(messagesRef.current);
      commit([...messagesRef.current, message]);

      const controller = new AbortController();
      controllerRef.current = controller;
      activeIdRef.current = message.id;
      setPending(true);

      sendAiMessage(message.content, history, controller.signal).then(
        (reply) => {
          if (controller.signal.aborted) return;
          if (!reply) {
            markFailed(message.id, ASSISTANT_TEXT.emptyReply);
          } else {
            commit([...messagesRef.current, { id: nextMessageId('assistant'), role: 'assistant', content: reply }]);
            if (!viewingRef.current) setUnread(true);
          }
          settle();
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          markFailed(message.id, aiErrorMessage(error));
          settle();
        },
      );
      return true;
    },
    [commit, markFailed, settle],
  );

  const retry = useCallback(
    (id: string) => {
      if (controllerRef.current) return;
      const target = messagesRef.current.find((m) => m.id === id && m.status === 'failed');
      if (!target) return;
      // Gửi lại = đưa tin xuống cuối như một lượt mới
      commit(withoutMessage(messagesRef.current, id));
      send(target.content);
    },
    [commit, send],
  );

  const stop = useCallback(() => {
    const controller = controllerRef.current;
    const id = activeIdRef.current;
    if (!controller) return;
    controller.abort();
    settle();
    if (id) markFailed(id, ASSISTANT_TEXT.stopped);
  }, [markFailed, settle]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    settle();
    setUnread(false);
    commit([]);
  }, [commit, settle]);

  const setViewing = useCallback((viewing: boolean) => {
    viewingRef.current = viewing;
    if (viewing) setUnread(false);
  }, []);

  // Tài khoản/cơ sở khác: cuộc trò chuyện của người trước không được lộ sang người sau
  useEffect(() => {
    if (scopeRef.current === scopeKey) return;
    scopeRef.current = scopeKey;
    reset();
  }, [scopeKey, reset]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return useMemo(
    () => ({ messages, pending, unread, send, retry, stop, reset, setViewing }),
    [messages, pending, unread, send, retry, stop, reset, setViewing],
  );
}
