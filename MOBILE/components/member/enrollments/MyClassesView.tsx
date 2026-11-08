import { vietnamDate } from '../../../lib/date';
// app/(tabs)/enrollments.tsx
// Tab "Lớp học" — Lớp đã đặt: Sắp tới | Hoàn thành | Đã hủy (web: MyClassesPage)
// Giống web: mỗi lớp chỉ có nút "Xem lớp"; hội viên không tự hủy hay đổi buổi — cần hỗ trợ lịch thì liên hệ lễ tân.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import clsx from 'clsx';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from '../../../components/shared/Icon';
import { ScreenHeader } from '../../../components/shared/ScreenHeader';
import { ClassCardSkeleton } from '../../../components/shared/Skeleton';
import { useMyEnrollments, useMyQuota } from '../../../hooks/member/useEnrollments';
import { Colors } from '../../../constants/theme';
import type { Enrollment } from '../../../lib/types';
import { ROUTES } from '../../../navigation/routes';
import { Button } from '../../ui';
import { ENROLLMENT_QUOTA_TEXT, MY_CLASSES_TEXT } from '../../../constants/classes';
import { TIER_LABEL } from '../../../constants/membership';
import { quotaBannerKind } from '../../../lib/classPlan';

// ─── Utils ───────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_LABELS[vietnamDate(d).getUTCDay()]}, ${pad2(vietnamDate(d).getUTCDate())}/${pad2(vietnamDate(d).getUTCMonth() + 1)}/${vietnamDate(d).getUTCFullYear()}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(vietnamDate(d).getUTCHours())}:${pad2(vietnamDate(d).getUTCMinutes())}`;
}
function isSchedulePast(endTime?: string) {
  return Boolean(endTime) && new Date(endTime!) < new Date();
}

type TabMode = 'upcoming' | 'completed' | 'cancelled';

const STATUS_COLOR: Record<string, string> = {
  BOOKED: Colors.status.booked,
  COMPLETED: Colors.status.completed,
  CANCELLED: Colors.status.cancelled,
};
const STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Đã đặt',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

// ─── Enrollment Card ─────────────────────────────────────────────────────────

