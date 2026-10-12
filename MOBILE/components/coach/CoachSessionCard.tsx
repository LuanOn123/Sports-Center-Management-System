// components/coach/CoachSessionCard.tsx
// Thẻ một buổi dạy: giờ, lớp, phòng, trạng thái, "Xem học viên →" (web: .coach-session)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';
import { SCHEDULE_STATUS_COLOR, SCHEDULE_STATUS_LABEL } from '../../constants/schedule';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import type { ClassSchedule } from '../../lib/types';

interface CoachSessionCardProps {
  session: ClassSchedule;
  showDate?: boolean;
  onPress: () => void;
}

export function CoachSessionCard({ session, showDate, onPress }: CoachSessionCardProps) {
  const color = SCHEDULE_STATUS_COLOR[session.status];
  const cancelled = session.status === 'CANCELLED';
  return (
    <TouchableOpacity
      className="bg-bg-surface rounded-lg p-md border border-border mb-sm"
      style={{ opacity: cancelled ? 0.6 : 1 }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row justify-between items-center mb-xs">
        <View className="flex-row items-center gap-1">
          <Icon name="access-time" size={14} color={Colors.primary} />
          <Text className="text-sm font-bevn-semibold text-primary">
            {formatTime(session.startTime)} – {formatTime(session.endTime)}
          </Text>
        </View>
        <View className="rounded-full px-sm py-0.5" style={{ backgroundColor: color + '20' }}>
          <Text className="text-xs font-bevn-semibold" style={{ color }}>{SCHEDULE_STATUS_LABEL[session.status]}</Text>
        </View>
      </View>
      <Text className="text-md font-bevn-bold text-text-primary">{session.class?.name ?? 'Lớp học'}</Text>
      {showDate && (
        <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">{formatWeekdayDate(session.startTime)}</Text>
      )}
      <View className="flex-row justify-between items-center mt-xs">
        <View className="flex-row items-center gap-1 flex-1">
          <Icon name="place" size={13} color={Colors.text.secondary} />
          <Text className="text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>{session.room?.name ?? '—'}</Text>
        </View>
        <Text className="text-xs text-primary font-bevn-medium">Xem học viên →</Text>
      </View>
    </TouchableOpacity>
  );
}
