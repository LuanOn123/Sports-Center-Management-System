// components/member/MemberScheduleActions.tsx
// Hành động của hội viên trên chi tiết buổi học: đặt lịch / đã đặt + tự điểm danh QR

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { QrScannerModal } from '../shared/QrScannerModal';
import { useMyEnrollments, useBookSchedule } from '../../hooks/member/useEnrollments';
import { useScanAttendance } from '../../hooks/member/useAttendance';
import { Colors } from '../../constants/theme';
import { ROUTES } from '../../navigation/routes';
import { ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import type { ScheduleActionsContext } from '../shared/ScheduleDetailView';

const MY_ENROLLMENTS_LIMIT = '100';
const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function MemberScheduleActions({ schedule: s, isFull, isPast }: ScheduleActionsContext) {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);
  const { data: enrollmentsData } = useMyEnrollments(undefined, MY_ENROLLMENTS_LIMIT);
  const book = useBookSchedule();
  const scan = useScanAttendance();

  // CANCELLED vẫn cho đặt lại — BE tự kích hoạt lại (BR-07)
  const isBooked = (enrollmentsData?.data ?? []).some((e) => e.scheduleId === s.id && e.status === 'BOOKED');
  const disabled = isFull || isPast || book.isPending;

  const handleBook = () => {
    if (isFull || isPast) return;
    showConfirm(
      'Xác nhận đặt lịch',
      `Đặt lớp "${s.class?.name}" lúc ${formatTime(s.startTime)} ngày ${formatWeekdayDate(s.startTime, 'long')}?`,
      () =>
        book.mutate(s.id, {
          onSuccess: () =>
            showAlert('Đặt lịch thành công', 'Lịch học đã được thêm vào danh sách của bạn.', () => router.push(ROUTES.schedule)),
          onError: (e) => showAlert('Lỗi', errorMessage(e, 'Đặt lịch thất bại.')),
        }),
      undefined,
      'Đặt lịch'
    );
  };

  if (s.status === 'CANCELLED') {
    return (
      <View className="flex-row items-center gap-2 rounded-lg p-lg justify-center border" style={{ backgroundColor: Colors.status.cancelled + '15', borderColor: Colors.status.cancelled + '30' }}>
        <Icon name="warning" size={18} color={Colors.status.cancelled} />
        <Text className="text-status-cancelled text-sm font-bevn-medium">Buổi học này đã bị hủy</Text>
      </View>
    );
  }
  if (s.status !== 'SCHEDULED') return null;

  return (
    <>
      {isBooked ? (
        <>
          <View className="flex-row items-center gap-2.5 rounded-xl p-lg justify-center border-[1.5px]" style={{ backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }}>
            <Icon name="check-circle" size={22} color={Colors.status.active} />
            <Text className="text-status-active text-md font-bevn-bold text-center">Bạn đã đặt lịch buổi học này</Text>
          </View>
          <TouchableOpacity className="flex-row items-center justify-center gap-2 bg-primary rounded-xl p-lg mt-md" onPress={() => setShowScanner(true)}>
            <Icon name="qr-code-scanner" size={20} color={Colors.text.inverse} />
            <Text className="text-text-inverse text-md font-bevn-bold">Điểm danh vào lớp</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          className="rounded-xl p-lg items-center"
          style={{ backgroundColor: isFull || isPast ? Colors.bg.elevated : Colors.primary, opacity: book.isPending ? 0.7 : 1 }}
          onPress={handleBook}
          disabled={disabled}
        >
          {book.isPending ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <View className="flex-row items-center gap-2">
              <Icon name={isPast ? 'history' : 'event-available'} size={22} color={isFull || isPast ? Colors.text.muted : Colors.text.inverse} />
              <Text className="text-lg font-bevn-bold" style={{ color: isFull || isPast ? Colors.text.muted : Colors.text.inverse }}>
                {isPast ? 'Buổi học đã diễn ra' : isFull ? 'Hết chỗ' : 'Đặt lịch học'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <QrScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSubmitCredential={(credential) =>
          scan.mutate(credential, {
            onSuccess: () => {
              setShowScanner(false);
              showAlert('Điểm danh thành công', 'Bạn đã được ghi nhận có mặt tại buổi học này.');
            },
            onError: (e) => showAlert('Lỗi', errorMessage(e, 'Điểm danh thất bại. Vui lòng thử lại.')),
          })
        }
        isSubmitting={scan.isPending}
      />
    </>
  );
}
