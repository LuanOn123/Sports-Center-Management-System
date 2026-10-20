// components/shared/NotificationBell.tsx
// Chuông thông báo trên header (lối vào duy nhất tới màn Thông báo) + số chưa đọc

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { ROUTES } from '../../navigation/routes';

export function NotificationBell() {
  const router = useRouter();
  const unread = useUnreadNotificationCount();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      onPress={() => router.push(ROUTES.notifications)}
      className="w-10 h-10 rounded-full bg-bg-surface border border-border justify-center items-center"
      activeOpacity={0.7}
    >
      <Icon name="notifications-none" size={22} color={Colors.text.primary} />
      {unread > 0 && (
        <View className="absolute -top-1 -right-1 bg-status-expired rounded-full min-w-[18px] h-[18px] justify-center items-center px-1 border-2 border-bg-primary">
          <Text className="text-[10px] font-bevn-bold text-white">{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
