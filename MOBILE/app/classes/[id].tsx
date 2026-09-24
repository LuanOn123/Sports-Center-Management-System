import React from 'react';
import {
  View, Text, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/shared/Icon';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { CoachRating } from '../../components/shared/CoachRating';
import type { Class, ClassSchedule, Enrollment, EnrollmentStatus } from '../../lib/types';
import { Colors } from '../../constants/theme';

const TYPE_LABEL: Record<string, string> = { REGULAR: 'Tiêu Chuẩn', PREMIUM: 'Cao Cấp' };

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/classes');
  };

  const { data: classData, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: () => api.get<Class>(`/classes/${id}`),
    enabled: Boolean(id),
  });

  const { data: schedulesData, isLoading: schedLoading } = useQuery({
    queryKey: ['class-schedules', id],
    queryFn: () => api.get<ClassSchedule[]>('/class-schedules', {
      classId: id,
      status: 'SCHEDULED',
      limit: '10',
    }),
    enabled: Boolean(id),
  });

  // Lấy danh sách enrollments của user để check trạng thái từng schedule (BOOKED, CANCELLED)
  const { data: enrollmentsData } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { limit: '100' }),
  });

  const bookMutation = useMutation({
    mutationFn: (scheduleId: string) => api.post('/enrollments', { scheduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      showAlert('Đặt lịch thành công', 'Lịch học đã được thêm vào danh sách của bạn.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Đặt lịch thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  const cls = classData?.data;
  const targetCoach = cls?.coaches?.find((c) => c.isPrimary) ?? cls?.coaches?.[0];
  const schedules = schedulesData?.data ?? [];
  // Map scheduleId -> status ('BOOKED' | 'CANCELLED' | 'COMPLETED')
  const userEnrollmentMap = new Map<string, EnrollmentStatus>();
  (enrollmentsData?.data ?? []).forEach((e) => {
    if (!userEnrollmentMap.has(e.scheduleId) || e.status === 'BOOKED') {
      userEnrollmentMap.set(e.scheduleId, e.status);
    }
  });

  const topNav = (
    <View
      className={clsx(
        'flex-row items-center px-md pb-sm bg-bg-surface border-b border-border',
        Platform.OS === 'ios' ? 'pt-[52px]' : Platform.OS === 'android' ? 'pt-[42px]' : 'pt-[14px]'
      )}
    >
      <TouchableOpacity className="w-10 h-10 justify-center items-center rounded-full" onPress={handleGoBack}>
        <Icon name="arrow-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text className="text-lg font-bold font-bevn-bold text-text-primary ml-sm" numberOfLines={1}>
        {cls?.name ?? 'Chi tiết lớp học'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg-primary">
        {topNav}
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!cls) {
    return (
      <View className="flex-1 bg-bg-primary">
        {topNav}
        <View className="flex-1 justify-center items-center">
          <Text className="text-text-muted text-md font-bevn-regular">Không tìm thấy lớp học</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-primary">
      {topNav}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      {/* Class Info */}
      <View className="bg-bg-surface rounded-xl p-xl mb-xl border border-border">
        <View className="flex-row justify-between items-start mb-sm">
          <Text className="flex-1 text-xxl font-bold font-bevn-bold text-text-primary mr-sm">{cls.name}</Text>
          <View className={clsx('rounded-full px-sm py-[3px]', cls.classType === 'PREMIUM' ? 'bg-[#F59E0B20]' : 'bg-[#3B82F620]')}>
            <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">{TYPE_LABEL[cls.classType]}</Text>
          </View>
        </View>
        {Boolean(cls.sports?.length) && (
          <View className="flex-row items-center gap-1 mb-xs">
            <Icon name="sports" size={16} color={Colors.primary} />
            <Text className="text-sm text-text-secondary font-bevn-regular">{cls.sports!.map((s) => s.name).join(', ')}</Text>
          </View>
        )}
        {Boolean(cls.description) && <Text className="text-sm text-text-secondary leading-[22px] mb-lg font-bevn-regular">{cls.description}</Text>}
        <View className="flex-row justify-around pt-lg border-t border-divider">
          <View className="items-center">
            <Text className="text-xxl font-bold font-bevn-bold text-primary">{cls.capacity}</Text>
            <Text className="text-xs text-text-muted font-bevn-regular mt-0.5">Sĩ số tối đa</Text>
          </View>
          <View className="w-px bg-divider" />
          <View className="items-center">
            <Text className="text-xxl font-bold font-bevn-bold text-primary">{cls.coaches?.length ?? 0}</Text>
            <Text className="text-xs text-text-muted font-bevn-regular mt-0.5">Huấn luyện viên</Text>
          </View>
        </View>
      </View>

      {/* Coaches */}
      {Boolean(cls.coaches && cls.coaches.length > 0) && (
        <View className="mb-xl">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Huấn Luyện Viên</Text>
          {cls.coaches!.map((c) => (
            <View key={c.coachId} className="flex-row bg-bg-surface rounded-lg p-lg mb-sm border border-border">
              <View className="w-12 h-12 rounded-full bg-bg-elevated justify-center items-center mr-md">
                <Text className="text-xl font-bold font-bevn-bold text-primary">{c.coach?.user?.fullName?.charAt(0) ?? '?'}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-sm mb-1">
                  <Text className="text-md font-bold font-bevn-bold text-text-primary">{c.coach?.user?.fullName ?? '—'}</Text>
                  {Boolean(c.isPrimary) && (
                    <View className="bg-[#A3E63520] rounded-full px-sm py-0.5">
                      <Text className="text-xs text-primary font-semibold font-bevn-semibold">Chính</Text>
                    </View>
                  )}
                </View>
                {Boolean(c.coach?.specialization) && (
                  <View className="flex-row items-center gap-1 mb-xs">
                    <Icon name="star-outline" size={14} color={Colors.text.secondary} />
                    <Text className="text-sm text-text-secondary font-bevn-regular">{c.coach!.specialization}</Text>
                  </View>
                )}
                {Boolean(c.coach?.bio) && (
                  <Text className="text-xs text-text-muted font-bevn-regular" numberOfLines={2}>{c.coach!.bio}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {Boolean(targetCoach) && (
        <CoachRating
          coachId={targetCoach!.coachId}
          coachName={targetCoach!.coach?.user?.fullName}
          classId={cls.id}
        />
      )}

      {/* Schedules */}
      <View className="mb-xl">
        <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Lịch Học Sắp Tới</Text>
        {schedLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
        ) : schedules.length === 0 ? (
          <View className="bg-bg-surface rounded-lg p-xl items-center border border-border">
            <Icon name="event-busy" size={36} color={Colors.text.muted} style={{ marginBottom: 8 }} />
            <Text className="text-text-muted text-sm font-bevn-regular">Chưa có lịch học sắp tới</Text>
          </View>
        ) : (
          schedules.map((s) => {
            const slotsUsed = s._count?.enrollments ?? 0;
            const slotsLeft = cls.capacity - slotsUsed;
            const isFull = slotsLeft <= 0;
            const isPast = new Date(s.startTime) < new Date();
            const userStatus = userEnrollmentMap.get(s.id);
            const isBooked = userStatus === 'BOOKED';
            // CANCELLED vẫn cho đặt lại — BE tự reactivate (BR-07)
            const isDisabled = isFull || isPast || isBooked || bookMutation.isPending;

            return (
              <View
                key={s.id}
                className={clsx(
                  'flex-row justify-between items-center rounded-lg p-lg mb-sm border',
                  isBooked ? 'border-[#A3E63560] bg-[#A3E63508]' : 'bg-bg-surface border-border'
                )}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold font-bevn-semibold text-primary mb-0.5">{formatDate(s.startTime)}</Text>
                  <Text className="text-md font-bold font-bevn-bold text-text-primary mb-0.5">{formatTime(s.startTime)} – {formatTime(s.endTime)}</Text>
                  {Boolean(s.room) && (
                    <View className="flex-row items-center gap-1 mb-xs">
                      <Icon name="place" size={14} color={Colors.text.secondary} />
                      <Text className="text-xs text-text-secondary font-bevn-regular">{s.room!.name}</Text>
                    </View>
                  )}
                  <View className="flex-row items-center gap-1 mb-xs">
                    <Icon
                      name="group"
                      size={14}
                      color={isPast ? Colors.text.muted : isFull ? Colors.status.cancelled : Colors.status.active}
                    />
                    <Text className={clsx('text-xs font-bevn-medium', (isFull || isPast) ? 'text-status-cancelled' : 'text-status-active')}>
                      {isPast ? 'Đã qua giờ' : isFull ? 'Hết chỗ' : `Còn ${slotsLeft} chỗ`}
                    </Text>
                  </View>
                </View>

                {isBooked ? (
                  /* ĐÃ ĐẶT — hiển thị badge xanh thay vì nút */
                  <View className="flex-row items-center gap-1 bg-[#A3E63520] rounded-full px-md py-xs border border-[#A3E63540]">
                    <Icon name="check-circle" size={16} color={Colors.status.active} />
                    <Text className="text-xs text-status-active font-bold font-bevn-bold">Đã đặt</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className={clsx(
                      'rounded-md px-lg py-sm min-w-[80px] items-center',
                      (isFull || isPast) ? 'bg-bg-elevated' : 'bg-primary'
                    )}
                    onPress={() => {
                      if (!isFull && !isPast) {
                        showConfirm(
                          'Xác nhận đặt lịch',
                          `Đặt lớp "${cls.name}" lúc ${formatTime(s.startTime)}?`,
                          () => bookMutation.mutate(s.id),
                          undefined,
                          'Đặt lịch'
                        );
                      }
                    }}
                    disabled={isDisabled}
                  >
                    {bookMutation.isPending
                      ? <ActivityIndicator color={Colors.text.inverse} size="small" />
                      : <Text className={clsx('font-bold font-bevn-bold text-sm', (isFull || isPast) ? 'text-text-muted' : 'text-text-inverse')}>
                          {isPast ? 'Đã diễn ra' : isFull ? 'Hết chỗ' : 'Đặt lịch'}
                        </Text>}
                  </TouchableOpacity>
                )}

              </View>
            );
          })
        )}
      </View>
      </ScrollView>
    </View>
  );
}
