// app/(tabs)/enrollments.tsx
// Tab "Lớp học" — Quản lý lớp đã đặt: Sắp tới | Hoàn thành | Đã hủy
// Member: xem ca học sắp tới, đổi buổi học, hủy đặt chỗ

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import clsx from 'clsx';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../components/shared/Icon';
import { ClassCardSkeleton } from '../../components/shared/Skeleton';
import {
  useMyEnrollments,
  useCancelEnrollment,
  useTransferEnrollment,
} from '../../hooks/member/useEnrollments';
import { api } from '../../lib/api';
import { Colors } from '../../constants/theme';
import type { Enrollment, ClassSchedule } from '../../lib/types';

// ─── Utils ───────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_LABELS[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

function EnrollmentCard({
  item,
  showActions,
  onCancel,
  onChangeSession,
  cancelPending,
}: {
  item: Enrollment;
  showActions: boolean;
  onCancel: (id: string, className?: string) => void;
  onChangeSession: (item: Enrollment) => void;
  cancelPending: boolean;
}) {
  const past = item.status === 'BOOKED' && isSchedulePast(item.schedule?.endTime);
  const statusColor = past ? Colors.text.muted : STATUS_COLOR[item.status] ?? Colors.text.muted;
  const statusLabel = past ? 'Đã diễn ra' : STATUS_LABEL[item.status] ?? item.status;

  const sports = item.schedule?.class?.sports?.map((s) => s.name).join(', ');
  const roomName = item.schedule?.room?.name;
  const coachName = item.schedule?.class?.coaches?.[0]?.coach?.user?.fullName;
  const className = item.schedule?.class?.name ?? 'Lớp học';

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

        {/* Actions — chỉ hiện cho buổi BOOKED chưa qua */}
        {showActions && item.status === 'BOOKED' && !past && (
          <View className="flex-row gap-sm pt-sm border-t border-divider mt-xs">
            {/* Đổi buổi: mở modal danh sách các buổi trống trong cùng lớp */}
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1 py-xs rounded-lg border border-border bg-bg-elevated"
              onPress={() => onChangeSession(item)}
              activeOpacity={0.8}
            >
              <Icon name="swap-horiz" size={15} color={Colors.text.secondary} />
              <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">
                Đổi buổi
              </Text>
            </TouchableOpacity>

            {/* Hủy đặt chỗ */}
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1 py-xs rounded-lg border border-[#EF444440] bg-[#EF444415]"
              onPress={() => onCancel(item.id, item.schedule?.class?.name)}
              disabled={cancelPending}
              activeOpacity={0.8}
            >
              <Icon name="cancel" size={15} color={Colors.status.cancelled} />
              <Text className="text-xs font-semibold font-bevn-semibold text-status-cancelled">
                Hủy đặt chỗ
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EnrollmentsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabMode>('upcoming');

  // Modal đổi buổi state
  const [transferEnrollmentTarget, setTransferEnrollmentTarget] = useState<Enrollment | null>(null);
  const [selectedTargetScheduleId, setSelectedTargetScheduleId] = useState<string | null>(null);

  // Refetch khi tab được focus lại
  const { data, isLoading, refetch } = useMyEnrollments(undefined, '100');
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const { handleCancel, isPending: cancelPending } = useCancelEnrollment();
  const transferMutation = useTransferEnrollment();

  const targetClassId =
    transferEnrollmentTarget?.schedule?.class?.id ??
    (transferEnrollmentTarget?.schedule?.classId as string | undefined);

  // Fetch available schedules for the class being transferred
  const {
    data: classSchedulesData,
    isLoading: isSchedulesLoading,
    refetch: refetchTransferSchedules,
  } = useQuery({
    queryKey: ['transfer-schedules', targetClassId],
    queryFn: () =>
      api.get<ClassSchedule[]>('/class-schedules', {
        classId: targetClassId,
        status: 'SCHEDULED',
        limit: '50',
      }),
    enabled: Boolean(transferEnrollmentTarget && targetClassId),
  });

  const availableSchedules = useMemo(() => {
    if (!classSchedulesData?.data || !transferEnrollmentTarget) return [];
    return classSchedulesData.data
      .filter((s) => s.id !== transferEnrollmentTarget.scheduleId && !isSchedulePast(s.endTime))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [classSchedulesData, transferEnrollmentTarget]);

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

  const handleOpenTransferModal = (enrollment: Enrollment) => {
    setTransferEnrollmentTarget(enrollment);
    setSelectedTargetScheduleId(null);
  };

  const handleCloseTransferModal = () => {
    if (transferMutation.isPending) return;
    setTransferEnrollmentTarget(null);
    setSelectedTargetScheduleId(null);
  };

  const handleConfirmTransfer = () => {
    if (!transferEnrollmentTarget || !selectedTargetScheduleId) return;
    transferMutation.mutate(
      {
        id: transferEnrollmentTarget.id,
        targetScheduleId: selectedTargetScheduleId,
      },
      {
        onSuccess: () => {
          handleCloseTransferModal();
          refetch();
        },
      }
    );
  };

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
      subtitle: 'Lịch sử các ca học bạn đã hủy sẽ hiển thị tại đây',
      showExplore: false,
    },
  }[activeTab];

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View
        className={clsx(
          'flex-row justify-between items-center px-md pb-sm bg-bg-surface border-b border-border mb-md',
          Platform.OS === 'ios' ? 'pt-[52px]' : Platform.OS === 'android' ? 'pt-[42px]' : 'pt-[14px]'
        )}
      >
        <TouchableOpacity
          className="w-10 h-10 justify-center items-center rounded-full"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View className="flex-1 items-center px-xs">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary text-center">Lớp học</Text>
          <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular text-center" numberOfLines={1}>
            Quản lý các lớp học đã đăng ký của bạn
          </Text>
        </View>
        <View className="w-10 h-10" />
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
                      isActive ? 'bg-[#00000030]' : 'bg-[#A3E63525]'
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
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
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
                  onPress={() => router.push('/(tabs)/classes')}
                  activeOpacity={0.85}
                >
                  <Icon name="explore" size={16} color={Colors.text.inverse} />
                  <Text className="text-sm font-bevn-bold text-text-inverse">Khám phá lớp học</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <EnrollmentCard
              item={item}
              showActions={activeTab === 'upcoming'}
              onCancel={handleCancel}
              onChangeSession={handleOpenTransferModal}
              cancelPending={cancelPending}
            />
          )}
        />
      )}

      {/* ─── MODAL ĐỔI BUỔI TRONG CÙNG LỚP ────────────────────────────────────── */}
      <Modal
        visible={Boolean(transferEnrollmentTarget)}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseTransferModal}
      >
        <View className="flex-1 bg-black/75 justify-center items-center px-md py-xl">
          <View className="bg-bg-surface w-full max-w-lg rounded-2xl border border-border overflow-hidden shadow-xl max-h-[85%] flex-col">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center px-lg py-md border-b border-border bg-bg-elevated">
              <View className="flex-1 pr-sm">
                <Text className="text-md font-bold font-bevn-bold text-text-primary">
                  Đổi buổi trong cùng lớp
                </Text>
                <Text className="text-xs text-primary font-bevn-medium mt-0.5" numberOfLines={1}>
                  {transferEnrollmentTarget?.schedule?.class?.name ?? 'Lớp học'}
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-bg-card items-center justify-center border border-border"
                onPress={handleCloseTransferModal}
                disabled={transferMutation.isPending}
              >
                <Icon name="close" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Note */}
            <View className="px-lg pt-md pb-xs">
              <View className="bg-[#A3E63510] border border-[#A3E63530] rounded-lg p-sm flex-row items-start gap-2">
                <Icon name="info" size={16} color={Colors.primary} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-text-secondary font-bevn-regular leading-4">
                  Chọn một buổi học khác còn trống. Buổi học cũ chỉ được hủy khi máy chủ xác nhận chỗ mới thành công.
                </Text>
              </View>
            </View>

            {/* Schedules List */}
            <ScrollView
              className="flex-1 px-lg py-sm"
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {isSchedulesLoading ? (
                <View className="py-xl items-center justify-center">
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text className="text-xs text-text-secondary font-bevn-regular mt-2">
                    Đang tìm các buổi học trống...
                  </Text>
                </View>
              ) : availableSchedules.length === 0 ? (
                <View className="py-xl items-center justify-center gap-2">
                  <Icon name="event-busy" size={40} color={Colors.text.muted} />
                  <Text className="text-sm font-bevn-medium text-text-secondary text-center">
                    Hiện chưa có buổi khác còn trống để chuyển.
                  </Text>
                  <Text className="text-xs text-text-muted font-bevn-regular text-center">
                    Vui lòng thử lại sau hoặc giữ nguyên lịch học hiện tại.
                  </Text>
                </View>
              ) : (
                availableSchedules.map((sch) => {
                  const count = sch._count?.enrollments ?? 0;
                  const capacity = sch.class?.capacity ?? 20;
                  const remaining = Math.max(0, capacity - count);
                  const isFull = sch.status !== 'SCHEDULED' || remaining <= 0;
                  const isSelected = selectedTargetScheduleId === sch.id;

                  return (
                    <TouchableOpacity
                      key={sch.id}
                      className={clsx(
                        'p-md rounded-xl border flex-row items-center gap-md',
                        isSelected
                          ? 'border-primary bg-[#A3E63512]'
                          : isFull
                          ? 'border-border bg-bg-card opacity-50'
                          : 'border-border bg-bg-elevated'
                      )}
                      onPress={() => {
                        if (!isFull) {
                          setSelectedTargetScheduleId(sch.id);
                        }
                      }}
                      disabled={isFull || transferMutation.isPending}
                      activeOpacity={0.7}
                    >
                      {/* Radio Icon */}
                      <Icon
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={isSelected ? Colors.primary : isFull ? Colors.text.muted : Colors.text.secondary}
                      />

                      {/* Info */}
                      <View className="flex-1">
                        <Text className="text-xs font-bold font-bevn-bold text-text-primary">
                          {formatDate(sch.startTime)}
                        </Text>
                        <Text className="text-xs text-text-secondary font-bevn-medium mt-0.5">
                          {formatTime(sch.startTime)} – {formatTime(sch.endTime)}
                          {sch.room?.name ? ` · ${sch.room.name}` : ''}
                        </Text>
                      </View>

                      {/* Slot Badge */}
                      <View
                        className={clsx(
                          'rounded-full px-sm py-[3px]',
                          isFull ? 'bg-[#6B728020]' : 'bg-[#A3E63520]'
                        )}
                      >
                        <Text
                          className={clsx(
                            'text-xs font-semibold font-bevn-semibold',
                            isFull ? 'text-text-muted' : 'text-primary'
                          )}
                        >
                          {isFull ? 'Hết chỗ' : `Còn ${remaining} chỗ`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View className="flex-row gap-sm px-lg py-md border-t border-border bg-bg-elevated">
              <TouchableOpacity
                className="flex-1 py-sm rounded-xl border border-border bg-bg-card items-center justify-center"
                onPress={handleCloseTransferModal}
                disabled={transferMutation.isPending}
                activeOpacity={0.8}
              >
                <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">
                  Giữ buổi hiện tại
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={clsx(
                  'flex-1 py-sm rounded-xl items-center justify-center flex-row gap-1',
                  !selectedTargetScheduleId || transferMutation.isPending
                    ? 'bg-primary/40'
                    : 'bg-primary'
                )}
                onPress={handleConfirmTransfer}
                disabled={!selectedTargetScheduleId || transferMutation.isPending}
                activeOpacity={0.85}
              >
                {transferMutation.isPending && (
                  <ActivityIndicator size="small" color={Colors.text.inverse} />
                )}
                <Text className="text-xs font-bold font-bevn-bold text-text-inverse">
                  {transferMutation.isPending ? 'Đang đổi buổi...' : 'Xác nhận đổi'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

