// components/member/MemberHomeView.tsx
// UI Trang chủ dành riêng cho Hội viên (Member)

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { Brand } from '../shared/Brand';
import { FacilityPicker } from '../shared/FacilityPicker';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { PendingPaymentCard } from './membership/PendingPaymentCard';
import { QuickAccessGrid } from '../shared/QuickAccessGrid';
import { getQuickAccessForRole } from '../../navigation/quickAccessConfig';
import { useMemberHome } from '../../hooks/member/useMemberHome';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { Colors } from '../../constants/theme';
import { TIER_LABEL } from '../../constants/membership';
import { formatDate, formatTime } from '../../lib/format';
import type { User, MembershipTier, Enrollment } from '../../lib/types';
import { ROUTES } from '../../navigation/routes';

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

interface MemberHomeViewProps {
  user: User | null;
  facilityId?: string;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function MemberHomeView({ user, facilityId }: MemberHomeViewProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const unreadNotificationsCount = useUnreadNotificationCount();

  const {
    status,
    statusLoading,
    pendingPayment,
    upcoming,
    enrollLoading,
    onRefresh,
  } = useMemberHome(memberId, { userId: user?.id, facilityId });

  const effectiveTier: MembershipTier = (status?.effectiveTier ?? 'FREE') as MembershipTier;

  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top, 16) + 10,
        paddingBottom: 32,
      }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Top Bar Header */}
      <View className="flex-row justify-between items-center mb-lg">
        <Brand size="sm" align="flex-start" />
        <View className="flex-row items-center gap-3">
          {/* Nút thông báo */}
          <TouchableOpacity
            onPress={() => router.push(ROUTES.notifications)}
            className="w-10 h-10 rounded-full bg-bg-surface border border-border justify-center items-center relative"
            activeOpacity={0.7}
          >
            <Icon name="notifications-none" size={22} color={Colors.text.primary} />
            {unreadNotificationsCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-status-expired rounded-full min-w-[18px] h-[18px] justify-center items-center px-1 border-2 border-bg-surface">
                <Text className="text-[10px] font-bevn-bold text-white">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar Profile */}
          <TouchableOpacity
            onPress={() => router.push(ROUTES.profile)}
            activeOpacity={0.7}
          >
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      <FacilityPicker />

      {/* Greeting */}
      <View className="mb-xl">
        <Text className="text-xl font-bold font-bevn-bold text-text-primary">Xin chào, {user?.fullName?.split(' ').pop()}</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Hôm nay bạn muốn tập gì?</Text>
      </View>

      {/* Membership Status Card — key riêng cho từng nhánh: thẻ đổi từ FREE → ACTIVE khi dữ liệu
          về/thanh toán xong phải được mount lại. Nếu tái dùng cùng View rồi thêm `shadow-md` (biến CSS)
          sau lần render đầu, NativeWind in upgrade warning và crash "Couldn't find a navigation context". */}
      {Boolean(status.activeSubscription) ? (
        /* ACTIVE MEMBERSHIP */
        <View key="membership-active" className="bg-bg-surface rounded-xl p-xl mb-lg border shadow-md" style={{ borderColor: Colors.tier[effectiveTier] + '60' }}>
          <View className="flex-row justify-between items-start mb-md">
            <View className="flex-1 mr-sm">
              <View className="flex-row items-center gap-1 mb-1">
                <Icon
                  name={effectiveTier === 'PREMIUM' ? 'workspace-premium' : 'star'}
                  size={14}
                  color={Colors.tier[effectiveTier]}
                />
                <Text className="text-xs font-bold font-bevn-bold tracking-wide" style={{ color: Colors.tier[effectiveTier] }}>
                  {TIER_LABEL[effectiveTier].toUpperCase()}
                </Text>
              </View>
              <Text className="text-xl font-bold font-bevn-bold text-text-primary" numberOfLines={1}>
                {status.activeSubscription!.plan?.name ?? `Gói ${TIER_LABEL[effectiveTier]}`}
              </Text>
            </View>
            <TouchableOpacity className="bg-[#A3E63520] rounded-full px-md py-xs" onPress={() => router.push(ROUTES.membershipPlans)}>
              <Text className="text-primary text-sm font-semibold font-bevn-semibold">Quản lý gói</Text>
            </TouchableOpacity>
          </View>
          <View className="gap-1.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name="event" size={16} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Hết hạn: {formatDate(status.activeSubscription!.endDate)}
              </Text>
            </View>
            {status.daysRemaining !== undefined && (
              <View className="flex-row items-center gap-1.5">
                <Icon name="schedule" size={16} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-regular">
                  Còn {status.daysRemaining} ngày sử dụng
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* NO ACTIVE MEMBERSHIP */
        <View key="membership-none" className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
          <View className="flex-row justify-between items-start mb-md">
            <View className="flex-1 mr-sm">
              <Text className="text-xs text-text-muted mb-1 font-bevn-regular uppercase tracking-wide">Hạng thành viên</Text>
              <Text className="text-xxl font-bold font-bevn-bold text-text-primary">
                {statusLoading ? '—' : 'Miễn Phí (FREE)'}
              </Text>
            </View>
            <TouchableOpacity className="bg-[#A3E63520] rounded-full px-md py-xs" onPress={() => router.push(ROUTES.membershipPlans)}>
              <Text className="text-primary text-sm font-semibold font-bevn-semibold">Đăng ký gói</Text>
            </TouchableOpacity>
          </View>
          {!statusLoading && (
            <Text className="text-sm text-text-muted font-bevn-regular">Chưa có gói hội viên đang hoạt động</Text>
          )}
        </View>
      )}

      {/* Đơn chuyển khoản SePay gần nhất */}
      {pendingPayment && (
        <PendingPaymentCard checkout={pendingPayment} onPress={() => router.push(ROUTES.payment(pendingPayment.paymentId))} />
      )}

      {/* Training Level & Goal */}
      {Boolean(user?.memberProfile?.trainingLevel) && (
        <View className="flex-row gap-md mb-lg">
          <View className="flex-1 bg-bg-surface rounded-lg p-lg border border-border">
            <Icon name="track-changes" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Trình độ</Text>
            <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{LEVEL_LABEL[user!.memberProfile!.trainingLevel!]}</Text>
          </View>
          {Boolean(user?.memberProfile?.fitnessGoal) && (
            <View className="flex-[2] bg-bg-surface rounded-lg p-lg border border-border">
              <Icon name="fitness-center" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
              <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Mục tiêu</Text>
              <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5" numberOfLines={2}>{user!.memberProfile!.fitnessGoal}</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── TRUY CẬP NHANH (QUICK ACCESS) — ĐƯỢC ĐẶT LÊN TRÊN LỊCH SẮP TỚI ─── */}
      <QuickAccessGrid items={getQuickAccessForRole('MEMBER')} />

      {/* ─── LỊCH SẮP TỚI (UPCOMING CLASSES) ─── */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Lịch sắp tới</Text>
          <TouchableOpacity onPress={() => router.push(ROUTES.enrollments)} className="flex-row items-center gap-1">
            <Text className="text-sm text-primary font-bevn-medium">Quản lý lớp</Text>
            <Icon name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {enrollLoading ? (
          <View className="mt-sm">
            <ClassCardSkeleton />
          </View>
        ) : upcoming.length === 0 ? (
          <View className="bg-bg-surface rounded-xl p-xxxl items-center border border-border">
            <Icon name="event-busy" size={44} color={Colors.text.muted} style={{ marginBottom: 12 }} />
            <Text className="text-text-muted text-sm font-bevn-regular mb-lg">Bạn chưa đăng ký lớp nào</Text>
            <TouchableOpacity className="bg-primary rounded-md px-xl py-sm" onPress={() => router.push(ROUTES.classes)}>
              <Text className="text-text-inverse font-bold font-bevn-bold">Tìm lớp học</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcoming.map((e: Enrollment) => (
            <TouchableOpacity
              key={e.id}
              className="bg-bg-surface rounded-lg p-lg mb-sm flex-row justify-between items-center border border-border"
              onPress={() => { if (e.scheduleId) router.push(ROUTES.scheduleDetail(e.scheduleId)); }}
            >
              <View className="flex-1">
                <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{e.schedule?.class?.name ?? 'Lớp học'}</Text>
                <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">
                  {e.schedule
                    ? `${formatDate(e.schedule.startTime)} • ${formatTime(e.schedule.startTime)} – ${formatTime(e.schedule.endTime)}`
                    : '—'}
                </Text>
                {Boolean(e.schedule?.room) && (
                  <View className="flex-row items-center gap-1 mt-1">
                    <Icon name="place" size={14} color={Colors.text.secondary} />
                    <Text className="text-xs text-text-muted font-bevn-regular">{e.schedule!.room!.name}</Text>
                  </View>
                )}
              </View>
              <View className="bg-[#8B5CF620] rounded-full px-sm py-[3px] ml-sm">
                <Text className="text-xs font-semibold font-bevn-semibold text-status-booked">Đã đặt</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* AI Shortcut (stub) */}
      <TouchableOpacity className="bg-[#A3E63515] rounded-xl p-xl flex-row justify-between items-center border border-[#A3E63530]">
        <View className="flex-row items-center gap-md">
          <View className="w-11 h-11 rounded-full bg-[#A3E63520] justify-center items-center">
            <Icon name="auto-awesome" size={24} color={Colors.primary} />
          </View>
          <View>
            <Text className="text-md font-semibold font-bevn-semibold text-primary">AI Workout Assistant</Text>
            <Text className="text-xs text-text-secondary font-bevn-regular">Hỏi AI về bài tập phù hợp</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={24} color={Colors.primary} />
      </TouchableOpacity>
    </ScrollView>
  );
}
