import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type { ChatMessage } from '../../../lib/types';
import { useAuth } from '../../../context/AuthContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../constants/theme';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateSep(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
}
function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getDate() === db.getDate() && da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load initial history via REST
  const { isLoading, data } = useQuery({
    queryKey: ['chat-messages', userId],
    queryFn: () => api.get<ChatMessage[]>(`/chat/messages?targetId=${userId}`),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (data?.data) setMessages(data.data);
  }, [data]);

  // Mark messages as read when opening the screen
  useEffect(() => {
    if (!userId) return;
    api.patch('/chat/messages/read', { targetId: userId }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
  }, [userId, queryClient]);

  // Real-time: listen for new messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      // Only add if it belongs to this conversation
      if (
        (msg.senderId === userId && msg.receiverId === user?.id) ||
        (msg.senderId === user?.id && msg.receiverId === userId)
      ) {
        setMessages(prev => [...prev, msg]);
        // Auto-mark read since we're looking at the conversation
        api.patch('/chat/messages/read', { targetId: userId }).catch(() => {});
      }
    };

    const handleSent = (msg: ChatMessage) => {
      // Replace optimistic message or append confirmed one
      setMessages(prev => {
        const exists = prev.find(m => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSent', handleSent);
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSent', handleSent);
    };
  }, [userId, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Send via Socket.IO (primary) — fallback to REST
  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content || !user) return;
    setText('');

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('sendMessage', { senderId: user.id, receiverId: userId, content });
    } else {
      // REST fallback
      api.post('/chat/messages', { receiverId: userId, content }).then(res => {
        if (res.data) setMessages(prev => [...prev, res.data as ChatMessage]);
      }).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
  }, [text, user, userId, queryClient]);

  // Get partner name from conversations cache
  const convCache = queryClient.getQueryData<{ data: { user: { fullName: string } }[] }>(['chat-conversations']);
  const partnerName = convCache?.data?.find(c => c.user.id === userId)?.user.fullName ?? 'Người dùng';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{partnerName[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} size="large" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, item.createdAt);

            return (
              <View>
                {showDateSep && (
                  <View style={styles.dateSep}>
                    <Text style={styles.dateSepText}>{formatDateSep(item.createdAt)}</Text>
                  </View>
                )}
                <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                  {!isMine && (
                    <View style={styles.msgAvatar}>
                      <Text style={styles.msgAvatarText}>{partnerName[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                    {item.content ? (
                      <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                    ) : null}
                    {item.fileUrl ? (
                      <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>📎 Tệp đính kèm</Text>
                    ) : null}
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.createdAt)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <MaterialIcons name="chat" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyChatText}>Bắt đầu cuộc trò chuyện</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nhắn tin..."
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <MaterialIcons name="send" size={20} color={text.trim() ? Colors.text.inverse : Colors.text.muted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 54 : Spacing.xl,
    paddingBottom: Spacing.md, backgroundColor: Colors.bg.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '25', justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },

  // Messages
  messagesList: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  dateSep: { alignItems: 'center', marginVertical: Spacing.lg },
  dateSepText: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', backgroundColor: Colors.bg.elevated, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.sm, gap: Spacing.sm },
  messageRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  msgAvatarText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_700Bold' },
  bubble: { maxWidth: '75%', borderRadius: Radius.lg, padding: Spacing.md, paddingVertical: Spacing.sm },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: Radius.sm },
  bubbleOther: { backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: Radius.sm },
  bubbleText: { fontSize: FontSize.sm, color: Colors.text.primary, fontFamily: 'BeVietnamPro_400Regular' },
  bubbleTextMine: { color: Colors.text.inverse },
  bubbleTime: { fontSize: 10, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: Colors.text.inverse + 'AA' },

  // Empty
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: FontSize.md, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    backgroundColor: Colors.bg.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, color: Colors.text.primary, fontFamily: 'BeVietnamPro_400Regular',
    fontSize: FontSize.sm, maxHeight: 100, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.bg.elevated },
});
