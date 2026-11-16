// hooks/shared/useChatInbox.ts
// Tab Tin nhắn (web: Chat — danh sách cuộc trò chuyện): liên hệ + cuộc trò chuyện gộp một, chưa đọc lên đầu rồi mới nhắn gần nhất,
// chỉ hiện người đã nhắn với mình trừ khi đang tìm, ai đang trực tuyến, làm mới. Quy tắc thuần ở lib/chat.

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useContacts, useConversations } from './useChat';
import { usePresence } from './usePresence';
import { buildInboxRows, visibleInboxRows } from '../../lib/chat';

export function useChatInbox() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const conversations = useConversations(user?.id);
  const contacts = useContacts();
  const online = usePresence();

  const rows = useMemo(
    () => buildInboxRows(contacts.contacts, conversations.conversations),
    [contacts.contacts, conversations.conversations],
  );
  const visibleRows = useMemo(() => visibleInboxRows(rows, search), [rows, search]);

  return {
    search,
    setSearch,
    rows: visibleRows,
    /** Id người đang trực tuyến (chấm xanh) */
    online,
    currentUserId: user?.id,
    isLoading: conversations.isLoading || contacts.isLoading,
    refresh: () => {
      void conversations.refetch();
      void contacts.refetch();
    },
  };
}
