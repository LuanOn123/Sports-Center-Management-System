// components/member/EnrollConfirmSheet.tsx
// Xác nhận đăng ký trọn khóa — giống modal của web (EnrollConfirmModal): tóm tắt lớp, mục tiêu trong khóa này
// (điền sẵn từ hồ sơ, tùy chọn), lưu ý sức khỏe cho HLV và "lưu vào hồ sơ". Gửi cùng POST /enrollments/bulk.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { BottomSheet } from '../shared/BottomSheet';
import { Icon } from '../shared/Icon';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/theme';
import { GOAL_MAX_LENGTH, GOAL_TEXT as TEXT, HEALTH_NOTES_MAX_LENGTH, HEALTH_NOTES_WARN_LENGTH } from '../../constants/goals';
import type { EnrollSummary } from '../../lib/classPlan';
import type { EnrollFormValues } from '../../lib/enrollOptions';

interface EnrollConfirmSheetProps {
  visible: boolean;
  summary: EnrollSummary | null;
  /** Mục tiêu trong hồ sơ cá nhân (memberProfile.fitnessGoal) — điền sẵn như web */
  initialGoal: string;
  /** Ghi chú sức khỏe trong hồ sơ (memberProfile.healthNotes) — điền sẵn như web */
  initialHealthNotes: string;
  isPending: boolean;
  onConfirm: (values: EnrollFormValues) => void;
  onClose: () => void;
}

const INPUT_CLASS = 'bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular';

function SectionLabel({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 flex-1">
      <Icon name={icon} size={16} color={color} />
      <Text className="flex-1 text-sm text-text-primary font-bevn-semibold">{children}</Text>
    </View>
  );
}

