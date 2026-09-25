// app/(tabs)/_layout.tsx
// Quản lý điều hướng Bottom Tab Bar: Trang chủ, Tin nhắn, Hồ sơ

import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, Keyboard } from 'react-native';
import { Icon } from '../../components/shared/Icon';
import { Colors } from '../../constants/theme';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { getTabConfigForRole, type MaterialIconName } from '../../navigation';

function TabIcon({ name, color }: { name: MaterialIconName; color: string | any }) {
  return <Icon name={name} size={22} color={String(color)} />;
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
      <Icon name="chat" size={22} color={String(color)} />
      <Badge count={data?.data?.unreadCount ?? 0} />
    </View>
  );
}

function NotificationsTabIcon({ color }: { color: string | any }) {
  const count = useUnreadNotificationCount();

  return (
    <View className="relative">
      <Icon name="notifications" size={22} color={String(color)} />
      <Badge count={count} />
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const tabs = getTabConfigForRole(user?.role);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) {
          setKeyboardVisible(true);
        }
      };
      const handleFocusOut = () => {
        setKeyboardVisible(false);
      };
      window.addEventListener('focusin', handleFocusIn);
      window.addEventListener('focusout', handleFocusOut);
      return () => {
        window.removeEventListener('focusin', handleFocusIn);
        window.removeEventListener('focusout', handleFocusOut);
      };
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,   // Android: hides natively
        tabBarStyle: isKeyboardVisible
          ? { display: 'none' }        // iOS: hide when keyboard shows
          : {
          backgroundColor: Colors.bg.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'BeVietnamPro_500Medium',
          lineHeight: 15,
          marginTop: 2,
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
    </Tabs>
  );
}
