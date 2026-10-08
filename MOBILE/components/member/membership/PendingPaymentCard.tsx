// components/member/membership/PendingPaymentCard.tsx
// Thẻ "Xem trạng thái giao dịch" của đơn SePay gần nhất (web: nút cuối MembershipPage)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { formatVnd } from '../../../lib/format';
import type { SepayCheckout } from '../../../lib/types';

interface PendingPaymentCardProps {
  checkout: SepayCheckout;
  onPress: () => void;
}

export function PendingPaymentCard({ checkout, onPress }: PendingPaymentCardProps) {
  const color = Colors.status.pending;
  return (
    <TouchableOpacity
      className="flex-row items-center gap-md bg-bg-surface rounded-xl p-lg mb-lg border-[1.5px]"
      style={{ borderColor: color }}
      onPress={onPress}
    >
      <Icon name="hourglass-top" size={22} color={color} />
      <View className="flex-1">
        <Text className="text-xs font-bevn-bold" style={{ color }}>XEM TRẠNG THÁI GIAO DỊCH</Text>
        <Text className="text-sm font-bevn-semibold text-text-primary mt-0.5" numberOfLines={1}>
          {checkout.plan?.name ?? 'Gói hội viên'} · {formatVnd(checkout.amount)}
        </Text>
        <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">Mã đơn {checkout.orderCode}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={color} />
    </TouchableOpacity>
  );
}
