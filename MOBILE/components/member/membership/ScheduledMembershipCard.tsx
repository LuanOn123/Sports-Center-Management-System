// components/member/membership/ScheduledMembershipCard.tsx
// Gói tiếp theo đã thanh toán và lên lịch (status SCHEDULED) — web: thẻ "NEXT UP / SCHEDULED MEMBERSHIP".
// Hội viên hủy được gói chờ (hoàn 100%, giữ nguyên gói đang dùng); còn gói chờ thì BE chặn mua/gia hạn tiếp.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { SCHEDULED_SUBSCRIPTION_TEXT, TIER_LABEL } from '../../../constants/membership';
import { formatDate } from '../../../lib/format';
import type { Subscription } from '../../../lib/types';

interface ScheduledMembershipCardProps {
  subscription: Subscription;
  onCancel: () => void;
}

export function ScheduledMembershipCard({ subscription, onCancel }: ScheduledMembershipCardProps) {
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
      <TouchableOpacity
        className="flex-row justify-center items-center gap-1.5 mt-lg py-sm rounded-md border"
        style={{ borderColor: Colors.status.expired + '40' }}
        onPress={onCancel}
      >
        <Icon name="cancel" size={16} color={Colors.status.expired} />
        <Text className="text-status-expired font-bevn-semibold text-sm">{SCHEDULED_SUBSCRIPTION_TEXT.cancelButton}</Text>
      </TouchableOpacity>
    </View>
  );
}
