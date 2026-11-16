// hooks/shared/useChatUnreadCount.ts
// Số tin nhắn chưa đọc — huy hiệu trên tab Tin nhắn; có tin mới (socket) thì cập nhật ngay, ngoài ra tự làm mới định kỳ

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '../../services/chatService';
import { CHAT_UNREAD_REFRESH_MS } from '../../constants/chat';
import { getSocket } from '../../lib/socket';

export function useChatUnreadCount() {
  const { data, refetch } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: () => getUnreadCount(),
    refetchInterval: CHAT_UNREAD_REFRESH_MS,
  });

  // Tin mới tới thì huy hiệu đổi ngay (web: sự kiện newMessage làm mới số chưa đọc)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => { void refetch(); };
    socket.on('newMessage', refresh);
    return () => { socket.off('newMessage', refresh); };
  }, [refetch]);

  return data?.data?.unreadCount ?? 0;
}
