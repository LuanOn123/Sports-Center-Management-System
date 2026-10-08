import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { useNotifications } from '../../hooks/shared/useNotifications';
import { Colors, Spacing } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import { resolveNotificationRoute } from '../../navigation/notificationRoute';
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
    Haptic.light();
    if (!item.isRead) markRead(item.id);
    const route = resolveNotificationRoute(item);
    if (route) router.push(route);
  };

  const handleMarkAllRead = () => {
    Haptic.medium();
    markAllRead();
  };

  const handleRefresh = () => {
    Haptic.light();
    refetch();
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title="Thông báo"
        subtitle="Cập nhật và tin tức từ trung tâm"
        rightAction={
          hasUnread ? (
            <TouchableOpacity
              className="px-sm py-1 rounded-full border border-primary"
              onPress={handleMarkAllRead}
              disabled={isMarkingAllRead}
              activeOpacity={0.7}
            >
              <Text className="text-xs text-primary font-bevn-semibold">Đọc hết</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Spacing.xl, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.primary} />}
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
