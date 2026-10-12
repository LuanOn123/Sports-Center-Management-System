// hooks/shared/useChat.ts
// Business logic cho chat — Dùng chung cho Member & Coach

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getContacts, getMessages, markMessagesRead, sendMessage, GENERAL_CHAT_ID } from '../../services/chatService';
import { getSocket } from '../../lib/socket';
import type { ChatMessage, ChatConversation, User } from '../../lib/types';

export function usePartnerName(userId: string | undefined, paramName?: string) {
  const { data: contactsData } = useContacts();
  if (paramName && paramName !== 'Người dùng') return paramName;
  const contact = contactsData?.data?.find((c) => c.id === userId);
  return contact?.fullName ?? paramName ?? 'Người dùng';
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
  });

  // Sync REST data into local state
  useEffect(() => {
    if (query.data?.data) setMessages(query.data.data);
  }, [query.data]);

  // Mark as read on mount — phòng chung không có khái niệm đã đọc, BE trả count:0
  useEffect(() => {
    if (ready) markMessagesRead(targetId);
  }, [ready, targetId]);

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
      if (!isGeneral && msg.senderId === userId) {
        markMessagesRead(targetId);
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [userId, currentUserId, isGeneral, ready, targetId]);

  const handleSend = useCallback(
    async (content: string, currentUser?: User | null) => {
      if (!ready || !content.trim()) return;

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
        const res = await sendMessage({ receiverId: targetId, content: content.trim() });
        setMessages((prev) =>
          prev.map((m) => (m.id === optMsg.id ? res.data : m))
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
    refetch: query.refetch,
    handleSend,
    send: handleSend,
    isGeneral,
  };
}
