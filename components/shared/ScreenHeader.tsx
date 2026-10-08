import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';
import { ROUTES } from '../../navigation/routes';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBackPress,
  rightAction,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(ROUTES.home);
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 6;

  return (
    <View
      className="flex-row justify-between items-center px-md pb-sm border-b border-border"
      style={{
        paddingTop: topPadding,
        backgroundColor: Colors.bg.surface,
        zIndex: 50,
        elevation: 4,
      }}
    >
      {showBack ? (
        <TouchableOpacity
          className="w-10 h-10 justify-center items-center rounded-full"
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      ) : (
        <View className="w-10 h-10" />
      )}

      <View className="flex-1 items-center px-xs">
        <Text className="text-lg font-bold font-bevn-bold text-text-primary text-center" numberOfLines={1}>
          {title}
        </Text>
        {Boolean(subtitle) && (
          <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular text-center" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightAction ? (
        <View className="w-10 h-10 justify-center items-center">{rightAction}</View>
      ) : (
        <View className="w-10 h-10" />
      )}
    </View>
  );
}
