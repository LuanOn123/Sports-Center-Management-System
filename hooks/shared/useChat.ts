// hooks/shared/useChat.ts
// Business logic cho chat — Dùng chung cho Member & Coach

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getContacts, getMessages, markMessagesRead, sendMessage } from '../../services/chatService';
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
      if (msg.senderId !== currentUserId) {
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

  const query = useQuery({
    queryKey: ['chat-messages', userId],
    queryFn: () => getMessages(userId!),
    enabled: Boolean(userId),
  });

  // Sync REST data into local state
  useEffect(() => {
    if (query.data?.data) setMessages(query.data.data);
  }, [query.data]);

  // Mark as read on mount
  useEffect(() => {
    if (userId) markMessagesRead(userId);
  }, [userId]);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !userId) return;

    const handleNewMessage = (msg: ChatMessage) => {
      if (
        (msg.senderId === userId && msg.receiverId === currentUserId) ||
        (msg.senderId === currentUserId && msg.receiverId === userId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderId === userId) {
          markMessagesRead(userId);
        }
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [userId, currentUserId]);

  const handleSend = useCallback(
    async (content: string, currentUser?: User | null) => {
      if (!userId || !content.trim()) return;

      const optMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId ?? '',
        receiverId: userId,
        content: content.trim(),
        isRead: false,
        createdAt: new Date().toISOString(),
        sender: currentUser ?? undefined,
      };
      setMessages((prev) => [...prev, optMsg]);

      try {
        const res = await sendMessage({ receiverId: userId, content: content.trim() });
        setMessages((prev) =>
          prev.map((m) => (m.id === optMsg.id ? res.data : m))
        );
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optMsg.id));
        throw err;
      }
    },
    [userId, currentUserId, queryClient]
  );

  return {
    messages,
    isLoading: query.isLoading,
    refetch: query.refetch,
    handleSend,
    send: handleSend,
  };
}
