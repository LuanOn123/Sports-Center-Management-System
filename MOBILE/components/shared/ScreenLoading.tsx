import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/theme';

interface ScreenLoadingProps {
  message?: string;
  size?: 'small' | 'large';
  className?: string;
}

export function ScreenLoading({ message = 'Đang tải dữ liệu...', size = 'large', className }: ScreenLoadingProps) {
  return (
    <View className={`flex-1 justify-center items-center py-xxxl ${className || ''}`}>
      <ActivityIndicator color={Colors.primary} size={size} />
      {Boolean(message) && (
        <Text className="text-text-secondary text-sm font-bevn-regular mt-md text-center">
          {message}
        </Text>
      )}
    </View>
  );
}
