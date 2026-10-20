// components/coach/WeeklyTeachingSummary.tsx
// Tổng quan tuần dạy (bản gọn của thống kê tuần trên Trang chủ HLV web): số buổi theo trạng thái,
// nhịp dạy theo ngày, số buổi theo lớp. Chuyển tuần bằng 2 nút mũi tên.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../shared/Icon';
import { Card, StatTile } from '../ui';
import { WorkflowState } from '../shared/WorkflowScreen';
import { useCoachSchedules } from '../../hooks/coach/useCoachSchedules';
import { addDays, endOfDay, startOfWeek, isSameDay, weekDays } from '../../lib/date';
import { formatDayMonth } from '../../lib/format';
import { Colors } from '../../constants/theme';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const BAR_HEIGHT = 56;

export function WeeklyTeachingSummary({ coachId }: { coachId: string }) {
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => weekDays(week), [week]);
  const range = useMemo(() => ({ startAfter: days[0].toISOString(), startBefore: endOfDay(days[6]).toISOString() }), [days]);
  const data = useCoachSchedules(coachId, range);
  const active = data.schedules.filter((s) => s.status !== 'CANCELLED');
  const classes = new Map<string, { name: string; count: number }>();
  for (const session of active) {
    const previous = classes.get(session.classId);
    classes.set(session.classId, { name: session.class?.name || 'Lớp học', count: (previous?.count || 0) + 1 });
  }
  const daily = days.map((day) => active.filter((session) => isSameDay(new Date(session.startTime), day)).length);
  const maximum = Math.max(1, ...daily);
  const count = (status: string) => data.schedules.filter((s) => s.status === status).length;

  const arrow = (icon: string, delta: number, label: string) => (
    <TouchableOpacity
      accessibilityLabel={label}
      className="w-8 h-8 rounded-full bg-bg-elevated items-center justify-center"
      onPress={() => setWeek((value) => addDays(value, delta))}
    >
      <Icon name={icon} size={18} color={Colors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <Card className="mb-lg">
      <View className="flex-row items-center justify-between mb-md">
        <View>
          <Text className="text-md font-bevn-bold text-text-primary">Tổng quan tuần dạy</Text>
          <Text className="text-xs text-text-muted font-bevn-regular">{formatDayMonth(days[0])} – {formatDayMonth(days[6])} · giờ Việt Nam</Text>
        </View>
        <View className="flex-row gap-sm">
          {arrow('chevron-left', -7, 'Tuần trước')}
          {arrow('chevron-right', 7, 'Tuần sau')}
        </View>
      </View>

      <WorkflowState error={data.error} retry={() => { void data.refetch(); }} />
      {data.isLoading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : !data.isError && (
        <>
          <View className="flex-row gap-sm mb-md">
            <StatTile label="Tổng buổi" value={data.schedules.length} />
            <StatTile label="Hoàn thành" value={count('COMPLETED')} color={Colors.status.completed} />
            <StatTile label="Đã hủy" value={count('CANCELLED')} color={Colors.status.cancelled} />
          </View>
          <View className="flex-row gap-sm items-end" accessibilityLabel="Số buổi theo ngày trong tuần (không gồm buổi hủy)">
            {daily.map((n, index) => (
              <View key={DAY_LABELS[index]} className="flex-1 items-center gap-xs">
                <Text className="text-xs text-text-primary font-bevn-medium">{n}</Text>
                <View className="w-full bg-bg-elevated rounded-sm justify-end" style={{ height: BAR_HEIGHT }}>
                  <View className="bg-primary rounded-sm" style={{ height: (n / maximum) * BAR_HEIGHT }} />
                </View>
                <Text className="text-xs text-text-secondary font-bevn-regular">{DAY_LABELS[index]}</Text>
              </View>
            ))}
          </View>
          {classes.size > 0 ? (
            <View className="mt-md gap-xs">
              {Array.from(classes.entries()).map(([id, cls]) => (
                <View key={id} className="flex-row justify-between">
                  <Text className="flex-1 text-sm text-text-secondary font-bevn-regular mr-sm" numberOfLines={1}>{cls.name}</Text>
                  <Text className="text-sm text-text-primary font-bevn-semibold">{cls.count} buổi</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-text-muted font-bevn-regular mt-md">Chưa có buổi dạy trong tuần này.</Text>
          )}
        </>
      )}
    </Card>
  );
}
