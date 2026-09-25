// components/coach/CoachHomeView.tsx
// UI Trang chủ dành riêng cho Huấn luyện viên (Coach)

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Brand } from '../shared/Brand';
import { ClassCardSkeleton } from '../shared/Skeleton';
import { useCoachHome } from '../../hooks/coach/useCoachHome';
import { useUnreadNotificationCount } from '../../hooks/shared/useNotifications';
import { Colors } from '../../constants/theme';
import type { User } from '../../lib/types';

const CLASS_TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Tiêu Chuẩn',
  PREMIUM: 'Cao Cấp',
};

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface CoachHomeViewProps {
  user: User | null;
}

export function CoachHomeView({ user }: CoachHomeViewProps) {
  const router = useRouter();
  const coachId = user?.coachProfile?.id;
  const unreadNotificationsCount = useUnreadNotificationCount();

  const {
    coachClasses,
    teachingSchedules,
    isLoading,
    classesLoading,
    onRefresh,
  } = useCoachHome(coachId);

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
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'H'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
      <View className="mb-xl">
        <View className="flex-row items-center gap-1 bg-[#A3E63520] px-sm py-[3px] rounded-full self-start mb-xs">
          <Icon name="sports" size={14} color={Colors.primary} />
          <Text className="text-xs font-bold font-bevn-bold text-primary tracking-wide">HUẤN LUYỆN VIÊN</Text>
        </View>
        <Text className="text-xl font-bold font-bevn-bold text-text-primary">Xin chào, HLV {user?.fullName}</Text>
        <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">
          {user?.coachProfile?.specialization
            ? `Chuyên môn: ${user.coachProfile.specialization}`
            : 'Quản lý lịch dạy và các lớp học phụ trách'}
        </Text>
      </View>

      {/* Stats overview */}
      <View className="flex-row gap-md mb-lg">
        <View className="flex-1 bg-bg-surface rounded-lg p-lg border border-border">
          <Icon name="class" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
          <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Lớp phụ trách</Text>
          <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{coachClasses.length} lớp</Text>
        </View>
        <View className="flex-1 bg-bg-surface rounded-lg p-lg border border-border">
          <Icon name="event-available" size={20} color="#10B981" style={{ marginBottom: 4 }} />
          <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Lịch dạy sắp tới</Text>
          <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{teachingSchedules.length} buổi</Text>
        </View>
        {Boolean(user?.coachProfile?.experienceYears) && (
          <View className="flex-1 bg-bg-surface rounded-lg p-lg border border-border">
            <Icon name="workspace-premium" size={20} color="#F59E0B" style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Kinh nghiệm</Text>
            <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{user?.coachProfile?.experienceYears} năm</Text>
          </View>
        )}
      </View>

      {/* ─── TRUY CẬP NHANH (QUICK ACCESS CHO HLV) — ĐƯỢC ĐẶT LÊN TRÊN LỊCH DẠY ─── */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Truy cập nhanh</Text>
        </View>

        <View className="flex-row flex-wrap gap-md">
          {[
            {
              icon: 'fitness-center' as const,
              label: 'Lớp dạy',
              desc: 'Danh sách lớp phụ trách',
              route: '/(tabs)/classes' as const,
              color: Colors.primary,
              bgColor: '#A3E63518',
            },
            {
              icon: 'how-to-reg' as const,
              label: 'Điểm danh',
              desc: 'Điểm danh học viên',
              route: '/(tabs)/training' as const,
              color: '#10B981',
              bgColor: '#10B98118',
            },
            {
              icon: 'event' as const,
              label: 'Lịch dạy',
              desc: 'Thời khóa biểu tuần',
              route: '/(tabs)/schedule' as const,
              color: '#06B6D4',
              bgColor: '#06B6D418',
            },
            {
              icon: 'person' as const,
              label: 'Hồ sơ',
              desc: 'Thông tin cá nhân',
              route: '/(tabs)/profile' as const,
              color: '#8B5CF6',
              bgColor: '#8B5CF618',
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

      {/* ─── LỊCH DẠY SẮP TỚI ─── */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Lịch dạy sắp tới</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/training')} className="flex-row items-center gap-1">
            <Text className="text-sm text-primary font-bevn-medium">Điểm danh</Text>
            <Icon name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="mt-sm">
            <ClassCardSkeleton />
          </View>
        ) : teachingSchedules.length === 0 ? (
          <View className="bg-bg-surface rounded-xl p-xxxl items-center border border-border">
            <Icon name="event-available" size={44} color={Colors.text.muted} style={{ marginBottom: 12 }} />
            <Text className="text-text-muted text-sm font-bevn-regular mb-lg">Chưa có lịch dạy sắp tới</Text>
            <TouchableOpacity className="bg-primary rounded-md px-xl py-sm" onPress={() => router.push('/(tabs)/classes')}>
              <Text className="text-text-inverse font-bold font-bevn-bold">Xem danh sách lớp</Text>
            </TouchableOpacity>
          </View>
        ) : (
          teachingSchedules.slice(0, 5).map((s) => (
            <TouchableOpacity
              key={s.id}
              className="bg-bg-surface rounded-lg p-lg mb-md border border-border shadow-sm"
              onPress={() => router.push(`/schedule/${s.id}`)}
              activeOpacity={0.8}
            >
              <View className="flex-row justify-between items-center mb-xs">
                <View className="bg-[#A3E63518] px-sm py-0.5 rounded-sm">
                  <Text className="text-xs font-semibold font-bevn-semibold text-primary">{s.class?.sports?.map((sp) => sp.name).join(', ') || 'Môn thể thao'}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Icon name="schedule" size={13} color={Colors.primary} />
                  <Text className="text-xs text-primary font-semibold font-bevn-semibold">
                    {formatTime(s.startTime)} – {formatTime(s.endTime)}
                  </Text>
                </View>
              </View>

              <Text className="text-md font-bold font-bevn-bold text-text-primary my-1">{s.class?.name ?? 'Lớp học'}</Text>

              <View className="flex-row items-center flex-wrap gap-md mt-xs">
                <View className="flex-row items-center gap-1">
                  <Icon name="today" size={14} color={Colors.text.secondary} />
                  <Text className="text-xs text-text-secondary font-bevn-regular">{formatDate(s.startTime)}</Text>
                </View>
                {Boolean(s.room) && (
                  <View className="flex-row items-center gap-1">
                    <Icon name="place" size={14} color={Colors.text.secondary} />
                    <Text className="text-xs text-text-secondary font-bevn-regular">{s.room!.name}</Text>
                  </View>
                )}
                <View className="flex-row items-center gap-1">
                  <Icon name="people" size={14} color={Colors.primary} />
                  <Text className="text-xs font-semibold text-primary font-bevn-semibold">
                    {s._count?.enrollments ?? 0}{s.class?.capacity ? `/${s.class.capacity}` : ''} học viên
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ─── LỚP HỌC PHỤ TRÁCH ─── */}
      <View className="mb-xl">
        <View className="flex-row justify-between items-center mb-md">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary">Lớp học phụ trách</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/classes')} className="flex-row items-center gap-1">
            <Text className="text-sm text-primary font-bevn-medium">Tất cả lớp</Text>
            <Icon name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {classesLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
        ) : coachClasses.length === 0 ? (
          <View className="bg-bg-surface rounded-xl p-xxxl items-center border border-border">
            <Icon name="school" size={44} color={Colors.text.muted} style={{ marginBottom: 12 }} />
            <Text className="text-text-muted text-sm font-bevn-regular">Chưa được phân công lớp học nào</Text>
          </View>
        ) : (
          coachClasses.map((c) => (
            <TouchableOpacity
              key={c.id}
              className="bg-bg-surface rounded-lg p-lg mb-sm flex-row items-center justify-between border border-border"
              onPress={() => router.push(`/classes/${c.id}`)}
              activeOpacity={0.8}
            >
              <View className="flex-1 mr-sm">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-md font-semibold font-bevn-semibold text-text-primary flex-1 mr-sm">{c.name}</Text>
                  <View className="bg-bg-elevated px-sm py-0.5 rounded-full border border-border">
                    <Text className="text-[10px] text-text-secondary font-bevn-medium">
                      {CLASS_TYPE_LABEL[c.classType] ?? c.classType}
                    </Text>
                  </View>
                </View>
                {c.description ? (
                  <Text className="text-xs text-text-muted font-bevn-regular mb-xs" numberOfLines={2}>{c.description}</Text>
                ) : null}
                <View className="flex-row items-center gap-sm">
                  {Boolean(c.sports?.length) && (
                    <View className="flex-row items-center gap-[3px]">
                      <Icon name="fitness-center" size={12} color={Colors.text.secondary} />
                      <Text className="text-xs text-text-secondary font-bevn-regular">{c.sports!.map((s) => s.name).join(', ')}</Text>
                    </View>
                  )}
                  <View className="flex-row items-center gap-[3px]">
                    <Icon name="group" size={12} color={Colors.text.secondary} />
                    <Text className="text-xs text-text-secondary font-bevn-regular">Sức chứa: {c.capacity} học viên</Text>
                  </View>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.text.muted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
