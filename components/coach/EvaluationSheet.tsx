// components/coach/EvaluationSheet.tsx
// HLV chấm tiến độ mục tiêu của một học viên sau buổi dạy kèm lời dặn (web: khối đánh giá trong shared/Attendance.tsx):
// tiến độ 0–100% chỉnh theo bước 5 (nút −/+ và mốc chọn nhanh), hiện chênh lệch so với lần trước, lời dặn tối đa 1000 ký tự.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { BottomSheet } from '../shared/BottomSheet';
import { FilterChip } from '../shared/FilterChip';
import { GoalProgressLegend } from '../shared/GoalProgressBar';
import { Icon } from '../shared/Icon';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ApiError } from '../../lib/api';
import { Colors } from '../../constants/theme';
import {
  DEFAULT_GOAL_LABEL, EVALUATION_NOTE_MAX_LENGTH, GOAL_TEXT as TEXT, PROGRESS_MAX, PROGRESS_MIN, PROGRESS_PRESETS, PROGRESS_STEP,
} from '../../constants/goals';
import { evaluationDraft, evaluationNoteOrNull, formatProgressDiff, progressDiff, progressLevel, stepProgress } from '../../lib/goalProgress';
import type { ScheduleEvaluationItem } from '../../lib/types';

interface EvaluationSheetProps {
  visible: boolean;
  learnerName: string;
  /** Mục tiêu + tiến độ hiện tại của học viên ở buổi này; chưa tải được thì chấm từ 0% như web */
  item: ScheduleEvaluationItem | undefined;
  isPending: boolean;
  error: unknown;
  onSave: (progress: number, note: string | null) => void;
  onClose: () => void;
}

function StepButton({ icon, label, disabled, onPress }: { icon: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="w-11 h-11 rounded-full items-center justify-center bg-bg-surface border border-border"
      style={{ opacity: disabled ? 0.4 : 1 }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Icon name={icon} size={20} color={Colors.text.primary} />
    </TouchableOpacity>
  );
}

export function EvaluationSheet({ visible, learnerName, item, isPending, error, onSave, onClose }: EvaluationSheetProps) {
  const [progress, setProgress] = useState(PROGRESS_MIN);
  const [note, setNote] = useState('');
  const loaded = Boolean(item);
  const draft = evaluationDraft(item);

  // Mỗi lần mở (hoặc dữ liệu học viên vừa tải xong): bắt đầu từ kết quả buổi này, chưa có thì từ tiến độ hiện tại
  useEffect(() => {
    if (!visible) return;
    setProgress(draft.progress);
    setNote(draft.note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, item?.memberId, loaded]);

  const level = progressLevel(progress);
  const diff = progressDiff(draft.previousProgress, progress);

  return (
    <BottomSheet
      visible={visible}
      title={TEXT.evaluateTitle}
      caption={learnerName}
      onClose={onClose}
      dismissible={!isPending}
      footer={
        <View className="flex-row gap-md">
          <Button className="flex-1" variant="secondary" title={TEXT.cancel} onPress={onClose} disabled={isPending} />
          <Button
            className="flex-[2]"
            icon="check-circle"
            title={isPending ? TEXT.evaluateSaving : TEXT.evaluateSave}
            loading={isPending}
            onPress={() => onSave(progress, evaluationNoteOrNull(note))}
          />
        </View>
      }
    >
      <View className="flex-row items-start gap-sm">
        <Icon name="track-changes" size={16} color={Colors.status.scheduled} style={{ marginTop: 2 }} />
        <Text className="flex-1 text-sm text-text-secondary font-bevn-regular">
          <Text className="font-bevn-bold text-text-primary">{TEXT.studentGoal}</Text> {item?.goal || DEFAULT_GOAL_LABEL}
        </Text>
      </View>

      <View className="bg-bg-elevated rounded-lg p-md border border-border gap-md">
        <View className="flex-row items-center justify-between gap-sm">
          <Text className="flex-1 text-sm font-bevn-semibold text-text-primary">{TEXT.evaluateProgressLabel}</Text>
          {diff !== 0 && (
            <View className="rounded-sm px-sm py-0.5" style={{ backgroundColor: (diff > 0 ? Colors.status.success : Colors.status.failed) + '22' }}>
              <Text className="text-xs font-bevn-bold" style={{ color: diff > 0 ? Colors.status.success : Colors.status.failed }}>{formatProgressDiff(diff)}</Text>
            </View>
          )}
          <Text className="text-xl font-bevn-bold" style={{ color: level.color }}>{progress}%</Text>
        </View>

        <View className="flex-row items-center gap-md">
          <StepButton icon="remove" label={`Giảm ${PROGRESS_STEP}%`} disabled={isPending || progress <= PROGRESS_MIN} onPress={() => setProgress(stepProgress(progress, -1))} />
          <View className="flex-1 gap-xs">
            <ProgressBar value={progress / PROGRESS_MAX} color={level.color} size="md" />
            <Text className="text-xs font-bevn-semibold text-center" style={{ color: level.color }}>{level.label}</Text>
          </View>
          <StepButton icon="add" label={`Tăng ${PROGRESS_STEP}%`} disabled={isPending || progress >= PROGRESS_MAX} onPress={() => setProgress(stepProgress(progress, 1))} />
        </View>

        <View className="flex-row flex-wrap gap-sm">
          {PROGRESS_PRESETS.map((preset) => (
            <FilterChip key={preset} label={`${preset}%`} active={progress === preset} onPress={() => setProgress(preset)} />
          ))}
        </View>
        <GoalProgressLegend />
      </View>

      <View className="gap-sm">
        <View className="flex-row items-center gap-1.5">
          <Icon name="chat-bubble-outline" size={15} color={Colors.text.secondary} />
          <Text className="text-sm font-bevn-semibold text-text-primary">{TEXT.evaluateNoteLabel}</Text>
        </View>
        <TextInput
          accessibilityLabel={TEXT.evaluateNoteLabel}
          className="bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular min-h-[88px]"
          value={note}
          onChangeText={setNote}
          maxLength={EVALUATION_NOTE_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          editable={!isPending}
          placeholder={TEXT.evaluateNotePlaceholder}
          placeholderTextColor={Colors.text.muted}
        />
        <Text className="text-xs text-text-muted font-bevn-regular text-right">{note.length}/{EVALUATION_NOTE_MAX_LENGTH}</Text>
      </View>

      {Boolean(error) && (
        <Text accessibilityRole="alert" className="text-xs text-status-failed font-bevn-regular">
          {error instanceof ApiError ? error.message : TEXT.evaluateFailed}
        </Text>
      )}
    </BottomSheet>
  );
}
