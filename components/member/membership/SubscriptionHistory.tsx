// components/member/membership/SubscriptionHistory.tsx
// Lịch sử đăng ký gói gần đây

import React from 'react';
import { View, Text } from 'react-native';
import {
  SUBSCRIPTION_HISTORY_LIMIT, SUBSCRIPTION_STATUS_COLOR, SUBSCRIPTION_STATUS_LABEL,
} from '../../../constants/membership';
import { formatDate } from '../../../lib/format';
import type { Subscription } from '../../../lib/types';

export function SubscriptionHistory({ subscriptions }: { subscriptions: Subscription[] }) {
  if (subscriptions.length === 0) return null;
  return (
    <View className="mb-xl">
      <Text className="text-lg font-bevn-bold text-text-primary mb-md">Lịch sử đăng ký</Text>
      {subscriptions.slice(0, SUBSCRIPTION_HISTORY_LIMIT).map((s) => {
        const color = SUBSCRIPTION_STATUS_COLOR[s.status];
        return (
          <View key={s.id} className="flex-row justify-between items-center py-md border-b border-divider">
            <View className="flex-1 mr-md">
              <Text className="text-sm font-bevn-semibold text-text-primary mb-0.5">{s.plan?.name ?? 'Gói tập'}</Text>
              <Text className="text-xs text-text-muted font-bevn-regular">{formatDate(s.startDate)} → {formatDate(s.endDate)}</Text>
            </View>
            <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: color + '20' }}>
              <Text className="text-xs font-bevn-semibold" style={{ color }}>{SUBSCRIPTION_STATUS_LABEL[s.status]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
