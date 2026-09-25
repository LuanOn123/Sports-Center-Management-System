import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/shared/Icon';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { QrScannerModal } from '../../components/shared/QrScannerModal';
import { scanAttendanceQr, type AttendanceCredential } from '../../services/memberService';
import type { ClassSchedule, Enrollment } from '../../lib/types';
import { Colors } from '../../constants/theme';

const STATUS_LABEL: Record<string, string> = { SCHEDULED: 'Đang mở', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn thành' };
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: Colors.status.scheduled,
  CANCELLED: Colors.status.cancelled,
  COMPLETED: Colors.status.completed,
};

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
const WEEKDAY_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAY_LONG[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function ScheduleDetailScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showScanner, setShowScanner] = useState(false);

  const { data: schedData, isLoading } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => api.get<ClassSchedule>(`/class-schedules/${scheduleId}`),
    enabled: Boolean(scheduleId),
  });

  // Lấy danh sách enrollments của user (cả BOOKED và CANCELLED) để kiểm tra trạng thái
  const { data: enrollmentsData } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments/my', { limit: '100' }),
  });

  const bookMutation = useMutation({
    mutationFn: () => api.post('/enrollments', { scheduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      showAlert('Đặt lịch thành công', 'Lịch học đã được thêm vào danh sách của bạn.', () => {
        router.push('/(tabs)/schedule');
      });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Đặt lịch thất bại.';
      showAlert('Lỗi', msg);
    },
  });

  const scanMutation = useMutation({
    mutationFn: (credential: AttendanceCredential) => scanAttendanceQr(credential),
    onSuccess: () => {
      setShowScanner(false);
      showAlert('Điểm danh thành công', 'Bạn đã được ghi nhận có mặt tại buổi học này.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Điểm danh thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    },
  });

  const s = schedData?.data;
  const slotsUsed = s?._count?.enrollments ?? 0;
  const slotsLeft = s ? (s.class?.capacity ?? 0) - slotsUsed : 0;
  const isFull = slotsLeft <= 0;
  const isPast = s ? new Date(s.startTime) < new Date() : false;
  const isScheduleCancelled = s?.status === 'CANCELLED';

  // Kiểm tra trạng thái đăng ký của user với schedule này
  const userEnrollment = (enrollmentsData?.data ?? []).find((e) => e.scheduleId === scheduleId);
  const isBooked = userEnrollment?.status === 'BOOKED';
  // CANCELLED vẫn cho đặt lại — BE tự reactivate (BR-07)

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/schedule');
  };

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
        {s?.class?.name ?? 'Chi tiết buổi học'}
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
  if (!s) {
    return (
      <View className="flex-1 bg-bg-primary">
        {topNav}
        <View className="flex-1 justify-center items-center">
          <Text className="text-text-muted text-md font-bevn-regular">Không tìm thấy lịch học</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-primary">
      {topNav}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      {/* Status banner (chỉ hiển thị khi đã hủy hoặc đã hoàn thành) */}
      {s.status !== 'SCHEDULED' && (
        <View
          className="rounded-lg p-md mb-lg border items-center"
          style={{ backgroundColor: STATUS_COLOR[s.status] + '15', borderColor: STATUS_COLOR[s.status] + '40' }}
        >
          <Text className="text-sm font-bold font-bevn-bold" style={{ color: STATUS_COLOR[s.status] }}>
            {STATUS_LABEL[s.status]}
          </Text>
        </View>
      )}

      {/* Main info */}
      <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
        <Text className="text-xxl font-bold font-bevn-bold text-text-primary mb-xs">{s.class?.name ?? 'Lớp học'}</Text>
        {Boolean(s.class?.sports?.length) && (
          <View className="flex-row items-center gap-1.5 mb-1">
            <Icon name="sports" size={16} color={Colors.primary} />
            <Text className="text-sm text-text-secondary font-bevn-regular">{s.class!.sports!.map((sp) => sp.name).join(', ')}</Text>
          </View>
        )}

        <View className="flex-row flex-wrap gap-md mt-md">
          <View className="w-[47%] bg-bg-elevated rounded-lg p-md">
            <Icon name="calendar-today" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Ngày</Text>
            <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{formatDate(s.startTime)}</Text>
          </View>
          <View className="w-[47%] bg-bg-elevated rounded-lg p-md">
            <Icon name="access-time" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Thời gian</Text>
            <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{formatTime(s.startTime)} – {formatTime(s.endTime)}</Text>
          </View>
          <View className="w-[47%] bg-bg-elevated rounded-lg p-md">
            <Icon name="place" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Phòng tập</Text>
            <Text className="text-sm font-semibold font-bevn-semibold text-text-primary mt-0.5">{s.room?.name ?? '—'}</Text>
          </View>
          <View className="w-[47%] bg-bg-elevated rounded-lg p-md">
            <Icon name="group" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text className="text-xs text-text-muted font-bevn-regular uppercase tracking-wide">Chỗ còn lại</Text>
            <Text className={clsx('text-sm font-semibold font-bevn-semibold mt-0.5', isFull ? 'text-status-cancelled' : 'text-text-primary')}>
              {isFull ? 'Hết chỗ' : `${slotsLeft} chỗ`}
            </Text>
          </View>
        </View>
      </View>

      {/* Room details */}
      {Boolean(s.room) && (
        <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
          <Text className="text-md font-bold font-bevn-bold text-text-primary mb-md">Thông Tin Phòng</Text>
          <View className="mb-sm">
            <Text className="text-lg font-semibold font-bevn-semibold text-primary">{s.room!.name}</Text>
          </View>
          {Boolean(s.room!.location) && (
            <View className="flex-row items-center gap-1.5 mb-1">
              <Icon name="place" size={14} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">{s.room!.location}</Text>
            </View>
          )}
          {Boolean(s.room!.capacity) && (
            <View className="flex-row items-center gap-1.5 mb-1">
              <Icon name="group" size={14} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-regular">Sức chứa: {s.room!.capacity} người</Text>
            </View>
          )}
        </View>
      )}

      {/* Coaches */}
      <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border">
        <Text className="text-md font-bold font-bevn-bold text-text-primary mb-md">Huấn Luyện Viên</Text>
        {s.class?.coaches && s.class.coaches.length > 0 ? (
          s.class.coaches.map((c) => (
            <View key={c.coachId} className="flex-row items-center bg-bg-elevated rounded-lg p-md mb-xs">
              <View className="w-10 h-10 rounded-full bg-[#A3E63525] justify-center items-center mr-md">
                <Text className="text-lg font-bold font-bevn-bold text-primary">{c.coach?.user?.fullName?.charAt(0) ?? '?'}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-sm mb-0.5">
                  <Text className="text-md font-bold font-bevn-bold text-text-primary">{c.coach?.user?.fullName ?? '—'}</Text>
                  {Boolean(c.isPrimary) && (
                    <View className="bg-[#A3E63520] rounded-full px-sm py-0.5">
                      <Text className="text-xs text-primary font-semibold font-bevn-semibold">Chính</Text>
                    </View>
                  )}
                </View>
                {Boolean(c.coach?.specialization) && (
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Icon name="star-outline" size={14} color={Colors.text.secondary} />
                    <Text className="text-xs text-text-secondary font-bevn-regular">{c.coach!.specialization}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text className="text-text-muted text-sm font-bevn-regular italic">Chưa phân công huấn luyện viên</Text>
        )}
      </View>

      {/* Book button / Booked badge / Cancelled badge */}
      {s.status === 'SCHEDULED' && (
        isBooked ? (
          /* ĐÃ ĐẶT — hiển thị thông báo + nút điểm danh */
          <>
            <View className="flex-row items-center gap-2.5 bg-[#A3E63515] rounded-xl p-lg justify-center border-[1.5px] border-[#A3E63540]">
              <Icon name="check-circle" size={22} color={Colors.status.active} />
              <Text className="text-status-active text-md font-bold font-bevn-bold text-center">Bạn đã đặt lịch buổi học này</Text>
            </View>
            <TouchableOpacity className="flex-row items-center justify-center gap-2 bg-primary rounded-xl p-lg mt-md" onPress={() => setShowScanner(true)}>
              <Icon name="qr-code-scanner" size={20} color={Colors.text.inverse} />
              <Text className="text-text-inverse text-md font-bold font-bevn-bold">Điểm danh vào lớp</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            className={clsx('rounded-xl p-lg items-center', (isFull || isPast || bookMutation.isPending) ? 'bg-bg-elevated' : 'bg-primary')}
            onPress={() => {
              if (!isFull && !isPast) {
                showConfirm(
                  'Xác nhận đặt lịch',
                  `Đặt lớp "${s.class?.name}" lúc ${formatTime(s.startTime)} ngày ${formatDate(s.startTime)}?`,
                  () => bookMutation.mutate(),
                  undefined,
                  'Đặt lịch'
                );
              }
            }}
            disabled={isFull || isPast || bookMutation.isPending}
          >
            {bookMutation.isPending ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <View className="flex-row items-center gap-2">
                <Icon name={isPast ? 'history' : 'event-available'} size={22} color={(isFull || isPast) ? Colors.text.muted : Colors.text.inverse} />
                <Text className={clsx('text-lg font-bold font-bevn-bold', (isFull || isPast) ? 'text-text-muted' : 'text-text-inverse')}>
                  {isPast ? 'Buổi học đã diễn ra' : isFull ? 'Hết chỗ' : 'Đặt lịch học'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )
      )}
      {Boolean(isScheduleCancelled) && (
        <View className="flex-row items-center gap-2 bg-[#EF444415] rounded-lg p-lg justify-center border border-[#EF444430]">
          <Icon name="warning" size={18} color={Colors.status.cancelled} />
          <Text className="text-status-cancelled text-sm font-bevn-medium">Buổi học này đã bị hủy</Text>
        </View>
      )}

      <QrScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSubmitCredential={(credential) => scanMutation.mutate(credential)}
        isSubmitting={scanMutation.isPending}
      />
      </ScrollView>
    </View>
  );
}
