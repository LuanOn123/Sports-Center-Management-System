// hooks/shared/useTyping.ts
// "đang nhập…" của cuộc trò chuyện 1-1 (web: sự kiện typing của socket): nhận tín hiệu của người kia (tự tắt nếu im quá lâu) và gửi
// tín hiệu của mình khi gõ (tắt sau 1,6 giây không gõ, khi gửi tin hoặc khi rời màn hình). Phòng chung không có "đang nhập".

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { CHAT_TYPING_EXPIRE_MS, CHAT_TYPING_IDLE_MS } from '../../constants/chat';

interface TypingEvent {
  userId: string;
  isTyping: boolean;
}

type Timer = ReturnType<typeof setTimeout>;

export function useTyping(partnerId: string | undefined, enabled: boolean) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const idleTimer = useRef<Timer | undefined>(undefined);
  const expireTimer = useRef<Timer | undefined>(undefined);
  /** Đã báo "đang nhập" mà chưa báo "ngừng" — để chỉ gửi tín hiệu ngừng khi thật sự cần */
  const announced = useRef(false);
  const active = enabled && Boolean(partnerId);

  // Nhận: chỉ tính tín hiệu của đúng người đang trò chuyện; im quá lâu thì tự tắt
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !active) return;
    const onTyping = ({ userId, isTyping }: TypingEvent) => {
      if (userId !== partnerId) return;
      clearTimeout(expireTimer.current);
      setPartnerTyping(isTyping);
      if (isTyping) expireTimer.current = setTimeout(() => setPartnerTyping(false), CHAT_TYPING_EXPIRE_MS);
    };
    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
      clearTimeout(expireTimer.current);
      setPartnerTyping(false);
    };
  }, [active, partnerId]);

  const emit = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    if (socket?.connected && partnerId) socket.emit('typing', { receiverId: partnerId, isTyping });
  }, [partnerId]);

  const stop = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (announced.current) emit(false);
    announced.current = false;
  }, [emit]);

  /** Gọi mỗi lần nội dung ô soạn đổi: có chữ thì báo đang nhập (và hẹn ngừng), hết chữ thì ngừng ngay */
  const notify = useCallback((text: string) => {
    if (!active) return;
    const typing = Boolean(text.trim());
    clearTimeout(idleTimer.current);
    if (!typing) {
      stop();
      return;
    }
    announced.current = true;
    emit(true);
    idleTimer.current = setTimeout(stop, CHAT_TYPING_IDLE_MS);
  }, [active, emit, stop]);

  // Rời màn hình (hoặc đổi người trò chuyện): báo ngừng gõ
  useEffect(() => stop, [stop]);

  return { partnerTyping, notify, stop };
}