function EnrollmentCard({ item, onViewClass }: { item: Enrollment; onViewClass: (classId: string) => void }) {
  const past = item.status === 'BOOKED' && isSchedulePast(item.schedule?.endTime);
  const statusColor = past ? Colors.text.muted : STATUS_COLOR[item.status] ?? Colors.text.muted;
  const statusLabel = past ? 'Đã diễn ra' : STATUS_LABEL[item.status] ?? item.status;

  const sports = item.schedule?.class?.sports?.map((s) => s.name).join(', ');
  const roomName = item.schedule?.room?.name;
  const coachName = item.schedule?.class?.coaches?.[0]?.coach?.user?.fullName;
  const className = item.schedule?.class?.name ?? 'Lớp học';
  const classId = item.classId ?? item.schedule?.classId ?? item.schedule?.class?.id;

  return (
    <View className="bg-bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Schedule Time Banner */}
      {Boolean(item.schedule) && (
        <View className="bg-bg-elevated px-lg py-xs flex-row justify-between items-center border-b border-border">
          <View className="flex-row items-center gap-1">
            <Icon name="event" size={13} color={Colors.primary} />
            <Text className="text-xs font-semibold font-bevn-semibold text-primary">
              {formatDate(item.schedule!.startTime)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon name="schedule" size={13} color={Colors.text.secondary} />
            <Text className="text-xs text-text-secondary font-bevn-regular">
              {formatTime(item.schedule!.startTime)} – {formatTime(item.schedule!.endTime)}
            </Text>
          </View>
        </View>
      )}

      {/* Main Card Body */}
      <View className="p-lg gap-sm">
        {/* Class Name + Sport Tag */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-sm">
            <Text className="text-md font-bold font-bevn-bold text-text-primary mb-0.5">
              {className}
            </Text>
            {Boolean(sports) && (
              <Text className="text-xs text-primary font-bevn-medium">{sports}</Text>
            )}
          </View>

          {/* Status badge */}
          <View
            className="rounded-full px-sm py-[3px]"
            style={{ backgroundColor: statusColor + '22' }}
          >
            <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Coach & Room info */}
        <View className="flex-row items-center flex-wrap gap-md">
          {Boolean(coachName) && (
            <View className="flex-row items-center gap-1">
              <Icon name="person" size={13} color={Colors.text.muted} />
              <Text className="text-xs text-text-secondary font-bevn-regular">HLV: {coachName}</Text>
            </View>
          )}
          {Boolean(roomName) && (
            <View className="flex-row items-center gap-1">
              <Icon name="place" size={13} color={Colors.text.muted} />
              <Text className="text-xs text-text-secondary font-bevn-regular">{roomName}</Text>
            </View>
          )}
        </View>

        {/* Xem lớp — mở chi tiết lớp (kế hoạch khóa, mục tiêu & tiến độ); hội viên không tự hủy hay đổi buổi như web */}
        {Boolean(classId) && (
          <View className="flex-row pt-sm border-t border-divider mt-xs">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${MY_CLASSES_TEXT.viewClass} ${className}`}
              className="flex-1 flex-row items-center justify-center gap-1 py-xs rounded-lg border border-border bg-bg-elevated"
              onPress={() => onViewClass(classId!)}
              activeOpacity={0.8}
            >
              <Icon name="class" size={15} color={Colors.text.secondary} />
              <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">
                {MY_CLASSES_TEXT.viewClass}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Support note ────────────────────────────────────────────────────────────

/** Dưới tab "Sắp tới" (web: khối "Nếu cần hỗ trợ về lịch học, vui lòng liên hệ lễ tân cơ sở.") */
function SupportNote() {
  return (
    <View
      className="flex-row items-center gap-sm rounded-lg px-md py-sm border mt-sm"
      style={{ backgroundColor: Colors.status.pending + '12', borderColor: Colors.status.pending + '40' }}
    >
      <Icon name="warning" size={14} color={Colors.status.pending} />
      <Text className="flex-1 text-xs text-text-secondary font-bevn-regular leading-[18px]">{MY_CLASSES_TEXT.supportNote}</Text>
    </View>
  );
}

// ─── Quota Banner ─────────────────────────────────────────────────────────────

function QuotaBanner() {
  const router = useRouter();
  const { data: quota, isLoading } = useMyQuota();
  if (isLoading || !quota) return null;

  const kind = quotaBannerKind(quota);
  if (kind === 'locked') {
    return (
      <View className="mx-xl mb-sm rounded-xl p-lg border gap-sm" style={{ backgroundColor: Colors.status.pending + '12', borderColor: Colors.status.pending + '40' }}>
        <View className="flex-row items-center gap-sm">
          <Icon name="lock-outline" size={18} color={Colors.status.pending} />
          <Text className="flex-1 text-md text-text-primary font-bevn-bold">{ENROLLMENT_QUOTA_TEXT.lockedTitle}</Text>
        </View>
        <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">
          {quota.tier === 'FREE' ? ENROLLMENT_QUOTA_TEXT.lockedFree : ENROLLMENT_QUOTA_TEXT.lockedNoPlan}
        </Text>
        <Button title={ENROLLMENT_QUOTA_TEXT.viewPlans} icon="card-membership" size="sm" block={false} className="self-start" onPress={() => router.push(ROUTES.membershipPlans)} />
      </View>
    );
  }

  const color = kind === 'full' ? Colors.status.cancelled : Colors.status.active;
  const tierLabel = quota.tier ? TIER_LABEL[quota.tier] : null;
  return (
    <View className="mx-xl mb-sm rounded-xl p-lg border gap-xs" style={{ backgroundColor: color + '10', borderColor: color + '30' }}>
      <View className="flex-row items-start gap-md">
        <View className="flex-1 gap-xs">
          <Text className="text-md text-text-primary font-bevn-bold">
            {ENROLLMENT_QUOTA_TEXT.title}{tierLabel ? ` · Gói ${tierLabel}` : ''}
          </Text>
          <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">
            {kind === 'full' ? ENROLLMENT_QUOTA_TEXT.full : ENROLLMENT_QUOTA_TEXT.remaining(quota.remaining)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xl font-bevn-bold" style={{ color }}>
            {quota.used}<Text className="text-sm text-text-muted font-bevn-medium"> / {quota.limit}</Text>
          </Text>
          <Text className="text-xs text-text-muted font-bevn-regular">{ENROLLMENT_QUOTA_TEXT.usedLabel}</Text>
        </View>
      </View>
      <Text className="text-xs text-text-muted font-bevn-regular leading-[18px]">{ENROLLMENT_QUOTA_TEXT.note}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

/** Lớp của tôi (web: MyClassesPage). `embedded`: nằm trong tab Lịch (ẩn header riêng). */
export function MyClassesView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabMode>('upcoming');

  // Refetch khi tab được focus lại
  const { data, isLoading, refetch } = useMyEnrollments(undefined, '100');
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const all: Enrollment[] = data?.data ?? [];

  // 1. Sắp tới: BOOKED và buổi học chưa kết thúc
  const upcoming = useMemo(
    () =>
      all
        .filter((e) => e.status === 'BOOKED' && !isSchedulePast(e.schedule?.endTime))
        .sort(
          (a, b) =>
            new Date(a.schedule?.startTime ?? a.bookedAt).getTime() -
            new Date(b.schedule?.startTime ?? b.bookedAt).getTime(),
        ),
    [all],
  );

  // 2. Hoàn thành: COMPLETED hoặc buổi BOOKED đã kết thúc
  const completed = useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.status === 'COMPLETED' ||
            (e.status === 'BOOKED' && isSchedulePast(e.schedule?.endTime)),
        )
        .sort(
          (a, b) =>
            new Date(b.schedule?.startTime ?? b.bookedAt).getTime() -
            new Date(a.schedule?.startTime ?? a.bookedAt).getTime(),
        ),
    [all],
  );

  // 3. Đã hủy: CANCELLED
  const cancelled = useMemo(
    () =>
      all
        .filter((e) => e.status === 'CANCELLED')
        .sort(
          (a, b) =>
            new Date(b.schedule?.startTime ?? b.bookedAt).getTime() -
            new Date(a.schedule?.startTime ?? a.bookedAt).getTime(),
        ),
    [all],
  );

  const displayData =
    activeTab === 'upcoming'
      ? upcoming
      : activeTab === 'completed'
      ? completed
      : cancelled;

  const emptyInfo = {
    upcoming: {
      icon: 'event-note' as const,
      title: 'Chưa có lớp sắp tới',
      subtitle: 'Hãy khám phá và đăng ký lớp học mới ngay!',
      showExplore: true,
    },
    completed: {
      icon: 'check-circle' as const,
      title: 'Chưa có lớp hoàn thành',
      subtitle: 'Các buổi tập bạn đã hoàn thành sẽ hiển thị tại đây',
      showExplore: false,
    },
    cancelled: {
      icon: 'event-busy' as const,
      title: 'Chưa có lớp đã hủy',
      subtitle: 'Lịch sử các ca học đã hủy sẽ hiển thị tại đây',
      showExplore: false,
    },
  }[activeTab];

  return (
    <View className="flex-1 bg-bg-primary">
      {!embedded && <ScreenHeader title="Lớp của tôi" />}


      {/* Quota chip — hiện số slot còn lại */}
      <View className="pt-xl">
        <QuotaBanner />
      </View>

      {/* Tab switcher: 3 tabs — Sắp tới, Hoàn thành, Đã hủy */}
      <View className="flex-row px-xl gap-sm mb-md">
        {(
          [
            { id: 'upcoming', label: 'Sắp tới', icon: 'event-available', count: upcoming.length },
            { id: 'completed', label: 'Hoàn thành', icon: 'check-circle', count: completed.length },
            { id: 'cancelled', label: 'Đã hủy', icon: 'cancel', count: cancelled.length },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              className={clsx(
                'flex-1 py-xs px-1 rounded-lg items-center justify-center border',
                isActive ? 'bg-primary border-primary' : 'bg-bg-surface border-border'
              )}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <View className="flex-row items-center justify-center gap-1">
                <Icon
                  name={tab.icon}
                  size={13}
                  color={isActive ? Colors.text.inverse : Colors.text.secondary}
                />
                <Text
                  className={clsx(
                    'text-xs font-bevn-semibold',
                    isActive ? 'text-text-inverse font-bevn-bold' : 'text-text-secondary'
                  )}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    className={clsx(
                      'rounded-full min-w-[16px] h-4 px-1 items-center justify-center',
                      isActive ? 'bg-[#00000030]' : 'bg-[#D4FF0025]'
                    )}
                  >
                    <Text
                      className={clsx(
                        'text-[9px] font-bevn-bold leading-[12px]',
                        isActive ? 'text-text-inverse' : 'text-primary'
                      )}
                    >
                      {tab.count > 99 ? '99+' : tab.count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="px-xl pt-sm">
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => { void refetch(); }} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View className="items-center mt-[60px]">
              <Icon
                name={emptyInfo.icon}
                size={56}
                color={Colors.text.muted}
                style={{ marginBottom: 14 }}
              />
              <Text className="text-md font-bevn-semibold text-text-secondary mb-1">
                {emptyInfo.title}
              </Text>
              <Text className="text-sm text-text-muted font-bevn-regular text-center px-xl">
                {emptyInfo.subtitle}
              </Text>
              {emptyInfo.showExplore && (
                <TouchableOpacity
                  className="mt-lg flex-row items-center gap-1 bg-primary rounded-lg px-xl py-sm"
                  onPress={() => router.push(ROUTES.classes)}
                  activeOpacity={0.85}
                >
                  <Icon name="explore" size={16} color={Colors.text.inverse} />
                  <Text className="text-sm font-bevn-bold text-text-inverse">Khám phá lớp học</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={activeTab === 'upcoming' ? <SupportNote /> : undefined}
          renderItem={({ item }) => (
            <EnrollmentCard item={item} onViewClass={(classId) => router.push(ROUTES.classDetail(classId))} />
          )}
        />
      )}
    </View>
  );
}
