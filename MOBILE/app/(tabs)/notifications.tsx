import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon as MaterialIcons } from '../../components/shared/Icon';
import { useNotifications } from '../../hooks/shared/useNotifications';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import type { AppNotification, NotificationType } from '../../lib/types';

const TYPE_ICON: Record<NotificationType, React.ComponentProps<typeof MaterialIcons>['name']> = {
  MEMBER_REGISTERED: 'person-add',
  CHAT_MESSAGE: 'chat',
  SUBSCRIPTION_EXPIRING: 'alarm',
  SUBSCRIPTION_EXPIRED: 'alarm-off',
  SUBSCRIPTION_CANCELLED: 'cancel',
  UPCOMING_CLASS: 'event',
  SCHEDULE_CANCELLED: 'event-busy',
  SCHEDULE_UPDATED: 'update',
  ENROLLMENT_CONFIRMED: 'check-circle',
  ENROLLMENT_CANCELLED: 'remove-circle-outline',
  TRAINING_PLAN_ASSIGNED: 'fitness-center',
  NEW_CLASS: 'fiber-new',
  COACH_CHANGED: 'swap-horiz',
  PAYMENT_SUCCESS: 'payments',
  PAYMENT_REFUNDED: 'currency-exchange',
  GENERAL: 'notifications',
};

function metaString(item: AppNotification, key: string): string | undefined {
  const v = item.metadata?.[key];
  return typeof v === 'string' ? v : undefined;
}

/** Suy ra trang cần mở khi bấm vào 1 thông báo — tin nhắn mở đúng đoạn chat, lớp học mở đúng buổi/lớp */
function resolveNotificationRoute(item: AppNotification): string | null {
  switch (item.type) {
    case 'CHAT_MESSAGE': {
      const senderId = metaString(item, 'senderId');
      return senderId ? `/chat/${senderId}` : null;
    }
    case 'UPCOMING_CLASS':
    case 'ENROLLMENT_CONFIRMED':
    case 'ENROLLMENT_CANCELLED':
    case 'SCHEDULE_CANCELLED':
    case 'SCHEDULE_UPDATED': {
      const scheduleId = metaString(item, 'scheduleId');
      if (scheduleId) return `/schedule/${scheduleId}`;
      const classId = metaString(item, 'classId');
      return classId ? `/classes/${classId}` : null;
    }
    case 'NEW_CLASS':
    case 'COACH_CHANGED': {
      const classId = metaString(item, 'classId');
      return classId ? `/classes/${classId}` : null;
    }
    // Chưa có màn hình xem kế hoạch tập cho Member (tab "Tập luyện" đã bị bỏ) —
    // chỉ đánh dấu đã đọc, không có trang nào để mở.
    case 'TRAINING_PLAN_ASSIGNED':
    default:
      return null;
  }
}

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

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, isLoading, refetch, markRead, markAllRead, isMarkingAllRead } = useNotifications();
  const hasUnread = notifications.some((n) => !n.isRead);

  const handlePress = (item: AppNotification) => {
    if (!item.isRead) markRead(item.id);
    const route = resolveNotificationRoute(item);
    if (route) router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Thông Báo</Text>
          <Text style={styles.headerSub}>Cập nhật từ trung tâm</Text>
        </View>
        {hasUnread && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAllRead()}
            disabled={isMarkingAllRead}
          >
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="notifications-none" size={52} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptyText}>Thông báo về lịch học, gói tập và tin nhắn sẽ xuất hiện ở đây</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.cardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
                <MaterialIcons name={TYPE_ICON[item.type] ?? 'notifications'} size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    padding: Spacing.xl, paddingBottom: Spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : Spacing.xl,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  markAllBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary },
  markAllText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center' },

  card: {
    flexDirection: 'row', gap: Spacing.md,
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  cardUnread: { borderColor: Colors.primary + '50', backgroundColor: Colors.bg.elevated },
  icon: { width: 40, height: 40, borderRadius: Radius.lg, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  iconUnread: { backgroundColor: Colors.primary + '20' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  cardTitleUnread: { fontFamily: 'BeVietnamPro_700Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  cardBody: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  cardTime: { fontSize: 10, color: Colors.text.muted, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
});
