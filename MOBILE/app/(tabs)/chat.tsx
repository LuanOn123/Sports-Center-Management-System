import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { useConversations, useContacts } from '../../hooks/shared/useChat';
import { Colors } from '../../constants/theme';
import type { ChatConversation } from '../../lib/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

const ROLE_LABEL: Record<string, string> = {
  COACH: 'Huấn luyện viên',
  MEMBER: 'Hội viên',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
};

const ROLE_COLOR: Record<string, string> = {
  COACH: Colors.accent,
  MEMBER: Colors.status.scheduled,
  STAFF: Colors.status.suspended,
  MANAGER: Colors.primary,
};

export default function ChatTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const { conversations, isLoading: conversationsLoading, refetch: refetchConversations } = useConversations(user?.id);
  const { contacts, isLoading: contactsLoading, refetch: refetchContacts } = useContacts();
  const isLoading = conversationsLoading || contactsLoading;

  const onRefresh = () => {
    refetchConversations();
    refetchContacts();
  };

  // Gộp toàn bộ liên hệ được phép nhắn (BE: GET /chat/contacts) với hội thoại đã
  // có (BE: GET /chat/conversations) thành 1 danh sách duy nhất — không cần vào
  // màn "Nhắn tin mới" riêng nữa, ai cũng hiện thẳng ở đây.
  const rows: ChatConversation[] = useMemo(() => {
    const conversationById = new Map(conversations.map((c) => [c.user.id, c]));
    const merged = contacts.map((contact) => conversationById.get(contact.id) ?? {
      user: contact,
      latestMessage: null,
      unreadCount: 0,
    });
    return merged.sort((a, b) => {
      const aTime = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const bTime = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [contacts, conversations]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.user.fullName} ${r.user.email ?? ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className={clsx('p-xl pb-md', Platform.OS === 'ios' ? 'pt-[56px]' : 'pt-xl')}>
        <Text className="text-xxl font-bold font-bevn-bold text-text-primary">Nhắn Tin</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Liên lạc với huấn luyện viên & đội ngũ</Text>
      </View>

      {/* Tìm kiếm theo tên/email — lọc client-side trên danh sách đã gộp */}
      <View className="px-xl pb-sm">
        <View className="flex-row items-center bg-bg-surface rounded-lg px-md border border-border">
          <Icon name="search" size={18} color={Colors.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 py-sm text-text-primary text-md font-bevn-regular"
            placeholder="Tìm theo tên hoặc email..."
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {Boolean(search) && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={c => c.user.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px] px-xl">
              <Icon name="chat-bubble-outline" size={52} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-sm">
                {search ? 'Không tìm thấy liên hệ' : 'Chưa có ai để nhắn tin'}
              </Text>
              <Text className="text-sm text-text-muted font-bevn-regular text-center">
                {search ? `Không có ai khớp với "${search}"` : 'Chưa có huấn luyện viên/đội ngũ phù hợp'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className={clsx(
                'flex-row items-center gap-md rounded-lg p-lg border mb-sm',
                item.unreadCount > 0 ? 'border-[#A3E63550] bg-bg-elevated' : 'bg-bg-surface border-border'
              )}
              onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: item.user.id, name: item.user.fullName } } as any)}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View className="w-12 h-12 rounded-full bg-bg-elevated justify-center items-center border-2" style={{ borderColor: ROLE_COLOR[item.user.role] ?? Colors.border }}>
                <Text className="text-lg font-bold font-bevn-bold text-text-primary">{item.user.fullName[0]?.toUpperCase()}</Text>
              </View>

              {/* Content */}
              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-md font-bold font-bevn-bold text-text-primary flex-1" numberOfLines={1}>{item.user.fullName}</Text>
                  {item.latestMessage && (
                    <Text className="text-xs text-text-muted font-bevn-regular ml-2">{timeAgo(item.latestMessage.createdAt)}</Text>
                  )}
                </View>
                <View className="flex-row items-center gap-sm mb-1">
                  <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: (ROLE_COLOR[item.user.role] ?? Colors.text.muted) + '25' }}>
                    <Text className="text-[10px] font-bevn-semibold" style={{ color: ROLE_COLOR[item.user.role] ?? Colors.text.muted }}>
                      {ROLE_LABEL[item.user.role] ?? item.user.role}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View className="bg-primary rounded-full min-w-[20px] h-5 justify-center items-center px-1.5">
                      <Text className="text-[10px] font-bold font-bevn-bold text-text-inverse">{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
                {item.latestMessage?.content ? (
                  <Text
                    className={clsx('text-sm font-bevn-regular', item.unreadCount > 0 ? 'text-text-secondary font-bevn-semibold' : 'text-text-muted')}
                    numberOfLines={1}
                  >
                    {item.latestMessage.content}
                  </Text>
                ) : item.latestMessage?.fileUrl ? (
                  <Text className="text-sm text-text-muted font-bevn-regular" numberOfLines={1}>📎 Tệp đính kèm</Text>
                ) : (
                  <Text className="text-sm text-text-muted font-bevn-regular italic" numberOfLines={1}>Chưa có tin nhắn — bấm để bắt đầu</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
