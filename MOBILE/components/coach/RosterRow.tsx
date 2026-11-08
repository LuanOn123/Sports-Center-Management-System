// components/coach/RosterRow.tsx
// Một học viên trong danh sách điểm danh của HLV (web: AttendanceRow + coach-student-row): tên, trạng thái điểm danh,
// cảnh báo y tế, mục tiêu + tiến độ và nút "Đánh giá".

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../shared/Icon';
import { Colors } from '../../constants/theme';
import { ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL } from '../../constants/attendance';
import { GOAL_TEXT as TEXT } from '../../constants/goals';
import { rosterHealthNotes } from '../../lib/coachRoster';
import { evaluationDraft, progressLevel } from '../../lib/goalProgress';
import type { Attendance, Enrollment, ScheduleEvaluationItem } from '../../lib/types';

interface RosterRowProps {
  enrollment: Enrollment;
  record: Attendance | undefined;
  /** Còn ghi được điểm danh (chưa có bản ghi và đang trong cửa sổ điểm danh) */
  writable: boolean;
  disabled: boolean;
  /** Mục tiêu + tiến độ của học viên ở buổi này (chưa tải được thì chỉ có nút "Đánh giá") */
  evaluation: ScheduleEvaluationItem | undefined;
  onMark: () => void;
  onEvaluate: () => void;
  onOpenProfile: () => void;
}

export const learnerNameOf = (e: Enrollment) => e.member?.user?.fullName || `Học viên #${e.memberId.slice(-4)}`;

export function RosterRow({ enrollment, record, writable, disabled, evaluation, onMark, onEvaluate, onOpenProfile }: RosterRowProps) {
  const name = learnerNameOf(enrollment);
  const contact = enrollment.member?.user?.phone || enrollment.member?.user?.email;
  const healthNotes = rosterHealthNotes(enrollment);
  const statusColor = record ? ATTENDANCE_STATUS_COLOR[record.status] : Colors.text.muted;
  const progress = evaluation ? evaluationDraft(evaluation).progress : null;
  const level = progress === null ? null : progressLevel(progress);

  return (
    <View className="bg-bg-surface rounded-lg p-md border border-border gap-sm">
      <View className="flex-row items-center gap-md">
        <View className="w-[38px] h-[38px] rounded-full bg-bg-elevated items-center justify-center">
          <Text className="text-sm font-bevn-bold text-primary">{name.charAt(0).toUpperCase()}</Text>
        </View>
        <TouchableOpacity className="flex-1" onPress={onOpenProfile}>
          <View className="flex-row flex-wrap items-center gap-xs">
            <Text className="text-sm font-bevn-semibold text-text-primary">{name}</Text>
            {Boolean(healthNotes) && (
              <View className="flex-row items-center gap-0.5 rounded-sm px-xs py-0.5" style={{ backgroundColor: Colors.status.pending + '22' }}>
                <Icon name="warning" size={11} color={Colors.status.pending} />
                <Text className="text-[10px] font-bevn-bold" style={{ color: Colors.status.pending }}>{TEXT.healthBadge}</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-text-muted mt-0.5 font-bevn-regular" numberOfLines={1}>
            {record ? ATTENDANCE_STATUS_LABEL[record.status] : 'Chưa điểm danh'}
            {contact ? ` • ${contact}` : ''}
          </Text>
          <Text className="text-xs text-primary font-bevn-medium mt-xs">{TEXT.viewProfile}</Text>
        </TouchableOpacity>
        {record ? (
          <View className="px-sm py-1 rounded-md border" style={{ backgroundColor: statusColor + '20', borderColor: statusColor }}>
            <Text className="text-xs font-bevn-semibold" style={{ color: statusColor }}>{ATTENDANCE_STATUS_LABEL[record.status]}</Text>
          </View>
        ) : writable ? (
          <TouchableOpacity
            className="flex-row items-center gap-0.5 px-sm py-1 rounded-md border border-border bg-bg-elevated"
            onPress={onMark}
            disabled={disabled}
          >
            <Text className="text-xs font-bevn-semibold text-text-secondary">Điểm danh</Text>
            <Icon name="arrow-drop-down" size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {Boolean(healthNotes) && (
        <Text className="text-xs font-bevn-regular" style={{ color: Colors.status.pending }} numberOfLines={2}>⚠ {healthNotes}</Text>
      )}

      <View className="flex-row items-center gap-sm border-t border-divider pt-sm">
        <Icon name="track-changes" size={14} color={Colors.status.scheduled} />
        <Text className="flex-1 text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>
          {evaluation ? evaluation.goal : TEXT.studentGoal}
        </Text>
        {level && progress !== null && (
          <View className="rounded-full border px-sm py-0.5" style={{ borderColor: level.color + '66', backgroundColor: level.color + '18' }}>
            <Text className="text-xs font-bevn-bold" style={{ color: level.color }}>{progress}%</Text>
          </View>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${TEXT.evaluateButton} ${name}`}
          className="flex-row items-center gap-0.5 px-sm py-1 rounded-md border border-border bg-bg-elevated"
          onPress={onEvaluate}
        >
          <Icon name="trending-up" size={14} color={Colors.primary} />
          <Text className="text-xs font-bevn-semibold text-primary">{TEXT.evaluateButton}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
