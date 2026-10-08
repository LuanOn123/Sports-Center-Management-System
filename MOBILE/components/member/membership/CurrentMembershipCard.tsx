// components/member/membership/CurrentMembershipCard.tsx
// Thẻ gói đang dùng (kèm nút hủy) hoặc trạng thái chưa có gói

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { TIER_ICON, TIER_LABEL } from '../../../constants/membership';
import { formatDate } from '../../../lib/format';
import type { MembershipTier, Subscription } from '../../../lib/types';

interface CurrentMembershipCardProps {
  activeSub: Subscription | null;
  tier: MembershipTier;
  daysRemaining: number | null;
  onCancel: () => void;
}

export function CurrentMembershipCard({ activeSub, tier, daysRemaining, onCancel }: CurrentMembershipCardProps) {
  if (!activeSub) {
    return (
      <View key="membership-none" className="bg-bg-surface rounded-xl p-xl mb-xl border border-border">
        <Text className="text-xs text-text-muted uppercase tracking-wide mb-sm font-bevn-regular">Hạng hiện tại</Text>
        <View className="flex-row items-center gap-sm mb-md">
          <Icon name={TIER_ICON.FREE} size={28} color={Colors.text.muted} />
          <Text className="text-xxl font-bevn-bold text-text-muted">{TIER_LABEL.FREE} (FREE)</Text>
        </View>
        <Text className="text-sm text-text-muted font-bevn-regular">Chưa có gói thành viên đang hiệu lực. Hãy chọn gói bên dưới để đăng ký!</Text>
      </View>
    );
  }

  const tierColor = Colors.tier[tier];
  return (
    <View key="membership-active" className="bg-bg-surface rounded-xl p-xl mb-xl border" style={{ borderColor: tierColor + '60' }}>
      <View className="flex-row justify-between items-center mb-xs">
        <View className="flex-row items-center gap-1">
          <Icon name={TIER_ICON[tier]} size={14} color={tierColor} />
          <Text className="text-xs font-bevn-bold tracking-wide" style={{ color: tierColor }}>HẠNG {TIER_LABEL[tier].toUpperCase()}</Text>
        </View>
        <View className="px-sm py-0.5 rounded-full" style={{ backgroundColor: tierColor + '20' }}>
          <Text className="text-xs font-bevn-bold" style={{ color: tierColor }}>ĐANG SỬ DỤNG</Text>
        </View>
      </View>
      <Text className="text-xxl font-bevn-bold text-text-primary my-sm">{activeSub.plan?.name ?? `Gói ${TIER_LABEL[tier]}`}</Text>
      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon name="event" size={16} color={Colors.text.secondary} />
          <Text className="text-sm text-text-secondary font-bevn-regular">Hết hạn: {formatDate(activeSub.endDate)}</Text>
        </View>
        {daysRemaining !== null && (
          <View className="flex-row items-center gap-1.5">
            <Icon name="schedule" size={16} color={Colors.text.secondary} />
            <Text className="text-sm text-text-secondary font-bevn-regular">Còn {daysRemaining} ngày sử dụng</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        className="flex-row justify-center items-center gap-1.5 mt-lg py-sm rounded-md border"
        style={{ borderColor: Colors.status.expired + '40' }}
        onPress={onCancel}
      >
        <Icon name="cancel" size={16} color={Colors.status.expired} />
        <Text className="text-status-expired font-bevn-semibold text-sm">Hủy gói này</Text>
      </TouchableOpacity>
    </View>
  );
}
