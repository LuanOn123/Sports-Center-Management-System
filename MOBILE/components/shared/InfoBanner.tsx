// components/shared/InfoBanner.tsx
// Khung thông báo inline (tương đương AlertBanner của FE web)

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';

export type InfoBannerTone = 'info' | 'success' | 'warning' | 'error';

const TONE: Record<InfoBannerTone, { color: string; icon: string }> = {
  info: { color: Colors.status.scheduled, icon: 'info-outline' },
  success: { color: Colors.status.success, icon: 'check-circle-outline' },
  warning: { color: Colors.status.pending, icon: 'warning' },
  error: { color: Colors.status.failed, icon: 'error-outline' },
};

interface InfoBannerProps {
  tone: InfoBannerTone;
  title: string;
  message?: string;
}

export function InfoBanner({ tone, title, message }: InfoBannerProps) {
  const { color, icon } = TONE[tone];
  return (
    <View className="flex-row gap-sm rounded-md p-md mb-lg border" style={{ backgroundColor: color + '15', borderColor: color + '40' }}>
      <Icon name={icon} size={18} color={color} />
      <View className="flex-1">
        <Text className="text-sm font-bevn-bold mb-0.5" style={{ color }}>{title}</Text>
        {Boolean(message) && <Text className="text-sm text-text-secondary font-bevn-regular">{message}</Text>}
      </View>
    </View>
  );
}
