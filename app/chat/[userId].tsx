import React, { useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import clsx from 'clsx';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { useChatMessages, usePartnerName } from '../../hooks/shared/useChat';
import { Colors } from '../../constants/theme';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDateSep(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_LONG[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getDate() === db.getDate() && da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
}

export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState('');
  const textRef = useRef('');

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const { messages, isLoading, handleSend } = useChatMessages(userId, user?.id);
  const partnerName = usePartnerName(userId, name);

  const onSend = () => {
    // Dùng textRef để tránh gửi trùng nếu onSend bị gọi liên tiếp
    const trimmed = textRef.current.trim();
    if (!trimmed) return;
    textRef.current = '';
    setText('');
    handleSend(trimmed, user);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/chat');
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className={clsx('flex-row items-center gap-md px-lg pb-md bg-bg-surface border-b border-border', Platform.OS === 'ios' ? 'pt-[54px]' : 'pt-xl')}>
        <TouchableOpacity className="p-1" onPress={handleBack}>
          <Icon name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View className="w-9 h-9 rounded-full bg-[#A3E63525] justify-center items-center">
          <Text className="text-md font-bold font-bevn-bold text-primary">{partnerName[0]?.toUpperCase()}</Text>
        </View>
        <Text className="flex-1 text-md font-bold font-bevn-bold text-text-primary" numberOfLines={1}>{partnerName}</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} size="large" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, item.createdAt);

            return (
              <View>
                {showDateSep && (
                  <View className="items-center my-lg">
                    <Text className="text-xs text-text-muted font-bevn-regular bg-bg-elevated px-md py-1 rounded-full">{formatDateSep(item.createdAt)}</Text>
                  </View>
                )}
                <View className={clsx('flex-row items-end mb-sm gap-sm', isMine && 'flex-row-reverse')}>
                  {!isMine && (
                    <View className="w-7 h-7 rounded-full bg-bg-elevated justify-center items-center mb-0.5">
                      <Text className="text-xs font-bold font-bevn-bold text-text-secondary">{partnerName[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View
                    className={clsx(
                      'max-w-[75%] rounded-lg p-md py-sm',
                      isMine ? 'bg-primary rounded-br-sm' : 'bg-bg-surface border border-border rounded-bl-sm'
                    )}
                  >
                    {item.content ? (
                      <Text className={clsx('text-sm font-bevn-regular', isMine ? 'text-text-inverse' : 'text-text-primary')}>{item.content}</Text>
                    ) : null}
                    {item.fileUrl ? (
                      <Text className={clsx('text-sm font-bevn-regular', isMine ? 'text-text-inverse' : 'text-text-primary')}>📎 Tệp đính kèm</Text>
                    ) : null}
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
              <Text className="text-md text-text-muted font-bevn-regular">Bắt đầu cuộc trò chuyện</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View className={clsx('flex-row items-end gap-sm px-lg py-md bg-bg-surface border-t border-border', Platform.OS === 'ios' ? 'pb-8' : 'pb-md')}>
        <TextInput
          className="flex-1 bg-bg-elevated rounded-lg px-lg py-sm text-text-primary font-bevn-regular text-sm max-h-[100px] border border-border"
          value={text}
          onChangeText={(val) => {
            setText(val);
            textRef.current = val;
          }}
          placeholder="Nhắn tin..."
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={onSend}
          onKeyPress={(e) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !(e.nativeEvent as any).shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <TouchableOpacity
          className={clsx('w-10 h-10 rounded-full justify-center items-center', text.trim() ? 'bg-primary' : 'bg-bg-elevated')}
          onPress={onSend}
          disabled={!text.trim()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="send" size={20} color={text.trim() ? Colors.text.inverse : Colors.text.muted} />
        </TouchableOpacity>
      </View>
    </KeyboardAwareView>
  );
}
