// components/member/SessionEvaluationCard.tsx
// Đánh giá của HLV cho đúng buổi học đang xem (tiến độ sau buổi, chênh lệch và lời dặn) — lấy từ nhật ký đánh giá của lớp
// (GET /attendance/classes/:classId/my-goal). Không hiện gì nếu buổi này chưa được đánh giá.

import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '../shared/Icon';
import { EvaluationRow } from '../classes/ClassGoalCard';
import { useMyClassGoal } from '../../hooks/member/useMyClassGoal';
import { GOAL_TEXT as TEXT } from '../../constants/goals';
import { Colors } from '../../constants/theme';

export function SessionEvaluationCard({ classId, scheduleId }: { classId: string; scheduleId: string }) {
  const goal = useMyClassGoal(classId);
  const entry = goal.data?.evaluations.find((evaluation) => evaluation.scheduleId === scheduleId);
  if (!entry) return null;

  return (
    <View className="bg-bg-surface rounded-lg border border-border p-lg gap-sm mt-md">
      <View className="flex-row items-center gap-1.5">
        <Icon name="trending-up" size={16} color={Colors.primary} />
        <Text className="text-sm font-bevn-bold text-text-primary">{TEXT.sessionEvaluationTitle}</Text>
      </View>
      <EvaluationRow entry={entry} />
    </View>
  );
}
