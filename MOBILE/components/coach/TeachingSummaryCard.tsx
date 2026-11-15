// components/coach/TeachingSummaryCard.tsx
// Tổng quan buổi dạy của HLV (web: ScheduleAnalytics ở "Tổng quan huấn luyện viên"): xem theo Tuần hoặc Tháng, 4 chỉ số,
// tiến độ trong kỳ, số buổi theo thứ, lớp và phòng có nhiều buổi nhất.
// Dữ liệu ở hooks/coach/useTeachingSummary, cách tính ở lib/scheduleAnalytics.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../shared/Icon';
import { WorkflowState } from '../shared/WorkflowScreen';
import { Card, Segmented, StatTile } from '../ui';
import { ProgressBar } from '../ui/ProgressBar';
import { RankingList, WeekdayBars } from './TeachingSummaryCharts';
import { useTeachingSummary } from '../../hooks/coach/useTeachingSummary';
import { CALENDAR_MODES, CALENDAR_TEXT } from '../../constants/calendar';
import { COACH_SUMMARY_RANK_LIMIT, TEACHING_SUMMARY_TEXT as TEXT } from '../../constants/schedule';
import { Colors } from '../../constants/theme';
import { percentOf } from '../../lib/scheduleAnalytics';

export function TeachingSummaryCard({ coachId }: { coachId: string }) {
  const { calendar, summary, isLoading, isError, error, refetch } = useTeachingSummary(coachId);
  const { mode } = calendar;
  const { total, scheduled, completed, cancelled, active } = summary;
  const completedPercent = percentOf(completed, active);
  const scheduledPercent = percentOf(scheduled, total);
  const cancelledPercent = percentOf(cancelled, total);

  const arrow = (icon: string, onPress: () => void, label: string) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-8 h-8 rounded-full bg-bg-elevated items-center justify-center"
      onPress={onPress}
    >
      <Icon name={icon} size={18} color={Colors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <Card className="mb-lg">
      <View className="flex-row items-center justify-between mb-md">
        <View className="flex-1 mr-sm">
          <Text className="text-md font-bevn-bold text-text-primary">{TEXT.title[mode]}</Text>
          <Text className="text-xs text-text-muted font-bevn-regular">{calendar.title} · {TEXT.timezone}</Text>
        </View>
        <View className="flex-row gap-sm">
          {arrow('chevron-left', calendar.prev, CALENDAR_TEXT.prev[mode])}
          {arrow('chevron-right', calendar.next, CALENDAR_TEXT.next[mode])}
        </View>
      </View>

      <View className="mb-md">
        <Segmented options={CALENDAR_MODES} value={mode} onChange={calendar.setMode} />
      </View>
      {!calendar.isCurrent && (
        <TouchableOpacity accessibilityRole="button" className="self-start mb-md" onPress={calendar.goToday}>
          <Text className="text-sm text-primary font-bevn-semibold">{mode === 'month' ? CALENDAR_TEXT.thisMonth : CALENDAR_TEXT.thisWeek}</Text>
        </TouchableOpacity>
      )}

      <WorkflowState error={error} retry={() => { void refetch(); }} />
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : !isError && (
        <View className="gap-md">
          <View className="gap-sm">
            <View className="flex-row gap-sm">
              <StatTile label={TEXT.kpi.total} value={total} note={TEXT.kpiNote.total} />
              <StatTile
                label={TEXT.kpi.scheduled}
                value={scheduled}
                color={Colors.status.scheduled}
                note={scheduledPercent === null ? undefined : TEXT.kpiNote.ofAll(scheduledPercent)}
              />
            </View>
            <View className="flex-row gap-sm">
              <StatTile
                label={TEXT.kpi.completed}
                value={completed}
                color={Colors.status.completed}
                note={completedPercent === null ? undefined : TEXT.kpiNote.ofActive(completedPercent)}
              />
              <StatTile
                label={TEXT.kpi.cancelled}
                value={cancelled}
                color={Colors.status.cancelled}
                note={cancelledPercent === null ? undefined : TEXT.kpiNote.ofAll(cancelledPercent)}
              />
            </View>
          </View>

          {total === 0 ? (
            <Text className="text-sm text-text-muted font-bevn-regular">{TEXT.empty}</Text>
          ) : (
            <>
              <View className="gap-xs">
                <Text className="text-sm font-bevn-semibold text-text-primary">{TEXT.progressTitle}</Text>
                {active > 0 ? (
                  <>
                    <ProgressBar value={completed / active} color={Colors.status.completed} size="md" />
                    <Text className="text-xs text-text-secondary font-bevn-regular">{TEXT.progressLabel(completed, active, completedPercent ?? 0)}</Text>
                  </>
                ) : (
                  <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.progressEmpty}</Text>
                )}
              </View>

              {active > 0 && (
                <>
                  <WeekdayBars buckets={summary.weekdays} />
                  <RankingList title={TEXT.classesTitle} items={summary.classes.slice(0, COACH_SUMMARY_RANK_LIMIT)} />
                  <RankingList title={TEXT.roomsTitle} items={summary.rooms.slice(0, COACH_SUMMARY_RANK_LIMIT)} />
                  <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.summary(summary.classes.length, summary.rooms.length, active)}</Text>
                </>
              )}
            </>
          )}
        </View>
      )}
    </Card>
  );
}
