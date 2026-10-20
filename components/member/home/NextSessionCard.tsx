// components/member/home/NextSessionCard.tsx
// "Buổi tập tiếp theo" (web Trang chủ): tên lớp, mốc bắt đầu, phòng; trong cửa sổ điểm danh thì nút
// "Điểm danh" (mở chi tiết buổi — nơi có quét QR / nhập mã), ngoài cửa sổ là "Xem buổi học".

import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../shared/Icon';
import { Button, Card, EmptyState } from '../../ui';
import { Colors } from '../../../constants/theme';
import { canTakeAttendance } from '../../../lib/businessRules';
import { formatStartsIn, formatTime } from '../../../lib/format';
import { ROUTES } from '../../../navigation/routes';
import type { Enrollment } from '../../../lib/types';

export function NextSessionCard({ enrollment }: { enrollment: Enrollment | undefined }) {
  const router = useRouter();
  const schedule = enrollment?.schedule;

  if (!enrollment || !schedule) {
    return (
      <View className="mb-lg">
        <EmptyState
          icon="event-busy"
          title="Chưa có buổi tập sắp tới"
          description="Xem danh sách lớp để chọn giờ học phù hợp."
          actionLabel="Tìm lớp học"
          onAction={() => router.push(ROUTES.classes)}
        />
      </View>
    );
  }

  const open = () => router.push(ROUTES.scheduleDetail(schedule.id));
  const checkInOpen = canTakeAttendance(schedule);
  return (
    <Card accent={Colors.primary} className="mb-lg" onPress={open} accessibilityLabel="Xem buổi tập tiếp theo">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-text-muted font-bevn-semibold uppercase tracking-wide">Buổi tập tiếp theo</Text>
        <Text className="text-xs text-primary font-bevn-semibold">{formatStartsIn(schedule.startTime, schedule.endTime)}</Text>
      </View>
      <Text className="text-xl font-bevn-bold text-text-primary mt-xs" numberOfLines={1}>{schedule.class?.name ?? 'Lớp học'}</Text>
      <View className="flex-row items-center gap-md mt-xs mb-md">
        <View className="flex-row items-center gap-1">
          <Icon name="schedule" size={15} color={Colors.text.secondary} />
          <Text className="text-sm text-text-secondary font-bevn-regular">{formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}</Text>
        </View>
        {Boolean(schedule.room) && (
          <View className="flex-1 flex-row items-center gap-1">
            <Icon name="place" size={15} color={Colors.text.secondary} />
            <Text className="flex-1 text-sm text-text-secondary font-bevn-regular" numberOfLines={1}>{schedule.room!.name}</Text>
          </View>
        )}
      </View>
      <Button
        title={checkInOpen ? 'Điểm danh' : 'Xem buổi học'}
        icon={checkInOpen ? 'qr-code-scanner' : undefined}
        variant={checkInOpen ? 'primary' : 'secondary'}
        onPress={open}
      />
    </Card>
  );
}
