// components/member/membership/ScheduledMembershipCard.tsx
// Gói tiếp theo đã thanh toán và lên lịch (status SCHEDULED) — web: thẻ "NEXT UP / SCHEDULED MEMBERSHIP"

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { TIER_LABEL } from '../../../constants/membership';
import { formatDate } from '../../../lib/format';
import type { Subscription } from '../../../lib/types';

export function ScheduledMembershipCard({ subscription }: { subscription: Subscription }) {
  const color = Colors.status.scheduled;
  const tier = subscription.tier ?? subscription.plan?.tier ?? 'MEMBERSHIP';
  return (
    <View className="bg-bg-surface rounded-xl p-xl mb-xl border" style={{ borderColor: color + '60' }}>
      <View className="flex-row items-center justify-between mb-xs">
        <View className="flex-row items-center gap-1">
          <Icon name="event-available" size={14} color={color} />
          <Text className="text-xs font-bevn-bold tracking-wide" style={{ color }}>GÓI TIẾP THEO</Text>
        </View>
        <View className="px-sm py-0.5 rounded-full" style={{ backgroundColor: color + '20' }}>
          <Text className="text-xs font-bevn-bold" style={{ color }}>ĐÃ LÊN LỊCH</Text>
        </View>
      </View>
      <Text className="text-xl font-bevn-bold text-text-primary my-sm">
        {subscription.planNameSnapshot ?? subscription.plan?.name ?? `Gói ${TIER_LABEL[tier]}`}
      </Text>
      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon name="star" size={16} color={Colors.tier[tier]} />
          <Text className="text-sm text-text-secondary font-bevn-regular">Hạng {TIER_LABEL[tier]}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="play-circle-outline" size={16} color={Colors.text.secondary} />
          <Text className="text-sm text-text-secondary font-bevn-regular">Ngày kích hoạt dự kiến: {formatDate(subscription.startDate)}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="event" size={16} color={Colors.text.secondary} />
          <Text className="text-sm text-text-secondary font-bevn-regular">Ngày hết hạn dự kiến: {formatDate(subscription.endDate)}</Text>
        </View>
      </View>
      <Text className="text-xs text-text-muted font-bevn-regular mt-md">
        Gói tập này đã được thanh toán và lên lịch sẵn. Hệ thống sẽ tự động kích hoạt vào ngày bắt đầu.
      </Text>
    </View>
  );
}
