// components/member/MemberHomeView.tsx
// UI Trang chủ dành riêng cho Hội viên (Member)

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Brand } from '../shared/Brand';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { useMemberHome } from '../../hooks/member/useMemberHome';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { Colors } from '../../constants/theme';
import type { User, MembershipTier, Enrollment } from '../../lib/types';

const TIER_LABEL: Record<MembershipTier, string> = {
  FREE: 'Miễn Phí',
  MEMBERSHIP: 'Tiêu Chuẩn',
  PREMIUM: 'Cao Cấp',
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface MemberHomeViewProps {
  user: User | null;
}

export function MemberHomeView({ user }: MemberHomeViewProps) {
  const router = useRouter();
  const memberId = user?.memberProfile?.id ?? user?.id;
  const unreadNotificationsCount = useUnreadNotificationCount();

  const {
    status,
    statusLoading,
    pendingRequest,
    upcoming,
    enrollLoading,
    onRefresh,
  } = useMemberHome(user?.id, memberId);

  const effectiveTier: MembershipTier = (status?.effectiveTier ?? 'FREE') as MembershipTier;

  return (
    <ScrollView
      className="flex-1 bg-bg-primary"
      contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Top Bar Header */}
      <View className="flex-row justify-between items-center mb-lg">
        <Brand size="sm" align="flex-start" />
        <View className="flex-row items-center gap-3">
          {/* Nút thông báo */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
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
            onPress={() => router.push('/(tabs)/profile')}
            className="w-10 h-10 rounded-full bg-primary justify-center items-center"
            activeOpacity={0.7}
          >
            <Text className="text-base font-bold font-bevn-bold text-text-inverse">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'M'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
      <View className="mb-xl">
        <Text className="text-xl font-bold font-bevn-bold text-text-primary">Xin chào, {user?.fullName?.split(' ').pop()}</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Hôm nay bạn muốn tập gì?</Text>
      </View>

      {/* Membership Status Card */}
      {Boolean(status.activeSubscription) ? (
        /* ACTIVE MEMBERSHIP */
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border shadow-md" style={{ borderColor: Colors.tier[effectiveTier] + '60' }}>
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
            <TouchableOpacity className="bg-[#A3E63520] rounded-full px-md py-xs" onPress={() => router.push('/membership/plans')}>
              <Text className="text-primary text-sm font-semibold font-bevn-semibold">Quản lý gói</Text>
            </TouchableOpacity>
          </View>
          <View className="gap-1.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name="event" size={16} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Hết hạn: {formatShortDate(status.activeSubscription!.endDate)}
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
      ) : pendingRequest ? (
        /* PENDING MEMBERSHIP CARD */
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border-[1.5px] border-[#F59E0B]">
          <View className="flex-row justify-between items-start mb-md">
            <View className="flex-1 mr-sm">
              <View className="flex-row items-center gap-1 mb-1">
                <Icon name="hourglass-top" size={14} color="#D97706" />
                <Text className="text-xs font-bold font-bevn-bold text-[#D97706]">CHỜ LỄ TÂN DUYỆT</Text>
              </View>
              <Text className="text-lg font-bold font-bevn-bold text-text-primary" numberOfLines={1}>{pendingRequest.planName}</Text>
            </View>
            <TouchableOpacity className="bg-[#F59E0B20] rounded-full px-md py-xs" onPress={() => router.push('/membership/plans')}>
              <Text className="text-[#D97706] text-sm font-semibold font-bevn-semibold">Chi tiết</Text>
            </TouchableOpacity>
          </View>
          <View className="gap-1.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name="payment" size={15} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">
                Hình thức: {pendingRequest.paymentMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon name="info-outline" size={15} color="#D97706" />
              <Text className="text-sm font-bevn-regular text-[#B45309]">
                Vui lòng thanh toán tại quầy Lễ tân để kích hoạt
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* NO ACTIVE MEMBERSHIP */
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
          <View className="flex-row justify-between items-start mb-md">
            <View className="flex-1 mr-sm">
              <Text className="text-xs text-text-muted mb-1 font-bevn-regular uppercase tracking-wide">Hạng thành viên</Text>
              <Text className="text-xxl font-bold font-bevn-bold text-text-primary">
                {statusLoading ? '—' : 'Miễn Phí (FREE)'}
              </Text>
            </View>
            <TouchableOpacity className="bg-[#A3E63520] rounded-full px-md py-xs" onPress={() => router.push('/membership/plans')}>
              <Text className="text-primary text-sm font-semibold font-bevn-semibold">Đăng ký gói</Text>
            </TouchableOpacity>
          </View>
          {!statusLoading && (
            <Text className="text-sm text-text-muted font-bevn-regular">Chưa có gói hội viên đang hoạt động</Text>
          )}
        </View>
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
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Truy cập nhanh</Text>
        </View>

        <View className="flex-row flex-wrap gap-md">
          {[
            {
              icon: 'explore' as const,
              label: 'Khám phá',
              desc: 'Tìm & đăng ký lớp',
              route: '/(tabs)/classes' as const,
              color: Colors.primary,
              bgColor: '#A3E63518',
            },
            {
              icon: 'event-note' as const,
              label: 'Lớp học',
              desc: 'Lớp đã đặt, đổi buổi',
              route: '/(tabs)/enrollments' as const,
              color: '#8B5CF6',
              bgColor: '#8B5CF618',
            },
            {
              icon: 'event' as const,
              label: 'Lịch tập',
              desc: 'Thời khóa biểu cá nhân',
              route: '/(tabs)/schedule' as const,
              color: '#06B6D4',
              bgColor: '#06B6D418',
            },
            {
              icon: 'card-membership' as const,
              label: 'Gói tập',
              desc: 'Hội viên & quyền lợi',
              route: '/membership/plans' as const,
              color: '#F59E0B',
              bgColor: '#F59E0B18',
            },
            {
              icon: 'fact-check' as const,
              label: 'Chuyên cần',
              desc: 'Lịch sử điểm danh',
              route: '/attendance/my' as const,
              color: '#10B981',
              bgColor: '#10B98118',
            },
            {
              icon: 'person' as const,
              label: 'Hồ sơ',
              desc: 'Thông tin tài khoản',
              route: '/(tabs)/profile' as const,
              color: '#EC4899',
              bgColor: '#EC489918',
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              className="flex-1 min-w-[46%] bg-bg-surface rounded-xl p-md border border-border flex-row items-center gap-md"
              onPress={() => router.push(item.route)}
              activeOpacity={0.75}
            >
              <View
                className="w-11 h-11 rounded-lg justify-center items-center"
                style={{ backgroundColor: item.bgColor }}
              >
                <Icon name={item.icon} size={22} color={item.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold font-bevn-semibold text-text-primary">{item.label}</Text>
                <Text className="text-[11px] text-text-muted font-bevn-regular mt-0.5" numberOfLines={1}>{item.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── LỊCH SẮP TỚI (UPCOMING CLASSES) ─── */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Lịch sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/enrollments')} className="flex-row items-center gap-1">
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
            <TouchableOpacity className="bg-primary rounded-md px-xl py-sm" onPress={() => router.push('/(tabs)/classes')}>
              <Text className="text-text-inverse font-bold font-bevn-bold">Tìm lớp học</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcoming.map((e: Enrollment) => (
            <TouchableOpacity
              key={e.id}
              className="bg-bg-surface rounded-lg p-lg mb-sm flex-row justify-between items-center border border-border"
              onPress={() => { if (e.scheduleId) router.push(`/schedule/${e.scheduleId}`); }}
            >
              <View className="flex-1">
                <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{e.schedule?.class?.name ?? 'Lớp học'}</Text>
                <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">
                  {e.schedule
                    ? `${formatShortDate(e.schedule.startTime)} • ${formatTime(e.schedule.startTime)} – ${formatTime(e.schedule.endTime)}`
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
