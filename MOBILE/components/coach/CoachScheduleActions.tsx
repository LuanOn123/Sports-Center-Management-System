// components/coach/CoachScheduleActions.tsx
// Hành động của HLV trên chi tiết buổi học: mở danh sách học viên để điểm danh (không đặt lịch)

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';
import { ROUTES } from '../../navigation/routes';
import type { ScheduleActionsContext } from '../shared/ScheduleDetailView';

export function CoachScheduleActions({ schedule }: ScheduleActionsContext) {
  const router = useRouter();
  if (schedule.status === 'CANCELLED') return null;
  return (
    <TouchableOpacity
      className="flex-row items-center justify-center gap-2 bg-primary rounded-xl p-lg"
      onPress={() => router.push(ROUTES.coachAttendanceFor(schedule.id))}
    >
      <Icon name="check-circle" size={20} color={Colors.text.inverse} />
      <Text className="text-text-inverse text-md font-bevn-bold">Xem học viên & điểm danh</Text>
    </TouchableOpacity>
  );
}
