// components/member/MemberScheduleActions.tsx
// Hành động của hội viên trên chi tiết buổi học: đã đặt + tự điểm danh QR / danh sách chờ khi hết chỗ.
// Hội viên đăng ký theo CẢ KHÓA (như web) — chưa đặt thì dẫn sang trang lớp, không đặt lẻ từng buổi.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { QrScannerModal } from '../shared/QrScannerModal';
import { useMyEnrollments } from '../../hooks/member/useEnrollments';
import { Button } from '../ui';
import { useScanAttendance } from '../../hooks/member/useAttendance';
import { Colors } from '../../constants/theme';
import { ROUTES } from '../../navigation/routes';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import type { ScheduleActionsContext } from '../shared/ScheduleDetailView';
import { WaitlistAction } from './WaitlistAction';
import { canTakeAttendance } from '../../lib/businessRules';

const MY_ENROLLMENTS_LIMIT = '100';
const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function MemberScheduleActions({ schedule: s, isFull, isPast }: ScheduleActionsContext) {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);
  const { data: enrollmentsData } = useMyEnrollments(undefined, MY_ENROLLMENTS_LIMIT);
  const scan = useScanAttendance();

  const isBooked = (enrollmentsData?.data ?? []).some((e) => e.scheduleId === s.id && e.status === 'BOOKED');
  const classId = s.classId ?? s.class?.id;

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
          <TouchableOpacity disabled={!canTakeAttendance(s)} style={{ opacity: canTakeAttendance(s) ? 1 : 0.5 }} className="flex-row items-center justify-center gap-2 bg-primary rounded-xl p-lg mt-md" onPress={() => setShowScanner(true)}>
            <Icon name="qr-code-scanner" size={20} color={Colors.text.inverse} />
            <Text className="text-text-inverse text-md font-bevn-bold">{canTakeAttendance(s) ? 'Điểm danh vào lớp' : 'Điểm danh mở trước buổi học 30 phút'}</Text>
          </TouchableOpacity>
        </>
      ) : isFull && !isPast ? <WaitlistAction scheduleId={s.id} /> : isPast ? (
        <View className="flex-row items-center gap-2 rounded-lg p-lg justify-center bg-bg-elevated">
          <Icon name="history" size={18} color={Colors.text.muted} />
          <Text className="text-text-muted text-sm font-bevn-medium">Buổi học đã diễn ra</Text>
        </View>
      ) : (
        <View className="bg-bg-surface rounded-lg border border-border p-lg gap-sm">
          <Text className="text-sm text-text-secondary font-bevn-regular">Lớp được đăng ký theo cả khóa. Mở trang lớp để xem lịch và đăng ký trọn khóa.</Text>
          {classId && <Button title="Xem lớp & đăng ký" icon="event-available" onPress={() => router.push(ROUTES.classDetail(classId))} />}
        </View>
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
