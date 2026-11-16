// components/notifications/NotificationsView.tsx
// Màn Thông báo (web: Notifications): số chưa đọc, "Chỉ xem chưa đọc", "đánh dấu tất cả đã đọc", danh sách phân trang
// (kéo xuống cuối tải tiếp). Logic ở hooks/shared/useNotificationsScreen; thẻ ở NotificationCard.

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Icon } from '../shared/Icon';
import { FilterChip } from '../shared/FilterChip';
import { ScreenHeader } from '../shared/ScreenHeader';
import { WorkflowState } from '../shared/WorkflowScreen';
import { NotificationCard } from './NotificationCard';
import { useNotificationsScreen } from '../../hooks/shared/useNotificationsScreen';
import { NOTIFICATION_TEXT as TEXT } from '../../constants/notifications';
import { Colors, Spacing } from '../../constants/theme';

/** Cách đáy danh sách còn chừng này (theo bề cao danh sách) thì bắt đầu tải trang kế */
const LOAD_MORE_THRESHOLD = 0.4;

export function NotificationsView() {
  const n = useNotificationsScreen();

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title={TEXT.title}
        rightAction={
          // Nút icon vừa ô 40×40 của header (nút chữ cũ bị bóp méo)
          n.canMarkAll ? (
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
      <View className="flex-row items-center justify-between gap-md px-xl pt-md">
        <Text className="flex-1 text-sm text-text-secondary font-bevn-medium" numberOfLines={1}>{n.subtitle}</Text>
        <FilterChip label={TEXT.unreadOnly} active={n.unreadOnly} onPress={n.toggleUnreadOnly} />
      </View>

      {n.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={n.notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={n.refresh} tintColor={Colors.primary} />}
          onEndReached={n.loadMore}
          onEndReachedThreshold={LOAD_MORE_THRESHOLD}
          ListHeaderComponent={n.error ? <WorkflowState error={n.error} retry={n.refresh} /> : undefined}
          ListEmptyComponent={
            n.error ? undefined : (
              <View className="items-center mt-[60px] px-xl">
                <Icon name="notifications-none" size={52} color={Colors.text.muted} style={{ marginBottom: 12 }} />
                <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-sm">{n.unreadOnly ? TEXT.emptyUnreadTitle : TEXT.emptyTitle}</Text>
                <Text className="text-sm text-text-muted font-bevn-regular text-center">{n.unreadOnly ? TEXT.emptyUnreadHint : TEXT.emptyHint}</Text>
              </View>
            )
          }
          ListFooterComponent={n.isFetchingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} /> : undefined}
          renderItem={({ item }) => <NotificationCard item={item} actionLabel={n.actionLabelOf(item)} onOpen={n.open} />}
        />
      )}
    </View>
  );
}
