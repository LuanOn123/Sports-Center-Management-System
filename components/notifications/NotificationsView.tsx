// components/notifications/NotificationsView.tsx
// Màn Thông báo (web: Notifications): danh sách thông báo, chưa đọc nổi bật, "đánh dấu tất cả đã đọc".
// Logic ở hooks/shared/useNotificationsScreen; biểu tượng theo loại ở constants/notifications.

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import { ScreenHeader } from '../shared/ScreenHeader';
import { useNotificationsScreen } from '../../hooks/shared/useNotificationsScreen';
import { NOTIFICATION_FALLBACK_ICON, NOTIFICATION_TEXT as TEXT, NOTIFICATION_TYPE_ICON } from '../../constants/notifications';
import { Colors, Spacing } from '../../constants/theme';
import { timeAgo } from '../../lib/format';

export function NotificationsView() {
  const n = useNotificationsScreen();

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title={TEXT.title}
        rightAction={
          // Nút icon vừa ô 40×40 của header (nút chữ cũ bị bóp méo)
          n.hasUnread ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={TEXT.markAllRead}
              className="w-10 h-10 rounded-full items-center justify-center bg-bg-elevated"
              onPress={n.markAll}
              disabled={n.isMarkingAllRead}
              activeOpacity={0.7}
            >
              {n.isMarkingAllRead ? <ActivityIndicator size="small" color={Colors.primary} /> : <Icon name="done-all" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          ) : undefined
        }
      />
      {n.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={n.notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Spacing.xl, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={n.refresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px] px-xl">
              <Icon name="notifications-none" size={52} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-sm">{TEXT.emptyTitle}</Text>
              <Text className="text-sm text-text-muted font-bevn-regular text-center">{TEXT.emptyHint}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className={clsx(
                'flex-row gap-md rounded-lg p-lg border mb-sm',
                !item.isRead ? 'border-[#D4FF0050] bg-bg-elevated' : 'bg-bg-surface border-border'
              )}
              onPress={() => n.open(item)}
              activeOpacity={0.7}
            >
              <View className={clsx('w-10 h-10 rounded-lg justify-center items-center', !item.isRead ? 'bg-[#D4FF0020]' : 'bg-bg-elevated')}>
                <Icon name={NOTIFICATION_TYPE_ICON[item.type] ?? NOTIFICATION_FALLBACK_ICON} size={20} color={Colors.primary} />
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
