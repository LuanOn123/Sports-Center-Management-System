// components/shared/ScreenHeader.tsx
// Header màn hình, 2 kiểu — CHỈ có tiêu đề, không có dòng chữ phụ bên dưới:
// - 'tab'  : màn gốc của tab — tiêu đề lớn căn trái, không có nút quay lại, mặc định có chuông thông báo
// - 'stack': màn con — nút quay lại + tiêu đề giữa (mặc định)

import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';
import { Colors } from '../../constants/theme';
import { ROUTES } from '../../navigation/routes';

interface ScreenHeaderProps {
  title: string;
  variant?: 'stack' | 'tab';
  showBack?: boolean;
  onBackPress?: () => void;
  /** Nút bên phải; kiểu 'tab' mặc định là chuông thông báo (truyền null để ẩn) */
  rightAction?: ReactNode;
}

export function ScreenHeader({
  title,
  variant = 'stack',
  showBack = true,
  onBackPress,
  rightAction,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 6;

  if (variant === 'tab') {
    const right = rightAction === undefined ? <NotificationBell /> : rightAction;
    return (
      <View className="flex-row items-center justify-between px-xl pb-md bg-bg-primary" style={{ paddingTop: topPadding }}>
        <Text className="flex-1 mr-md text-xxl font-bevn-bold text-text-primary" numberOfLines={1}>{title}</Text>
        {right}
      </View>
    );
  }

  const handleBack = () => {
    if (onBackPress) onBackPress();
    else if (router.canGoBack()) router.back();
    else router.replace(ROUTES.home);
  };

  return (
    <View
      className="flex-row justify-between items-center px-md pb-sm border-b border-border"
      style={{ paddingTop: topPadding, backgroundColor: Colors.bg.surface, zIndex: 50, elevation: 4 }}
    >
      {showBack ? (
        <TouchableOpacity className="w-10 h-10 justify-center items-center rounded-full" onPress={handleBack} activeOpacity={0.7} accessibilityLabel="Quay lại">
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      ) : (
        <View className="w-10 h-10" />
      )}

      <View className="flex-1 items-center px-xs">
        <Text className="text-lg font-bevn-bold text-text-primary text-center" numberOfLines={1}>{title}</Text>
      </View>

      {rightAction ? <View className="w-10 h-10 justify-center items-center">{rightAction}</View> : <View className="w-10 h-10" />}
    </View>
  );
}
