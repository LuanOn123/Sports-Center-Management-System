// app/(tabs)/_layout.tsx
// Bottom Tab Bar theo vai trò (navigation/tabConfig.ts) — 5 tab hiện, các màn con ẩn khỏi thanh

import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatTabIcon, TabIcon } from '../../components/shared/TabBarIcons';
import { Colors } from '../../constants/theme';
import { TAB_BAR } from '../../constants/tabBar';
import { useAuth } from '../../context/AuthContext';
import { useKeyboardVisible } from '../../hooks/shared/useKeyboardVisible';
import { Haptic } from '../../lib/haptics';
import { canAccessRoute, getTabConfigForRole } from '../../navigation';

export default function TabLayout() {
  const { user } = useAuth();
  const tabs = getTabConfigForRole(user?.role);
  const isKeyboardVisible = useKeyboardVisible();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom;
  const tabHeight = TAB_BAR.baseHeight + bottomInset;

  return (
    <Tabs
      // Quay lại theo lịch sử: Tài khoản → Thông tin cá nhân → (back) về Tài khoản, không nhảy về Trang chủ
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,   // Android: hides natively
        tabBarStyle: isKeyboardVisible
          ? { display: 'none' }        // iOS: hide when keyboard shows
          : {
          backgroundColor: Colors.bg.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: Math.max(bottomInset, TAB_BAR.minBottomPadding),
          paddingTop: TAB_BAR.paddingTop,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: TAB_BAR.labelSize,
          fontFamily: TAB_BAR.labelFont,
          lineHeight: TAB_BAR.labelLineHeight,
          marginTop: TAB_BAR.labelGap,
        },
      }}
    >
      {tabs.map((tab) => (
        // Tab chỉ dành cho một vai trò (Lớp của tôi: hội viên, Điểm danh: HLV) theo cùng bảng với canAccessRoute
        <Tabs.Protected key={tab.name} guard={canAccessRoute(user?.role, ['(tabs)', tab.name])}>
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          listeners={{
            tabPress: () => {
              Haptic.selection();
            },
          }}
          options={{
            title: tab.title,
            // Tab không có nút trên thanh (Lớp của tôi, Điểm danh của hội viên…) vẫn nằm trong Tabs.
            // Expo Router 58 đổi `href: null` thành `hidden: true` = KHÔNG điều hướng tới được (tự chuyển về Trang chủ),
            // nên thu gọn khung của nút (display: none): màn vẫn mở được qua router.push mà không chiếm chỗ trên thanh tab.
            ...(tab.visible ? {} : { tabBarItemStyle: { display: 'none' as const } }),
            // Tab chứa Stack bên trong (Tài khoản): rời tab thì về màn đầu, quay lại luôn thấy menu thay vì màn con đang mở dở
            ...(tab.popToTopOnBlur ? { popToTopOnBlur: true } : {}),
            tabBarIcon: ({ color }) =>
              tab.isChat ? (
                <ChatTabIcon color={color} />
              ) : (
                <TabIcon name={tab.iconName} color={color} />
              ),
          }}
        />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
