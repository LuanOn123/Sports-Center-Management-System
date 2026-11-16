// hooks/shared/useChat.ts
// Business logic cho chat — Dùng chung cho Member & Coach

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getContacts, getMessages, markMessagesRead, sendMessage, sendMessageWithFile, GENERAL_CHAT_ID } from '../../services/chatService';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { CHAT_TEXT } from '../../constants/chat';
import { getSocket } from '../../lib/socket';
import type { ChatMessage, ChatConversation, User } from '../../lib/types';

/** Người đang trò chuyện: tên (ưu tiên tên truyền theo route, rồi danh sách liên hệ) và vai trò (nếu là liên hệ) */
export function usePartner(userId: string | undefined, paramName?: string) {
  const { contacts } = useContacts();
  const contact = contacts.find((c) => c.id === userId);
  const name = paramName && paramName !== CHAT_TEXT.unknownUser ? paramName : contact?.fullName ?? paramName ?? CHAT_TEXT.unknownUser;
  return { name, role: contact?.role };
}

export function useConversations(currentUserId: string | undefined) {
  const query = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: getConversations,
  });

  // Real-time: refetch when a new message arrives
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      // Tin phòng chung (receiverId null) không thuộc danh sách hội thoại 1-1 — bỏ qua.
      if (msg.receiverId != null && msg.senderId !== currentUserId) {
        query.refetch();
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [currentUserId, query.refetch]);

  const conversations: ChatConversation[] = query.data?.data ?? [];
  return { ...query, conversations };
}

export function useContacts() {
  const query = useQuery({
    queryKey: ['chat-contacts'],
    queryFn: getContacts,
  });
  const contacts = query.data?.data ?? [];
  return { ...query, contacts };
}

export function useChatMessages(userId: string | undefined, currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Route param "general" = phòng chung — BE biểu diễn bằng receiverId null trên
  // cùng bảng ChatMessage, không có targetId/endpoint riêng.
  const isGeneral = userId === GENERAL_CHAT_ID;
  const targetId = isGeneral ? undefined : userId;
  const ready = Boolean(userId);

  const query = useQuery({
    queryKey: ['chat-messages', userId ?? null],
    queryFn: () => getMessages(targetId),
    enabled: ready,
    refetchInterval: 30_000,
  });

  useEffect(() => { setMessages([]); }, [userId, currentUserId]);
  // Sync REST data into local state
  useEffect(() => {
    if (query.data?.data) setMessages(query.data.data);
  }, [query.data]);

  // Đã đọc xong thì số chưa đọc (huy hiệu tab Tin nhắn, danh sách hội thoại) đổi ngay, không chờ lượt hỏi định kỳ
  const markRead = useCallback(() => {
    void markMessagesRead(targetId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
        void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .catch(() => {});
  }, [targetId, queryClient]);

  // Mark as read on mount — phòng chung không có khái niệm đã đọc, BE trả count:0
  useEffect(() => {
    if (ready) markRead();
  }, [ready, markRead]);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !ready) return;

    const handleNewMessage = (msg: ChatMessage) => {
      const belongsHere = isGeneral
        ? msg.receiverId == null
        : (msg.senderId === userId && msg.receiverId === currentUserId) ||
          (msg.senderId === currentUserId && msg.receiverId === userId);
      if (!belongsHere) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!isGeneral && msg.senderId === userId) markRead();
    };

    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [userId, currentUserId, isGeneral, ready, markRead]);

  const handleSend = useCallback(
    async (content: string, currentUser?: User | null, attachment?: DocumentPickerAsset) => {
      if (!ready || (!content.trim() && !attachment)) return;

      const optMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId ?? '',
        receiverId: targetId ?? null,
        content: content.trim(),
        isRead: false,
        createdAt: new Date().toISOString(),
        sender: currentUser ?? undefined,
      };
      setMessages((prev) => [...prev, optMsg]);

      try {
        const res = attachment ? await sendMessageWithFile(targetId, content, attachment) : await sendMessage({ receiverId: targetId, content: content.trim() });
        setMessages((prev) =>
          [...prev.filter((m) => m.id !== optMsg.id && m.id !== res.data.id), res.data]
        );
        if (!isGeneral) {
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optMsg.id));
        throw err;
      }
    },
    [ready, targetId, isGeneral, currentUserId, queryClient]
  );

  return {
    messages,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    handleSend,
    send: handleSend,
    isGeneral,
  };
}
