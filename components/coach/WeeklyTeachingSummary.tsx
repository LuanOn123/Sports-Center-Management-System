import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useCoachSchedules } from '../../hooks/coach/useCoachSchedules';
import { addDays, endOfDay, startOfWeek, isSameDay, weekDays } from '../../lib/date';
import { formatDayMonth } from '../../lib/format';
import { WorkflowCard, WorkflowText, WorkflowButton, WorkflowState } from '../shared/WorkflowScreen';

/** Compact counterpart of the web coach dashboard's weekly schedule analytics. */
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
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return <View className="mb-xl"><WorkflowCard title="Tổng quan tuần dạy">
    <WorkflowText>{formatDayMonth(days[0])} – {formatDayMonth(days[6])} · Giờ Việt Nam (GMT+7)</WorkflowText>
    <View className="flex-row gap-sm"><View className="flex-1"><WorkflowButton title="Tuần trước" secondary onPress={() => setWeek((value) => addDays(value, -7))} /></View><View className="flex-1"><WorkflowButton title="Tuần sau" secondary onPress={() => setWeek((value) => addDays(value, 7))} /></View></View>
    <WorkflowState pending={data.isLoading} error={data.error} retry={() => { void data.refetch(); }} />
    {!data.isLoading && !data.isError && <>
      <WorkflowText>Tổng số buổi: {data.schedules.length} · Hoàn thành: {data.schedules.filter((s) => s.status === 'COMPLETED').length}</WorkflowText>
      <WorkflowText>Đã lên lịch: {data.schedules.filter((s) => s.status === 'SCHEDULED').length} · Đã hủy: {data.schedules.filter((s) => s.status === 'CANCELLED').length}</WorkflowText>
      <WorkflowText>Nhịp giảng dạy theo ngày · Không gồm buổi hủy</WorkflowText>
      <View className="flex-row gap-sm items-end" accessibilityLabel="Số buổi theo ngày trong tuần">
        {daily.map((count, index) => <View key={labels[index]} className="flex-1 items-center gap-xs">
          <Text className="text-xs text-text-primary font-bevn-medium">{count}</Text>
          <View className="w-full bg-bg-elevated rounded-sm justify-end" style={{ height: 64 }}><View className="bg-primary rounded-sm" style={{ height: count / maximum * 64 }} /></View>
          <Text className="text-xs text-text-secondary font-bevn-regular">{labels[index]}</Text>
        </View>)}
      </View>
      {Array.from(classes.entries()).map(([id, cls]) => <WorkflowText key={id}>{cls.name} · {cls.count} buổi</WorkflowText>)}
      {!data.schedules.length && <WorkflowText>Chưa có buổi dạy trong tuần này.</WorkflowText>}
    </>}
  </WorkflowCard></View>;
}
