// components/member/payment/SepaySuccessPanel.tsx
// Thanh toán thành công — gói đã kích hoạt (web: nhánh SUCCESS của SepayCheckoutModal)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../shared/Icon';
import { InfoRow } from '../../shared/InfoRow';
import { formatVnd } from '../../../lib/format';
import type { SepayCheckout } from '../../../lib/types';

interface SepaySuccessPanelProps {
  checkout: SepayCheckout;
  onClose: () => void;
}

export function SepaySuccessPanel({ checkout, onClose }: SepaySuccessPanelProps) {
  return (
    <View className="items-center">
      <View className="w-[72px] h-[72px] rounded-full bg-accent justify-center items-center mb-lg mt-sm">
        <Icon name="check-circle" size={40} color="#fff" />
      </View>
      <Text className="text-xl font-bevn-bold text-text-primary mb-xs">Thanh toán thành công!</Text>
      <Text className="text-sm text-text-secondary font-bevn-regular text-center mb-xl">
        Giao dịch đã hoàn tất. Gói hội viên của bạn đã được kích hoạt.
      </Text>
      <View className="w-full bg-bg-surface rounded-xl px-lg py-xs mb-xl border border-border">
        <InfoRow label="Mã đơn hàng" value={checkout.orderCode} />
        <InfoRow label="Số tiền" value={`+${formatVnd(checkout.amount)}`} highlight />
        <InfoRow label="Gói đăng ký" value={checkout.plan?.name ?? 'Gói hội viên'} />
      </View>
      <TouchableOpacity className="w-full bg-primary rounded-md p-md items-center" onPress={onClose}>
        <Text className="text-text-inverse font-bevn-bold text-md">Đóng và bắt đầu tập luyện</Text>
      </TouchableOpacity>
    </View>
  );
}
