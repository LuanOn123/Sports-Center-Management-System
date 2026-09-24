import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { useNotifications } from '../../hooks/shared/useNotifications';
import { Colors } from '../../constants/theme';
import type { AppNotification, NotificationType } from '../../lib/types';

const TYPE_ICON: Record<NotificationType, React.ComponentProps<typeof Icon>['name']> = {
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
  ATTENDANCE_WARNING: 'warning',
  ATTENDANCE_PENALTY: 'cancel',
  ATTENDANCE_PENALTY_REVOKED: 'check-circle',
  SCHEDULE_ROOM_CHANGED: 'place',
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
    case 'SCHEDULE_UPDATED':
    case 'SCHEDULE_ROOM_CHANGED': {
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
    // Cảnh báo/hình phạt chuyên cần — mở màn "Chuyên cần & Điểm danh" của Member
    case 'ATTENDANCE_WARNING':
    case 'ATTENDANCE_PENALTY':
    case 'ATTENDANCE_PENALTY_REVOKED':
      return '/attendance/my';
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
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className={clsx('flex-row items-start gap-md p-xl pb-md', Platform.OS === 'ios' ? 'pt-[56px]' : 'pt-xl')}>
        <View className="flex-1">
          <Text className="text-xxl font-bold font-bevn-bold text-text-primary">Thông Báo</Text>
          <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Cập nhật từ trung tâm</Text>
        </View>
        {hasUnread && (
          <TouchableOpacity
            className="px-md py-sm rounded-full border border-primary"
            onPress={() => markAllRead()}
            disabled={isMarkingAllRead}
          >
            <Text className="text-xs text-primary font-bevn-semibold">Đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px] px-xl">
              <Icon name="notifications-none" size={52} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-sm">Chưa có thông báo</Text>
              <Text className="text-sm text-text-muted font-bevn-regular text-center">Thông báo về lịch học, gói tập và tin nhắn sẽ xuất hiện ở đây</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className={clsx(
                'flex-row gap-md rounded-lg p-lg border mb-sm',
                !item.isRead ? 'border-[#A3E63550] bg-bg-elevated' : 'bg-bg-surface border-border'
              )}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View className={clsx('w-10 h-10 rounded-lg justify-center items-center', !item.isRead ? 'bg-[#A3E63520]' : 'bg-bg-elevated')}>
                <Icon name={TYPE_ICON[item.type] ?? 'notifications'} size={20} color={Colors.primary} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-sm">
                  <Text
                    className={clsx('flex-1 text-sm text-text-primary', !item.isRead ? 'font-bevn-bold' : 'font-semibold font-bevn-semibold')}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {!item.isRead && <View className="w-2 h-2 rounded-full bg-primary" />}
                </View>
                <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular" numberOfLines={2}>{item.body}</Text>
                <Text className="text-[10px] text-text-muted mt-1 font-bevn-regular">{timeAgo(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
