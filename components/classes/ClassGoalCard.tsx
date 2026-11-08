// components/classes/ClassGoalCard.tsx
// Thẻ "Mục tiêu & Tiến độ khóa học" của hội viên ở chi tiết lớp (web: khu vực tiến độ mục tiêu của ClassDetailPage):
// mục tiêu cố định theo khóa, thanh tiến độ theo mức và nhật ký đánh giá của HLV sau mỗi buổi học.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { GoalProgressBar } from '../shared/GoalProgressBar';
import { GOAL_TEXT as TEXT } from '../../constants/goals';
import { Colors } from '../../constants/theme';
import { formatProgressDiff, progressLevel } from '../../lib/goalProgress';
import { formatTime, formatWeekdayDate } from '../../lib/format';
import type { GoalEvaluationEntry, MyClassGoal } from '../../lib/types';

export function EvaluationRow({ entry }: { entry: GoalEvaluationEntry }) {
  const level = progressLevel(entry.newProgress);
  const diffColor = entry.diff > 0 ? Colors.status.success : Colors.status.failed;
  return (
    <View className="bg-bg-elevated rounded-md p-md border border-border gap-xs">
      <View className="flex-row items-center gap-sm">
        <View className="flex-1">
          <Text className="text-sm text-text-primary font-bevn-bold">{formatWeekdayDate(entry.startTime)}</Text>
          <Text className="text-xs text-text-muted font-bevn-regular">
            {formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {TEXT.coachLabel} {entry.coachName}
          </Text>
        </View>
        {entry.diff !== 0 && (
          <View className="rounded-sm px-sm py-0.5" style={{ backgroundColor: diffColor + '22' }}>
            <Text className="text-xs font-bevn-bold" style={{ color: diffColor }}>{formatProgressDiff(entry.diff)}</Text>
          </View>
        )}
        <View className="rounded-md border px-sm py-0.5" style={{ borderColor: level.color + '66', backgroundColor: level.color + '18' }}>
          <Text className="text-xs font-bevn-bold" style={{ color: level.color }}>{TEXT.evaluationProgress(entry.newProgress)}</Text>
        </View>
      </View>
      {Boolean(entry.description) && (
        <View
          className="flex-row gap-sm rounded-md p-sm mt-xs"
          style={{ backgroundColor: Colors.status.scheduled + '14', borderLeftWidth: 3, borderLeftColor: Colors.status.scheduled }}
        >
          <Icon name="chat-bubble-outline" size={14} color={Colors.status.scheduled} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm text-text-primary font-bevn-regular">
            <Text className="font-bevn-bold">{TEXT.coachNote}</Text> {entry.description}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ClassGoalCard({ goal }: { goal: MyClassGoal }) {
  const level = progressLevel(goal.progress);
  return (
    <View className="bg-bg-surface border border-border rounded-lg p-lg gap-md">
      <View className="flex-row items-start gap-md">
        <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: Colors.status.scheduled + '20' }}>
          <Icon name="track-changes" size={22} color={Colors.status.scheduled} />
        </View>
        <View className="flex-1">
          <Text className="text-md font-bevn-bold text-text-primary">{TEXT.cardTitle}</Text>
          <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">{TEXT.cardSubtitle}</Text>
        </View>
      </View>

      <View
        className="self-start flex-row items-center gap-xs rounded-full border px-md py-xs"
        style={{ borderColor: level.color + '66', backgroundColor: level.color + '18' }}
      >
        <Icon name="trending-up" size={14} color={level.color} />
        <Text className="text-xs font-bevn-bold" style={{ color: level.color }}>{goal.progress}% · {level.label}</Text>
      </View>

      <View className="bg-bg-elevated rounded-md p-md border border-border gap-md">
        <View className="gap-xs">
          <Text className="text-xs text-text-muted font-bevn-semibold">{TEXT.goalHeading}:</Text>
          <Text selectable className="text-md text-text-primary font-bevn-bold">{goal.goal}</Text>
        </View>
        <View
          className="self-start flex-row items-center gap-xs rounded-md px-sm py-0.5 border"
          style={{ borderColor: Colors.status.scheduled + '40', backgroundColor: Colors.status.scheduled + '14' }}
        >
          <Icon name="lock" size={12} color={Colors.status.scheduled} />
          <Text className="text-xs font-bevn-medium" style={{ color: Colors.status.scheduled }}>{TEXT.fixedBadge}</Text>
        </View>
        <GoalProgressBar progress={goal.progress} showLegend />
      </View>

      <View className="gap-sm">
        <View className="flex-row items-center gap-1.5">
          <Icon name="assignment" size={16} color={Colors.primary} />
          <Text className="text-sm font-bevn-bold text-text-primary">{TEXT.logTitle}</Text>
        </View>
        {goal.evaluations.length === 0 ? (
          <Text className="text-sm text-text-muted font-bevn-regular italic">{TEXT.logEmpty}</Text>
        ) : (
          goal.evaluations.map((entry) => <EvaluationRow key={entry.id} entry={entry} />)
        )}
      </View>
    </View>
  );
}
