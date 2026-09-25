import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useRouter, useFocusEffect } from 'expo-router';
import { Icon } from '../shared/Icon';
import { useMyEnrollments, useCancelEnrollment } from '../../hooks/member/useEnrollments';
import { Colors } from '../../constants/theme';
import type { Enrollment } from '../../lib/types';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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


function isSchedulePast(endTime?: string) {
  return Boolean(endTime) && new Date(endTime!) < new Date();
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date) {
  return isSameDay(d, new Date());
}

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const weekday = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
  return `${weekday}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDayMonth(d: Date) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function MemberScheduleView() {
  const router = useRouter();
  const [mode, setMode] = useState<'week' | 'list'>('week');
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Mỗi lần quay lại tab này (kể cả sau khi chuyển sang tab khác rồi quay lại)
  // đều nhảy về đúng tuần/ngày hiện tại, không giữ lại tuần đã xem trước đó.
  useFocusEffect(
    useCallback(() => {
      setSelectedDay(new Date());
    }, [])
  );

  // Lấy toàn bộ enrollment (không lọc status ở BE) rồi tự chia thành 2 nhóm ở
  // client — vừa gom được cả buổi BOOKED-nhưng-đã-qua vào "Danh sách", vừa
  // tránh phải gọi nhiều request theo từng status.
  const { data, isLoading, refetch } = useMyEnrollments(undefined, '100');
  const { handleCancel, isPending: cancelPending } = useCancelEnrollment();

  const all: Enrollment[] = data?.data ?? [];

  const upcomingBooked = useMemo(
    () => all.filter((e) => e.status === 'BOOKED' && e.schedule),
    [all]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDay);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDay]);

  const historyItems = useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.status === 'CANCELLED' ||
            e.status === 'COMPLETED' ||
            (e.status === 'BOOKED' && isSchedulePast(e.schedule?.endTime))
        )
        .sort(
          (a, b) =>
            new Date(b.schedule?.startTime ?? b.bookedAt).getTime() -
            new Date(a.schedule?.startTime ?? a.bookedAt).getTime()
        ),
    [all]
  );

  const renderCard = (item: Enrollment, { showCancel }: { showCancel: boolean }) => {
    const past = item.status === 'BOOKED' && isSchedulePast(item.schedule?.endTime);
    const statusColor = past ? Colors.text.muted : STATUS_COLOR[item.status];
    const statusLabel = past ? 'Đã diễn ra' : STATUS_LABEL[item.status];

    return (
      <TouchableOpacity
        className="bg-bg-surface rounded-xl border border-border overflow-hidden"
        onPress={() => item.scheduleId && router.push(`/schedule/${item.scheduleId}`)}
        activeOpacity={0.8}
      >
        {Boolean(item.schedule) && (
          <View className="bg-bg-elevated px-lg py-sm flex-row justify-between items-center">
            <Text className="text-sm font-semibold font-bevn-semibold text-primary">{formatDate(item.schedule!.startTime)}</Text>
            <Text className="text-sm text-text-secondary font-bevn-regular">
              {formatTime(item.schedule!.startTime)} – {formatTime(item.schedule!.endTime)}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-start p-lg">
          <View className="flex-1 mr-md">
            <Text className="text-md font-bold font-bevn-bold text-text-primary mb-1">{item.schedule?.class?.name ?? 'Lớp học'}</Text>
            {Boolean(item.schedule?.room) && (
              <View className="flex-row items-center gap-1 mb-1">
                <Icon name="place" size={14} color={Colors.text.secondary} />
                <Text className="text-sm text-text-secondary font-bevn-regular">{item.schedule!.room!.name}</Text>
              </View>
            )}
            <Text className="text-xs text-text-muted font-bevn-regular">Đặt lúc: {formatDateTime(item.bookedAt)}</Text>
          </View>

          <View className="items-end gap-sm">
            <View className="rounded-full px-sm py-[3px]" style={{ backgroundColor: statusColor + '20' }}>
              <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: statusColor }}>{statusLabel}</Text>
            </View>
            {showCancel && item.status === 'BOOKED' && !past && (
              <TouchableOpacity
                className="bg-[#EF444420] rounded-md px-md py-xs"
                onPress={() => handleCancel(item.id, item.schedule?.class?.name)}
                disabled={cancelPending}
              >
                <Text className="text-xs text-status-failed font-semibold font-bevn-semibold">Hủy</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <Text className="text-lg font-bold font-bevn-bold text-text-primary text-center">Lịch tập cá nhân</Text>
          <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular text-center" numberOfLines={1}>
            Thời khóa biểu các ca học đã đặt của bạn theo tuần
          </Text>
        </View>
        <View className="w-10 h-10" />
      </View>

      {/* Mode tabs */}
      <View className="flex-row px-xl gap-sm mb-sm">
        <TouchableOpacity
          className={clsx('flex-1 py-xs rounded-md items-center border', mode === 'week' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
          onPress={() => setMode('week')}
        >
          <Text className={clsx('text-sm font-bevn-medium', mode === 'week' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>Lịch tuần</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={clsx('flex-1 py-xs rounded-md items-center border', mode === 'list' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
          onPress={() => setMode('list')}
        >
          <Text className={clsx('text-sm font-bevn-medium', mode === 'list' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>Danh sách</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : mode === 'week' ? (
        <>
          {/* Khung điều hướng tháng — cùng kiểu kẻ ngang với khung thứ/ngày bên dưới, không đóng khung */}
          <View className="px-xl mt-sm pt-md pb-md border-t border-divider">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity className="p-xs" onPress={() => setSelectedDay((d) => addDays(d, -7))}>
                <Icon name="arrow-back" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
              <View className="flex-1 items-center">
                <Text className="text-md font-bold font-bevn-bold text-text-primary">
                  {formatDayMonth(weekDays[0])} – {formatDayMonth(weekDays[6])}/{weekDays[6].getFullYear()}
                </Text>
              </View>
              <TouchableOpacity className="p-xs" onPress={() => setSelectedDay((d) => addDays(d, 7))}>
                <Icon name="arrow-forward" size={18} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Thứ/ô ngày — dùng kẻ ngang phân cách với khung điều hướng tháng ở trên, không đóng khung */}
          <View className="px-xl pt-md pb-md border-t border-b border-divider">
            <View className="flex-row mb-0.5">
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} className="flex-1 text-center text-xs text-text-muted font-bevn-semibold uppercase">{label}</Text>
              ))}
            </View>

            {/* Hàng số ngày — chấm nhỏ báo ngày có lớp, khoanh tròn báo ngày đang chọn/hôm nay */}
            <View className="flex-row">
              {weekDays.map((d) => {
                const selected = isSameDay(d, selectedDay);
                const hasClass = upcomingBooked.some((e) => isSameDay(new Date(e.schedule!.startTime), d));
                return (
                  <TouchableOpacity key={d.toISOString()} className="flex-1 items-center gap-0.5" onPress={() => setSelectedDay(d)}>
                    <View
                      className={clsx(
                        'w-7 h-7 rounded-full items-center justify-center border',
                        selected ? 'bg-primary border-transparent' : isToday(d) ? 'border-primary' : 'border-transparent'
                      )}
                    >
                      <Text className={clsx('text-sm font-semibold font-bevn-semibold', selected ? 'text-text-inverse font-bevn-bold' : 'text-text-primary')}>{d.getDate()}</Text>
                    </View>
                    <View className={clsx('w-[5px] h-[5px] rounded-[3px]', hasClass ? 'bg-primary' : 'bg-transparent')} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Agenda theo tuần — chỉ khối này cuộn riêng, mỗi thứ 1 dòng */}
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          >
            {weekDays.map((d, i) => {
              const selected = isSameDay(d, selectedDay);
              const dayClasses = upcomingBooked
                .filter((e) => isSameDay(new Date(e.schedule!.startTime), d))
                .sort((a, b) => new Date(a.schedule!.startTime).getTime() - new Date(b.schedule!.startTime).getTime());
              const hasClasses = dayClasses.length > 0;

              return (
                <View key={d.toISOString()} className="flex-row mb-md">
                  <View className="w-14">
                    <Text className={clsx('text-sm font-bold font-bevn-bold', selected ? 'text-primary' : 'text-text-primary')}>
                      {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                    </Text>
                    <Text className="text-xs text-text-muted font-bevn-regular">{WEEKDAY_LABELS[i]}</Text>
                  </View>

                  {hasClasses && <View className="w-0.5 bg-[#A3E63550] rounded-sm mr-md" />}

                  <View className="flex-1 gap-sm">
                    {!hasClasses ? (
                      <Text className="text-sm text-text-muted mt-0.5 font-bevn-regular italic">Nghỉ tập</Text>
                    ) : (
                      dayClasses.map((e) => {
                        const past = isSchedulePast(e.schedule?.endTime);
                        return (
                          <TouchableOpacity
                            key={e.id}
                            className="flex-row items-center gap-sm p-md rounded-md bg-[#A3E63515] border border-[#A3E63540]"
                            activeOpacity={0.8}
                            onPress={() => e.scheduleId && router.push(`/schedule/${e.scheduleId}`)}
                          >
                            <View className="flex-1 gap-0.5">
                              <Text className="text-sm font-bold font-bevn-bold text-text-primary" numberOfLines={1}>
                                {e.schedule?.class?.name ?? 'Lớp học'}
                              </Text>
                              <View className="flex-row items-center gap-1">
                                <Icon name="schedule" size={12} color={Colors.primaryDark} />
                                <Text className="text-xs text-primaryDark font-bevn-semibold">
                                  {formatTime(e.schedule!.startTime)} – {formatTime(e.schedule!.endTime)}
                                </Text>
                              </View>
                              {Boolean(e.schedule?.room) && (
                                <View className="flex-row items-center gap-1">
                                  <Icon name="place" size={12} color={Colors.primaryDark} />
                                  <Text className="text-xs text-text-secondary font-bevn-regular">{e.schedule!.room!.name}</Text>
                                </View>
                              )}
                            </View>
                            {past ? (
                              <Text className="text-xs text-text-muted font-bevn-regular">Đã diễn ra</Text>
                            ) : (
                              <TouchableOpacity
                                className="bg-[#EF444420] rounded-sm px-sm py-1"
                                onPress={() => handleCancel(e.id)}
                                disabled={cancelPending}
                              >
                                <Text className="text-xs text-status-failed font-semibold font-bevn-semibold">Hủy</Text>
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View className="items-center mt-[60px]">
              <Icon name="event-busy" size={48} color={Colors.text.muted} style={{ marginBottom: 12 }} />
              <Text className="text-sm text-text-muted font-bevn-regular">Chưa có buổi học đã qua hoặc đã hủy</Text>
            </View>
          }
          renderItem={({ item }) => renderCard(item, { showCancel: false })}
        />
      )}
    </View>
  );
}
