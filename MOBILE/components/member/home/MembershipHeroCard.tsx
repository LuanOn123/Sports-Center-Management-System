// components/member/home/MembershipHeroCard.tsx
// Thẻ gói trên Trang chủ (web: "Gói hội viên hiện tại"): hạng, tên gói, thanh còn lại / tổng ngày,
// số lớp đang giữ chỗ / giới hạn, gói tiếp theo đã lên lịch. Chưa có gói → mời đăng ký.

import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../shared/Icon';
import { Button, Card, ProgressBar } from '../../ui';
import { Colors } from '../../../constants/theme';
import { TIER_ICON, TIER_LABEL } from '../../../constants/membership';
import { formatDate } from '../../../lib/format';
import { ROUTES } from '../../../navigation/routes';
import type { ConcurrentClassQuota, MembershipTier, Subscription } from '../../../lib/types';

interface MembershipHeroCardProps {
  activeSub: Subscription | null;
  tier: MembershipTier;
  daysRemaining?: number;
  quota?: ConcurrentClassQuota;
  scheduledSub: Subscription | null;
  loading: boolean;
}

function totalDays(sub: Subscription) {
  const snapshot = Number(sub.durationDaysSnapshot ?? sub.plan?.durationDays);
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot;
  return Math.max(1, Math.round((Date.parse(sub.endDate) - Date.parse(sub.startDate)) / 86_400_000));
}

export function MembershipHeroCard({ activeSub, tier, daysRemaining, quota, scheduledSub, loading }: MembershipHeroCardProps) {
  const router = useRouter();
  const openPlans = () => router.push(ROUTES.membershipPlans);
  const scheduled = scheduledSub && (
    <View className="flex-row items-center gap-1.5 mt-md">
      <Icon name="event-available" size={16} color={Colors.status.scheduled} />
      <Text className="flex-1 text-sm font-bevn-medium" style={{ color: Colors.status.scheduled }} numberOfLines={1}>
        Gói tiếp theo: {scheduledSub.planNameSnapshot ?? scheduledSub.plan?.name ?? 'Gói tập'} · từ {formatDate(scheduledSub.startDate)}
      </Text>
    </View>
  );

  if (!activeSub) {
    return (
      <Card key="membership-none" className="mb-lg">
        <Text className="text-xs text-text-muted font-bevn-semibold uppercase tracking-wide">Hạng thành viên</Text>
        <Text className="text-xl font-bevn-bold text-text-primary mt-xs">{loading ? '—' : `${TIER_LABEL.FREE} (FREE)`}</Text>
        {!loading && (
          <Text className="text-sm text-text-secondary font-bevn-regular mt-xs mb-md">
            Bạn chưa có gói hoạt động. Đăng ký gói để đặt lớp và dùng đầy đủ quyền lợi tập luyện.
          </Text>
        )}
        {scheduled}
        <Button title="Xem các gói tập" icon="workspace-premium" onPress={openPlans} className="mt-md" />
      </Card>
    );
  }

  const color = Colors.tier[tier];
  const total = totalDays(activeSub);
  return (
    <Card key="membership-active" accent={color} className="mb-lg" onPress={openPlans} accessibilityLabel="Quản lý gói">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <Icon name={TIER_ICON[tier]} size={14} color={color} />
          <Text className="text-xs font-bevn-bold tracking-wide" style={{ color }}>HẠNG {TIER_LABEL[tier].toUpperCase()}</Text>
        </View>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-sm text-primary font-bevn-semibold">Quản lý gói</Text>
          <Icon name="chevron-right" size={16} color={Colors.primary} />
        </View>
      </View>
      <Text className="text-xl font-bevn-bold text-text-primary mt-xs mb-md" numberOfLines={1}>
        {activeSub.plan?.name ?? `Gói ${TIER_LABEL[tier]}`}
      </Text>
      <ProgressBar value={(daysRemaining ?? 0) / total} color={color} />
      <View className="flex-row justify-between mt-sm">
        <Text className="text-sm text-text-secondary font-bevn-regular">
          Còn <Text className="text-text-primary font-bevn-bold">{daysRemaining ?? 0}</Text>/{total} ngày · hết hạn {formatDate(activeSub.endDate)}
        </Text>
        {quota && quota.limit > 0 && (
          <Text className="text-sm text-text-secondary font-bevn-regular">
            Lớp <Text className="text-text-primary font-bevn-bold">{quota.used}</Text>/{quota.limit}
          </Text>
        )}
      </View>
      {scheduled}
    </Card>
  );
}
