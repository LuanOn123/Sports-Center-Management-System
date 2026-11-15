// hooks/shared/useChatUnreadCount.ts
// Số tin nhắn chưa đọc — huy hiệu trên tab Tin nhắn; tự làm mới định kỳ

import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '../../services/chatService';
import { CHAT_UNREAD_REFRESH_MS } from '../../constants/chat';

export function useChatUnreadCount() {
  const { data } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: () => getUnreadCount(),
    refetchInterval: CHAT_UNREAD_REFRESH_MS,
  });
  return data?.data?.unreadCount ?? 0;
}
