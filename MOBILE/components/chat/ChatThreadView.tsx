// components/chat/ChatThreadView.tsx
// Một cuộc trò chuyện (web: Chat → Conversation): danh sách tin có vạch ngày, ô soạn tin + đính kèm. "general" là Phòng chung.
// Logic ở hooks/shared/useChat (tin nhắn, socket) và hooks/shared/useChatComposer (ô soạn).

import React, { useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../shared/Icon';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { ProtectedAttachment } from '../shared/ProtectedAttachment';
import { WorkflowState } from '../shared/WorkflowScreen';
import { useAuth } from '../../context/AuthContext';
import { useChatMessages, usePartnerName } from '../../hooks/shared/useChat';
import { useChatComposer } from '../../hooks/shared/useChatComposer';
import { useKeyboard } from '../../hooks/shared/useKeyboard';
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_TEXT as TEXT, GENERAL_CHAT_TITLE } from '../../constants/chat';
import { Colors } from '../../constants/theme';
import { formatDateSeparator, formatTime, isSameVietnamDay } from '../../lib/format';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

/** Chờ bàn phím / danh sách dựng xong rồi mới cuộn xuống tin mới nhất */
const SCROLL_DELAY_MS = 100;

export function ChatThreadView({ userId, name }: { userId: string; name?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const keyboard = useKeyboard();

  const { messages, isLoading, handleSend, isGeneral, error, refetch } = useChatMessages(userId, user?.id);
  const partnerName = usePartnerName(userId, name);
  const composer = useChatComposer(handleSend, user);
  const headerTitle = isGeneral ? GENERAL_CHAT_TITLE : partnerName;

  // Mở xong thì nhảy tới tin mới nhất; bàn phím bật lên thì cuộn tiếp để ô soạn không che tin cuối
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), SCROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [isLoading]);
  useEffect(() => {
    if (!keyboard.visible) return;
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), SCROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [keyboard.visible]);

  const handleBack = () => {
    Haptic.light();
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.chat);
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 6;
  const hasContent = Boolean(composer.text.trim() || composer.attachment);

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      {/* Header */}
      <View
        className="flex-row items-center gap-md px-lg pb-md border-b border-border"
        style={{ paddingTop: headerTopPadding, backgroundColor: Colors.bg.surface, zIndex: 10, elevation: 4 }}
      >
        <TouchableOpacity className="p-1" onPress={handleBack} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View className="w-9 h-9 rounded-full bg-[#D4FF0025] justify-center items-center">
          {isGeneral ? (
            <Icon name="group" size={18} color={Colors.primary} />
          ) : (
            <Text className="text-md font-bold font-bevn-bold text-primary">{partnerName[0]?.toUpperCase()}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-md font-bold font-bevn-bold text-text-primary" numberOfLines={1}>{headerTitle}</Text>
          {isGeneral && (
            <Text className="text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>{TEXT.generalThreadSubtitle}</Text>
          )}
        </View>
      </View>

      <WorkflowState error={error} retry={() => { void refetch(); }} />
      {/* Messages */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} size="large" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateSep = !prevMsg || !isSameVietnamDay(prevMsg.createdAt, item.createdAt);
            // Phòng chung có nhiều người gửi khác nhau — cần hiện tên để phân biệt,
            // khác với chat 1-1 chỉ có đúng 1 đối phương (partnerName cố định).
            const senderLabel = isGeneral ? (item.sender?.fullName ?? TEXT.unknownUser) : partnerName;

            return (
              <View>
                {showDateSep && (
                  <View className="items-center my-lg">
                    <Text className="text-xs text-text-muted font-bevn-regular bg-bg-elevated px-md py-1 rounded-full">{formatDateSeparator(item.createdAt)}</Text>
                  </View>
                )}
                <View className={clsx('flex-row items-end mb-sm gap-sm', isMine && 'flex-row-reverse')}>
                  {!isMine && (
                    <View className="w-7 h-7 rounded-full bg-bg-elevated justify-center items-center mb-0.5">
                      <Text className="text-xs font-bold font-bevn-bold text-text-secondary">{senderLabel[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View
                    className={clsx(
                      'max-w-[75%] rounded-lg p-md py-sm',
                      isMine ? 'bg-primary rounded-br-sm' : 'bg-bg-surface border border-border rounded-bl-sm'
                    )}
                  >
                    {isGeneral && !isMine && (
                      <Text className="text-xs font-bevn-semibold text-primary mb-0.5">{senderLabel}</Text>
                    )}
                    {item.content ? (
                      <Text className={clsx('text-sm font-bevn-regular', isMine ? 'text-text-inverse' : 'text-text-primary')}>{item.content}</Text>
                    ) : null}
                    {item.fileUrl ? <ProtectedAttachment url={item.fileUrl} /> : null}

                    <Text
                      className="text-[10px] font-bevn-regular mt-1 self-end"
                      style={{ color: isMine ? Colors.text.inverse + 'AA' : Colors.text.muted }}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Icon name="chat" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-md text-text-muted font-bevn-regular">{TEXT.threadEmpty}</Text>
            </View>
          }
        />
      )}

      {composer.attachment && (
        <View className="flex-row items-center justify-between px-lg py-sm bg-bg-surface">
          <Text className="text-text-primary text-sm font-bevn-regular flex-1" numberOfLines={1}>{composer.attachment.name}</Text>
          <TouchableOpacity disabled={composer.sending} accessibilityRole="button" accessibilityLabel={TEXT.removeAttachment} onPress={composer.removeAttachment}>
            <Icon name="close" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
      {/* Input */}
      <View
        className="flex-row items-end gap-sm px-lg py-md border-t border-border"
        style={{ paddingBottom: keyboard.visible ? 12 : Math.max(insets.bottom, 12), backgroundColor: Colors.bg.surface }}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={TEXT.attachLabel} disabled={composer.sending} className="p-sm" onPress={() => { void composer.pickAttachment(); }}>
          <Icon name="attach-file" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TextInput
          className="flex-1 bg-bg-elevated rounded-lg px-lg py-sm text-text-primary font-bevn-regular text-sm max-h-[100px] border border-border"
          value={composer.text}
          editable={!composer.sending}
          onChangeText={composer.changeText}
          placeholder={TEXT.composerPlaceholder}
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={() => { void composer.submit(); }}
          onKeyPress={(e) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as { shiftKey?: boolean }).shiftKey) {
              e.preventDefault();
              void composer.submit();
            }
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={TEXT.send}
          className={clsx('w-10 h-10 rounded-full justify-center items-center', hasContent ? 'bg-primary' : 'bg-bg-elevated')}
          onPress={() => { void composer.submit(); }}
          disabled={composer.sending || !composer.canSend}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {composer.sending ? <ActivityIndicator color={Colors.primary} /> : <Icon name="send" size={20} color={hasContent ? Colors.text.inverse : Colors.text.muted} />}
        </TouchableOpacity>
      </View>
    </KeyboardAwareView>
  );
}
