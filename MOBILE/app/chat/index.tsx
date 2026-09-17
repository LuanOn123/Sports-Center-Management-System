import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { ChatConversation, ChatMessage } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

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

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [newMessageFrom, setNewMessageFrom] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => api.get<ChatConversation[]>('/chat/conversations'),
  });

  const conversations = data?.data ?? [];

  // Real-time: update badge when a new message arrives from anyone
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.senderId !== user?.id) {
        setNewMessageFrom(msg.senderId);
        refetch();
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => { socket.off('newMessage', handleNewMessage); };
  }, [user?.id, refetch]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhắn Tin</Text>
        <Text style={styles.headerSub}>Liên lạc với huấn luyện viên & đội ngũ</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.user.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="chat-bubble-outline" size={52} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
              <Text style={styles.emptyText}>Nhắn tin với huấn luyện viên để bắt đầu</Text>
              <TouchableOpacity
                style={styles.newChatBtn}
                onPress={() => router.push('/chat/contacts' as any)}
              >
                <MaterialIcons name="add" size={18} color={Colors.text.inverse} />
                <Text style={styles.newChatBtnText}>Tìm người để nhắn</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            conversations.length > 0 ? (
              <TouchableOpacity
                style={styles.newContactBtn}
                onPress={() => router.push('/chat/contacts' as any)}
              >
                <MaterialIcons name="person-add" size={18} color={Colors.primary} />
                <Text style={styles.newContactText}>Nhắn tin mới</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.convCard, item.unreadCount > 0 && styles.convCardUnread]}
              onPress={() => router.push(`/chat/${item.user.id}` as any)}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View style={[styles.avatar, { borderColor: ROLE_COLOR[item.user.role] ?? Colors.border }]}>
                <Text style={styles.avatarText}>{item.user.fullName[0]?.toUpperCase()}</Text>
              </View>

              {/* Content */}
              <View style={styles.convContent}>
                <View style={styles.convTopRow}>
                  <Text style={styles.convName} numberOfLines={1}>{item.user.fullName}</Text>
                  {item.latestMessage && (
                    <Text style={styles.convTime}>{timeAgo(item.latestMessage.createdAt)}</Text>
                  )}
                </View>
                <View style={styles.convBottomRow}>
                  <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLOR[item.user.role] ?? Colors.text.muted) + '25' }]}>
                    <Text style={[styles.roleText, { color: ROLE_COLOR[item.user.role] ?? Colors.text.muted }]}>
                      {ROLE_LABEL[item.user.role] ?? item.user.role}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
                {item.latestMessage?.content ? (
                  <Text style={[styles.convPreview, item.unreadCount > 0 && styles.convPreviewBold]} numberOfLines={1}>
                    {item.latestMessage.content}
                  </Text>
                ) : item.latestMessage?.fileUrl ? (
                  <Text style={styles.convPreview} numberOfLines={1}>📎 Tệp đính kèm</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : Spacing.xl },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center', marginBottom: Spacing.xl },

  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  newChatBtnText: { fontSize: FontSize.sm, color: Colors.text.inverse, fontFamily: 'BeVietnamPro_700Bold' },
  newContactBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, alignSelf: 'flex-start' },
  newContactText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },

  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  convCardUnread: { borderColor: Colors.primary + '50', backgroundColor: Colors.bg.elevated },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  convContent: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', flex: 1 },
  convTime: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', marginLeft: 8 },
  convBottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  roleText: { fontSize: 10, fontFamily: 'BeVietnamPro_600SemiBold' },
  unreadBadge: { backgroundColor: Colors.primary, borderRadius: Radius.full, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.text.inverse, fontFamily: 'BeVietnamPro_700Bold' },
  convPreview: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
  convPreviewBold: { color: Colors.text.secondary, fontFamily: 'BeVietnamPro_600SemiBold' },
});
