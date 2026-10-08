// components/member/payment/SepayReviewPanel.tsx
// Đã nhận tiền nhưng gói chưa kích hoạt được — chờ trung tâm đối soát (web: nhánh requiresReview)

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { InfoBanner } from '../../shared/InfoBanner';
import { Colors } from '../../../constants/theme';
import type { SepayCheckout } from '../../../lib/types';

interface SepayReviewPanelProps {
  checkout: SepayCheckout;
  isChecking: boolean;
  onCheckAgain: () => void;
  onClose: () => void;
}

export function SepayReviewPanel({ checkout, isChecking, onCheckAgain, onClose }: SepayReviewPanelProps) {
  const note = checkout.reviewReason ? ` Ghi chú: ${checkout.reviewReason}` : '';
  return (
    <View>
      <InfoBanner
        tone="warning"
        title="Đã nhận thanh toán — đang đối soát"
        message={`Trung tâm đã nhận tiền cho đơn ${checkout.orderCode}. Gói chưa được kích hoạt; vui lòng giữ biên lai và liên hệ trung tâm.${note}`}
      />
      <View className="flex-row gap-md">
        <TouchableOpacity
          className="flex-1 flex-row justify-center items-center gap-1.5 rounded-md p-md border border-border"
          onPress={onCheckAgain}
          disabled={isChecking}
        >
          {isChecking && <ActivityIndicator color={Colors.text.secondary} size="small" />}
          <Text className="text-text-secondary font-bevn-semibold text-sm">Kiểm tra lại</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-primary rounded-md p-md items-center" onPress={onClose}>
          <Text className="text-text-inverse font-bevn-bold text-sm">Đóng</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
