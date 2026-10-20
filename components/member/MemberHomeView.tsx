// components/member/MemberHomeView.tsx
// Trang chủ Hội viên — theo các khối của Trang chủ web (DashboardPage): lời chào, gói hiện tại,
// buổi tập tiếp theo, thao tác nhanh, lớp học sắp tới. Logic ở hooks/member/useMemberHome.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../shared/Avatar';
import { Brand } from '../shared/Brand';
import { FacilityPicker } from '../shared/FacilityPicker';
import { NotificationBell } from '../shared/NotificationBell';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { Card, SectionHeader, ShortcutRow, StatusBadge } from '../ui';
import { MembershipHeroCard } from './home/MembershipHeroCard';
import { NextSessionCard } from './home/NextSessionCard';
import { PendingPaymentCard } from './membership/PendingPaymentCard';
import { MissingMemberProfile } from './MissingMemberProfile';
import { getQuickAccessForRole } from '../../navigation/quickAccessConfig';
import { useMemberHome } from '../../hooks/member/useMemberHome';
import { Colors, Spacing } from '../../constants/theme';
import { formatTime, formatWeekdayDate, greetingFor } from '../../lib/format';
import { memberProfileIdOf } from '../../lib/businessRules';
import type { User, MembershipTier } from '../../lib/types';
import { ROUTES } from '../../navigation/routes';

/** Số lớp sắp tới hiện dưới thẻ "Buổi tập tiếp theo" */
const UPCOMING_PREVIEW = 3;

interface MemberHomeViewProps {
  user: User | null;
  facilityId?: string;
}

export function MemberHomeView({ user, facilityId }: MemberHomeViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const memberId = memberProfileIdOf(user) ?? undefined;
  const { activeSub, scheduledSub, quota, status, statusLoading, pendingPayment, upcoming, enrollLoading, onRefresh } =
    useMemberHome(memberId, { userId: user?.id, facilityId });
  const tier: MembershipTier = (status?.effectiveTier ?? 'FREE') as MembershipTier;
  const [next, ...later] = upcoming;

  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: Spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View className="flex-row justify-between items-center mb-lg">
        <Brand size="sm" align="flex-start" />
        <View className="flex-row items-center gap-sm">
          <NotificationBell />
          <TouchableOpacity onPress={() => router.push(ROUTES.account)} activeOpacity={0.7} accessibilityLabel="Tài khoản">
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      <FacilityPicker />

      <View className="mb-lg">
        <Text className="text-xxl font-bevn-bold text-text-primary" numberOfLines={1}>
          {greetingFor()}, {user?.fullName?.split(' ').pop()}
        </Text>
        <Text className="text-sm text-text-secondary font-bevn-regular mt-0.5">{formatWeekdayDate(new Date().toISOString(), 'long')}</Text>
      </View>

      {!memberId ? (
        <MissingMemberProfile key="membership-missing" />
      ) : (
        <MembershipHeroCard
          activeSub={activeSub}
          tier={tier}
          daysRemaining={status.daysRemaining}
          quota={quota}
          scheduledSub={scheduledSub}
          loading={statusLoading}
        />
      )}

      {pendingPayment && (
        <PendingPaymentCard checkout={pendingPayment} onPress={() => router.push(ROUTES.payment(pendingPayment.paymentId))} />
      )}

      {enrollLoading ? <View className="mb-lg"><ClassCardSkeleton /></View> : <NextSessionCard enrollment={next} />}

      <ShortcutRow items={getQuickAccessForRole('MEMBER')} />

      {later.length > 0 && (
        <View className="mb-lg">
          <SectionHeader title="Lớp học sắp tới" actionLabel={`Xem tất cả (${upcoming.length})`} onAction={() => router.push(ROUTES.schedule)} />
          <View className="gap-sm">
            {later.slice(0, UPCOMING_PREVIEW).map((e) => (
              <Card key={e.id} onPress={() => e.schedule && router.push(ROUTES.scheduleDetail(e.schedule.id))}>
                <View className="flex-row items-center gap-md">
                  <View className="items-center w-14">
                    <Text className="text-md font-bevn-bold text-text-primary">{e.schedule ? formatTime(e.schedule.startTime) : '—'}</Text>
                    <Text className="text-xs text-text-muted font-bevn-regular">{e.schedule ? formatWeekdayDate(e.schedule.startTime).split(',')[0] : ''}</Text>
                  </View>
                  <View className="flex-1 border-l-2 pl-md" style={{ borderLeftColor: Colors.status.booked }}>
                    <Text className="text-md font-bevn-semibold text-text-primary" numberOfLines={1}>{e.schedule?.class?.name ?? 'Lớp học'}</Text>
                    <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={1}>
                      {e.schedule ? formatWeekdayDate(e.schedule.startTime) : ''}{e.schedule?.room ? ` · ${e.schedule.room.name}` : ''}
                    </Text>
                  </View>
                  <StatusBadge label="Đã đặt" color={Colors.status.booked} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
