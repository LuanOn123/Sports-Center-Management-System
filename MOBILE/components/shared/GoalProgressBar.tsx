// components/shared/GoalProgressBar.tsx
// Thanh tiến độ mục tiêu khóa học: "x% / 100%" + màu theo mức (<20% đỏ, 20–69% vàng, ≥70% xanh) + chú thích ba mốc.
// Dùng ở thẻ tiến độ của hội viên, sheet đánh giá và hồ sơ học viên của HLV (web: getProgressTheme).

import React from 'react';
import { View, Text } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { PROGRESS_LEVELS, PROGRESS_MAX, GOAL_TEXT } from '../../constants/goals';
import { clampProgress, progressLevel } from '../../lib/goalProgress';

/** Chú thích ba mốc: 0% cần nỗ lực · 50% đang tiến bộ · 100% đạt mục tiêu */
export function GoalProgressLegend() {
  return (
    <View className="flex-row justify-between gap-xs">
      {PROGRESS_LEVELS.map((item, index) => (
        <Text
          key={item.key}
          className="flex-1 text-[10px] font-bevn-regular"
          style={{ color: item.color, textAlign: index === 0 ? 'left' : index === PROGRESS_LEVELS.length - 1 ? 'right' : 'center' }}
        >
          {item.legend}
        </Text>
      ))}
    </View>
  );
}

export function GoalProgressBar({ progress, showLegend = false }: { progress: number; showLegend?: boolean }) {
  const value = clampProgress(progress);
  const level = progressLevel(value);
  return (
    <View className="gap-xs">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-text-secondary font-bevn-semibold">{GOAL_TEXT.progressLabel}</Text>
        <Text className="text-sm font-bevn-bold" style={{ color: level.color }}>{value}% / {PROGRESS_MAX}%</Text>
      </View>
      <ProgressBar value={value / PROGRESS_MAX} color={level.color} size="md" />
      {showLegend && <GoalProgressLegend />}
    </View>
  );
}
