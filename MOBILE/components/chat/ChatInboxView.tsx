// components/chat/ChatInboxView.tsx
// Tab Tin nhắn (web: Chat — danh sách cuộc trò chuyện): ô tìm, "Phòng chung" ghim đầu, các liên hệ kèm số chưa đọc.
// Logic ở hooks/shared/useChatInbox; quy tắc gộp / lọc ở lib/chat.

import React, { useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import type { TextInputInstance } from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { useChatInbox } from '../../hooks/shared/useChatInbox';
import { GENERAL_CHAT_ID } from '../../services/chatService';
import { CHAT_ROLE_COLOR, CHAT_ROLE_LABEL, CHAT_TEXT as TEXT, GENERAL_CHAT_TITLE } from '../../constants/chat';
import { Colors } from '../../constants/theme';
import { timeAgo } from '../../lib/format';
import { ROUTES } from '../../navigation/routes';

export function ChatInboxView() {
  const router = useRouter();
  const searchInputRef = useRef<TextInputInstance>(null);
  const inbox = useChatInbox();

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader variant="tab" title={TEXT.inboxTitle} />

      {/* Tìm theo tên/email — lọc client-side trên danh sách đã gộp */}
      <View className="px-xl pt-xl pb-sm">
        <Pressable
          onPress={() => searchInputRef.current?.focus()}
          className="flex-row items-center bg-bg-surface rounded-lg px-md border border-border"
        >
          <Icon name="search" size={18} color={Colors.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            ref={searchInputRef}
            className="flex-1 py-sm text-text-primary text-md font-bevn-regular"
            placeholder={TEXT.searchPlaceholder}
            placeholderTextColor={Colors.text.muted}
            value={inbox.search}
            onChangeText={inbox.setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {Boolean(inbox.search) && (
            <TouchableOpacity onPress={() => inbox.setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </Pressable>
      </View>

      {/* Phòng chung — kênh chung toàn trung tâm, luôn ghim đầu danh sách (không lọc theo tìm kiếm) */}
      <View className="px-xl pb-sm">
        <TouchableOpacity
          className="flex-row items-center gap-md rounded-lg p-lg border border-[#D4FF0040] bg-[#D4FF0010]"
          onPress={() => router.push(ROUTES.chatThread(GENERAL_CHAT_ID, GENERAL_CHAT_TITLE))}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 rounded-full bg-[#D4FF0025] justify-center items-center">
            <Icon name="group" size={22} color={Colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-md font-bold font-bevn-bold text-text-primary">{GENERAL_CHAT_TITLE}</Text>
            <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>{TEXT.generalSubtitle}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      {inbox.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={inbox.rows}
          keyExtractor={(c) => c.user.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={inbox.refresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px] px-xl">
              <Icon name="chat-bubble-outline" size={52} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-sm">
                {inbox.search ? TEXT.noMatch : TEXT.noContacts}
              </Text>
              <Text className="text-sm text-text-muted font-bevn-regular text-center">
                {inbox.search ? TEXT.noMatchHint(inbox.search) : TEXT.noContactsHint}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className={clsx(
                'flex-row items-center gap-md rounded-lg p-lg border mb-sm',
                item.unreadCount > 0 ? 'border-[#D4FF0050] bg-bg-elevated' : 'bg-bg-surface border-border'
              )}
              onPress={() => router.push(ROUTES.chatThread(item.user.id, item.user.fullName))}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View className="w-12 h-12 rounded-full bg-bg-elevated justify-center items-center border-2" style={{ borderColor: CHAT_ROLE_COLOR[item.user.role] ?? Colors.border }}>
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
                  <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: (CHAT_ROLE_COLOR[item.user.role] ?? Colors.text.muted) + '25' }}>
                    <Text className="text-[10px] font-bevn-semibold" style={{ color: CHAT_ROLE_COLOR[item.user.role] ?? Colors.text.muted }}>
                      {CHAT_ROLE_LABEL[item.user.role] ?? item.user.role}
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
                  <Text className="text-sm text-text-muted font-bevn-regular" numberOfLines={1}>{TEXT.attachmentPreview}</Text>
                ) : (
                  <Text className="text-sm text-text-muted font-bevn-regular italic" numberOfLines={1}>{TEXT.startConversation}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
