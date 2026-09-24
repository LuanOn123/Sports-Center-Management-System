// app/(tabs)/_layout.tsx
// Quản lý điều hướng Bottom Tab Bar theo cấu hình phân quyền vai trò

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text } from 'react-native';
import { Icon } from '../../components/shared/Icon';
import { Colors } from '../../constants/theme';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { getTabConfigForRole, type MaterialIconName } from '../../navigation';

function TabIcon({ name, color }: { name: MaterialIconName; color: string | any }) {
  return <Icon name={name} size={20} color={String(color)} />;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View className="absolute -top-1 -right-2 bg-status-expired rounded-full min-w-[16px] h-4 justify-center items-center px-[3px] border-[1.5px] border-bg-surface">
      <Text className="text-[9px] font-bevn-bold text-white leading-[13px]">{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

function ChatTabIcon({ color }: { color: string | any }) {
  const { data } = useQuery({
    queryKey: ['chat-unread-count'],
    // BE trả { unreadCount }, không phải số trần
    queryFn: () => api.get<{ unreadCount: number }>('/chat/messages/unread-count'),
    refetchInterval: 30_000,
  });

  return (
    <View className="relative">
      <Icon name="chat" size={20} color={String(color)} />
      <Badge count={data?.data?.unreadCount ?? 0} />
    </View>
  );
}

function NotificationsTabIcon({ color }: { color: string | any }) {
  const count = useUnreadNotificationCount();

  return (
    <View className="relative">
      <Icon name="notifications" size={20} color={String(color)} />
      <Badge count={count} />
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const tabs = getTabConfigForRole(user?.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Config của react-navigation, không phải JSX — không đổi được sang className.
        tabBarStyle: {
          backgroundColor: Colors.bg.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 72,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: 'BeVietnamPro_500Medium',
          lineHeight: 14,
          padding: 0,
          margin: 0,
        },
        tabBarIconStyle: {
          marginBottom: 1,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.visible ? undefined : null,
            tabBarIcon: ({ color }) =>
              tab.isChat ? (
                <ChatTabIcon color={color} />
              ) : tab.isNotifications ? (
                <NotificationsTabIcon color={color} />
              ) : (
                <TabIcon name={tab.iconName} color={color} />
              ),
          }}
        />
      ))}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
