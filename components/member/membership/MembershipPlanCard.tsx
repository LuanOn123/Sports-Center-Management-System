// components/member/membership/MembershipPlanCard.tsx
// Thẻ một gói tập + nút thanh toán VietQR (web: thẻ plan trong MembershipPage)

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../../shared/Icon';
import { Colors } from '../../../constants/theme';
import { TIER_ICON, TIER_LABEL } from '../../../constants/membership';
import { formatDate, formatVnd } from '../../../lib/format';
import { isPurchasablePlan, planDailyPrice } from '../../../lib/businessRules';
import type { MembershipPlan, Subscription } from '../../../lib/types';

interface MembershipPlanCardProps {
  plan: MembershipPlan;
  /** Gói hiệu lực đúng plan này (nếu có) — đổi nút thành "Gia hạn" */
  registered?: Subscription;
  isCreating: boolean;
  disabled: boolean;
  onCheckout: () => void;
}

export function MembershipPlanCard({ plan, registered, isCreating, disabled, onCheckout }: MembershipPlanCardProps) {
  const tierColor = Colors.tier[plan.tier];
  const dailyPrice = planDailyPrice(plan);
  const canBuy = isPurchasablePlan(plan) && !disabled;

  return (
    <View className="bg-bg-surface rounded-xl p-xl mb-md border" style={{ borderColor: registered ? Colors.primary : Colors.border }}>
      <View className="flex-row items-center gap-sm mb-sm">
        <Icon name={TIER_ICON[plan.tier]} size={20} color={tierColor} />
        <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: tierColor + '20' }}>
          <Text className="text-xs font-bevn-semibold" style={{ color: tierColor }}>HẠNG {TIER_LABEL[plan.tier].toUpperCase()}</Text>
        </View>
      </View>

      <Text className="text-lg font-bevn-bold text-text-primary mb-1">{plan.name}</Text>
      {registered && (
        <View className="flex-row items-center gap-1 mb-1">
          <Icon name="check-circle-outline" size={14} color={Colors.primary} />
          <Text className="text-sm text-primary font-bevn-medium">Đang sử dụng · đến {formatDate(registered.endDate)}</Text>
        </View>
      )}
      {dailyPrice !== null && (
        <Text className="text-sm text-text-secondary font-bevn-regular mb-1">
          Khoảng <Text className="font-bevn-bold text-text-primary">{dailyPrice.toLocaleString('vi-VN')} đ/ngày</Text> · {plan.durationDays} ngày tập luyện
        </Text>
      )}
      {Boolean(plan.description) && <Text className="text-sm text-text-secondary font-bevn-regular">{plan.description}</Text>}

      <View className="flex-row justify-between items-baseline my-lg py-md border-t border-b border-divider">
        <Text className="text-xl font-bevn-bold text-primary">{formatVnd(plan.price)}</Text>
        <Text className="text-sm text-text-secondary font-bevn-regular">{plan.durationDays} ngày</Text>
      </View>

      <TouchableOpacity
        className="flex-row justify-center items-center gap-1.5 bg-primary rounded-md p-md"
        style={{ opacity: canBuy ? 1 : 0.5 }}
        onPress={onCheckout}
        disabled={!canBuy}
      >
        {isCreating ? (
          <ActivityIndicator color={Colors.text.inverse} size="small" />
        ) : (
          <Icon name="qr-code-scanner" size={17} color={Colors.text.inverse} />
        )}
        <Text className="text-text-inverse font-bevn-bold text-md">
          {isCreating ? 'Đang tạo mã...' : registered ? 'Gia hạn qua VietQR' : 'Chuyển khoản VietQR'}
        </Text>
      </TouchableOpacity>
      <Text className="text-xs text-text-muted font-bevn-regular text-center mt-sm">
        Quét mã bằng ứng dụng ngân hàng. Sau khi nhận tiền, hệ thống sẽ kích hoạt gói hoặc thông báo nếu cần đối soát.
      </Text>
    </View>
  );
}
