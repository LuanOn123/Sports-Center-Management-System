// hooks/shared/useChatInbox.ts
// Tab Tin nhắn: danh sách liên hệ + cuộc trò chuyện gộp một, tìm theo tên/email (client-side), làm mới

import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useContacts, useConversations } from './useChat';
import { buildInboxRows, filterInboxRows } from '../../lib/chat';

export function useChatInbox() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const conversations = useConversations(user?.id);
  const contacts = useContacts();

  const rows = useMemo(
    () => buildInboxRows(contacts.contacts, conversations.conversations),
    [contacts.contacts, conversations.conversations],
  );
  const filteredRows = useMemo(() => filterInboxRows(rows, search), [rows, search]);

  return {
    search,
    setSearch,
    rows: filteredRows,
    isLoading: conversations.isLoading || contacts.isLoading,
    refresh: () => {
      void conversations.refetch();
      void contacts.refetch();
    },
  };
}
