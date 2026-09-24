// components/member/MemberHomeView.tsx
// UI Trang chủ dành riêng cho Hội viên (Member)

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Brand } from '../shared/Brand';
import { useMemberHome } from '../../hooks/member/useMemberHome';
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
      {/* Top Bar */}
      <View className="flex-row justify-between items-center mb-lg">
        <Brand size="sm" align="flex-start" />
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} className="w-11 h-11 rounded-full bg-primary justify-center items-center">
          <Text className="text-lg font-bold font-bevn-bold text-text-inverse">{user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View className="mb-xl">
        <Text className="text-xl font-bold font-bevn-bold text-text-primary">Xin chào, {user?.fullName?.split(' ').pop()}</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">Hôm nay bạn tập gì?</Text>
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

      {/* Upcoming Classes */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Lịch sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')} className="flex-row items-center gap-1">
            <Text className="text-sm text-primary font-bevn-medium">Xem tất cả</Text>
            <Icon name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {enrollLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
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

      {/* Quick Actions */}
      <View className="mb-xl">
        <Text className="text-lg font-bold font-bevn-bold text-text-primary">Truy cập nhanh</Text>
        <View className="flex-row flex-wrap gap-md mt-sm">
          {[
            { icon: 'fitness-center' as const, label: 'Lớp học', route: '/(tabs)/classes' as const },
            { icon: 'card-membership' as const, label: 'Gói tập', route: '/membership/plans' as const },
            { icon: 'timeline' as const, label: 'Chuyên cần', route: '/attendance/my' as const },
            { icon: 'person' as const, label: 'Hồ sơ', route: '/(tabs)/profile' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              className="flex-1 min-w-[44%] bg-bg-surface rounded-lg p-lg items-center border border-border"
              onPress={() => router.push(item.route)}
            >
              <View className="w-12 h-12 rounded-md bg-bg-elevated justify-center items-center mb-sm">
                <Icon name={item.icon} size={26} color={Colors.primary} />
              </View>
              <Text className="text-sm text-text-secondary font-bevn-medium">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
