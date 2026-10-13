import { vietnamDate } from '../../lib/date';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import clsx from 'clsx';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { useChatMessages, usePartnerName } from '../../hooks/shared/useChat';
import { GENERAL_CHAT_ID } from '../../services/chatService';
import { Colors } from '../../constants/theme';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';
import * as DocumentPicker from 'expo-document-picker';
import { CHAT_FILE_TYPES } from '../../services/chatService';
import { ProtectedAttachment } from '../../components/shared/ProtectedAttachment';
import { WorkflowState } from '../../components/shared/WorkflowScreen';
import { showAlert } from '../../lib/alert';

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(vietnamDate(d).getUTCHours())}:${pad2(vietnamDate(d).getUTCMinutes())}`;
}
function formatDateSep(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_LONG[vietnamDate(d).getUTCDay()]}, ${pad2(vietnamDate(d).getUTCDate())}/${pad2(vietnamDate(d).getUTCMonth() + 1)}`;
}
function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return vietnamDate(da).getUTCDate() === vietnamDate(db).getUTCDate() && vietnamDate(da).getUTCMonth() === vietnamDate(db).getUTCMonth() && vietnamDate(da).getUTCFullYear() === vietnamDate(db).getUTCFullYear();
}

export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset>();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const textRef = useRef('');

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const { messages, isLoading, handleSend, isGeneral, error, refetch } = useChatMessages(userId, user?.id);
  const partnerName = usePartnerName(userId, name);
  const headerTitle = isGeneral ? 'Phòng chung' : partnerName;

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => {
      setIsKeyboardOpen(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const onSend = async () => {
    const trimmed = textRef.current.trim();
    if ((!trimmed && !attachment) || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    Haptic.medium();
    try { await handleSend(trimmed, user, attachment); textRef.current = ''; setText(''); setAttachment(undefined); }
    catch (e) { showAlert('Không gửi được tin nhắn', e instanceof Error ? e.message : 'Vui lòng thử lại.'); }
    finally { sendingRef.current = false; setSending(false); }
  };

  const pickAttachment = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: CHAT_FILE_TYPES, copyToCacheDirectory: true, multiple: false });
      if (picked.canceled) return;
      const file = picked.assets[0];
      if (file.size != null && file.size > 10 * 1024 * 1024) { showAlert('Tệp quá lớn', 'Tệp tối đa 10 MB.'); return; }
      setAttachment(file);
    } catch (e) { showAlert('Không chọn được tệp', e instanceof Error ? e.message : 'Vui lòng thử lại.'); }
  };

  const handleBack = () => {
    Haptic.light();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(ROUTES.chat);
    }
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 6;

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      {/* Header */}
      <View
        className="flex-row items-center gap-md px-lg pb-md border-b border-border"
        style={{
          paddingTop: headerTopPadding,
          backgroundColor: Colors.bg.surface,
          zIndex: 10,
          elevation: 4,
        }}
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
            <Text className="text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>Không gian chung của trung tâm</Text>
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
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, item.createdAt);
            // Phòng chung có nhiều người gửi khác nhau — cần hiện tên để phân biệt,
            // khác với chat 1-1 chỉ có đúng 1 đối phương (partnerName cố định).
            const senderLabel = isGeneral ? (item.sender?.fullName ?? 'Người dùng') : partnerName;

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
              <Text className="text-md text-text-muted font-bevn-regular">Bắt đầu cuộc trò chuyện</Text>
            </View>
          }
        />
      )}

      {attachment && <View className="flex-row items-center justify-between px-lg py-sm bg-bg-surface"><Text className="text-text-primary text-sm font-bevn-regular flex-1" numberOfLines={1}>{attachment.name}</Text><TouchableOpacity disabled={sending} accessibilityRole="button" accessibilityLabel="Bỏ tệp đính kèm" onPress={() => setAttachment(undefined)}><Icon name="close" size={20} color={Colors.text.secondary} /></TouchableOpacity></View>}
      {/* Input */}
      <View
        className="flex-row items-end gap-sm px-lg py-md border-t border-border"
        style={{
          paddingBottom: isKeyboardOpen ? 12 : Math.max(insets.bottom, 12),
          backgroundColor: Colors.bg.surface,
        }}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chọn ảnh hoặc PDF" disabled={sending} className="p-sm" onPress={() => { void pickAttachment(); }}><Icon name="attach-file" size={22} color={Colors.primary} /></TouchableOpacity>
        <TextInput
          className="flex-1 bg-bg-elevated rounded-lg px-lg py-sm text-text-primary font-bevn-regular text-sm max-h-[100px] border border-border"
          value={text}
          editable={!sending}
          onChangeText={(val) => {
            setText(val);
            textRef.current = val;
          }}
          placeholder="Nhắn tin..."
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={1000}
          submitBehavior="submit"
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
          className={clsx('w-10 h-10 rounded-full justify-center items-center', text.trim() || attachment ? 'bg-primary' : 'bg-bg-elevated')}
          onPress={onSend}
          disabled={sending || (!text.trim() && !attachment)}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {sending ? <ActivityIndicator color={Colors.primary} /> : <Icon name="send" size={20} color={text.trim() || attachment ? Colors.text.inverse : Colors.text.muted} />}
        </TouchableOpacity>
      </View>
    </KeyboardAwareView>
  );
}