export function EnrollConfirmSheet({ visible, summary, initialGoal, initialHealthNotes, isPending, onConfirm, onClose }: EnrollConfirmSheetProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [healthNotes, setHealthNotes] = useState(initialHealthNotes);
  const [saveToProfile, setSaveToProfile] = useState(false);

  // Mỗi lần mở: điền sẵn từ hồ sơ và chưa lưu ngược vào hồ sơ (web: useEffect theo isOpen)
  useEffect(() => {
    if (!visible) return;
    setGoal(initialGoal);
    setHealthNotes(initialHealthNotes);
    setSaveToProfile(false);
  }, [visible, initialGoal, initialHealthNotes]);

  const usingProfileGoal = Boolean(initialGoal) && goal === initialGoal;
  const facts = summary
    ? [
        summary.sessions ? TEXT.summarySessions(summary.sessions) : null,
        summary.time ?? null,
        summary.coach ? TEXT.summaryCoach(summary.coach) : null,
        summary.room ? TEXT.summaryRoom(summary.room) : null,
      ].filter((fact): fact is string => Boolean(fact))
    : [];

  return (
    <BottomSheet
      visible={visible}
      title={TEXT.enrollTitle}
      onClose={onClose}
      dismissible={!isPending}
      footer={
        <View className="flex-row gap-md">
          <Button className="flex-1" variant="secondary" title={TEXT.cancel} onPress={onClose} disabled={isPending} />
          <Button
            className="flex-[2]"
            title={isPending ? TEXT.enrollBusy : TEXT.enrollConfirm}
            icon="event-available"
            loading={isPending}
            onPress={() => onConfirm({ goal, healthNotes, saveToProfile })}
          />
        </View>
      }
    >
      {summary && (
        <View className="bg-bg-elevated rounded-lg p-md border border-border gap-xs">
          <View className="flex-row items-center justify-between gap-sm">
            <Text className="flex-1 text-md text-text-primary font-bevn-bold">{summary.name}</Text>
            {Boolean(summary.sport) && (
              <View className="rounded-sm px-sm py-0.5" style={{ backgroundColor: Colors.status.scheduled + '22' }}>
                <Text className="text-xs font-bevn-bold" style={{ color: Colors.status.scheduled }}>{summary.sport}</Text>
              </View>
            )}
          </View>
          {facts.map((fact) => (
            <Text key={fact} className="text-xs text-text-secondary font-bevn-regular">• {fact}</Text>
          ))}
        </View>
      )}

      {/* Mục tiêu trong khóa này */}
      <View className="gap-sm">
        <View className="flex-row items-center justify-between gap-sm">
          <SectionLabel icon="track-changes" color={Colors.status.scheduled}>
            {TEXT.goalLabel} <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.optional}</Text>
          </SectionLabel>
        </View>
        {Boolean(initialGoal) && (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              className={clsx('self-start flex-row items-center gap-1.5 rounded-md border px-md py-xs', usingProfileGoal ? 'border-status-scheduled bg-bg-elevated' : 'border-border bg-bg-surface')}
              onPress={() => setGoal(initialGoal)}
            >
              <Icon name="track-changes" size={13} color={usingProfileGoal ? Colors.status.scheduled : Colors.text.secondary} />
              <Text className="text-xs font-bevn-semibold" style={{ color: usingProfileGoal ? Colors.status.scheduled : Colors.text.secondary }}>
                {usingProfileGoal ? TEXT.usingProfileGoal : TEXT.useProfileGoal}
              </Text>
            </TouchableOpacity>
            <View className="rounded-md px-md py-sm border border-dashed" style={{ borderColor: Colors.status.scheduled + '66', backgroundColor: Colors.status.scheduled + '12' }}>
              <Text className="text-xs text-text-secondary font-bevn-regular">{TEXT.profileGoalLine(initialGoal)}</Text>
            </View>
          </>
        )}
        <TextInput
          accessibilityLabel={TEXT.goalLabel}
          className={clsx(INPUT_CLASS, 'min-h-[48px]')}
          value={goal}
          onChangeText={setGoal}
          maxLength={GOAL_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          editable={!isPending}
          placeholder={TEXT.goalPlaceholder}
          placeholderTextColor={Colors.text.muted}
        />
        <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.goalHint}</Text>
        <View className="flex-row items-center justify-between rounded-md px-md py-sm border" style={{ borderColor: Colors.status.scheduled + '40', backgroundColor: Colors.status.scheduled + '12' }}>
          <Text className="text-sm font-bevn-medium" style={{ color: Colors.status.scheduled }}>{TEXT.initialProgressLabel}</Text>
          <View className="rounded-sm px-sm py-0.5" style={{ backgroundColor: Colors.status.failed + '22' }}>
            <Text className="text-xs font-bevn-bold" style={{ color: Colors.status.failed }}>{TEXT.initialProgressValue}</Text>
          </View>
        </View>
      </View>

      {/* Lưu ý sức khỏe cho HLV */}
      <View className="gap-sm">
        <SectionLabel icon="favorite" color={Colors.status.failed}>{TEXT.healthLabel}</SectionLabel>
        <TextInput
          accessibilityLabel={TEXT.healthLabel}
          className={clsx(INPUT_CLASS, 'min-h-[96px]')}
          value={healthNotes}
          onChangeText={setHealthNotes}
          maxLength={HEALTH_NOTES_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          editable={!isPending}
          placeholder={TEXT.healthPlaceholder}
          placeholderTextColor={Colors.text.muted}
        />
        <Text
          className="text-xs font-bevn-regular text-right"
          style={{ color: healthNotes.length >= HEALTH_NOTES_WARN_LENGTH ? Colors.status.failed : Colors.text.muted }}
        >
          {TEXT.healthCounter(healthNotes.length)}
        </Text>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saveToProfile }}
          className="flex-row items-center gap-sm"
          onPress={() => setSaveToProfile((value) => !value)}
          disabled={isPending}
        >
          <Icon name={saveToProfile ? 'check-box' : 'check-box-outline-blank'} size={22} color={saveToProfile ? Colors.primary : Colors.text.muted} />
          <Text className="flex-1 text-sm text-text-primary font-bevn-regular">{TEXT.saveToProfile}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.enrollAllOrNothing}</Text>
    </BottomSheet>
  );
}
