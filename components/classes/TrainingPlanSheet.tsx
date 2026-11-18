// components/classes/TrainingPlanSheet.tsx
// Bảng tạo / sửa giáo án của HLV (web: form "training-editor" trong shared/TrainingPlans): giao cho cả lớp hoặc một hội viên,
// tiêu đề, bản nháp do AI soạn theo mục tiêu HLV nêu, nội dung và bài tập về nhà. Logic ở hooks/shared/useTrainingPlans.

import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { BottomSheet } from '../shared/BottomSheet';
import { Icon } from '../shared/Icon';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/theme';
import { TRAINING_PLAN_LIMITS as LIMITS, TRAINING_PLAN_MEMBER_LIST_MAX_HEIGHT, TRAINING_PLAN_TEXT as TEXT } from '../../constants/trainingPlans';
import type { TrainingPlanEditor } from '../../hooks/shared/useTrainingPlans';
import type { TrainingPlanMember } from '../../lib/types';

const INPUT_CLASS = 'bg-bg-elevated border border-border rounded-md p-md text-text-primary text-md font-bevn-regular';

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

function RecipientOption({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.8}
      className={clsx('flex-row items-center gap-sm rounded-md px-md py-sm border', selected ? 'border-primary bg-bg-elevated' : 'border-border')}
    >
      <Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={selected ? Colors.primary : Colors.text.muted} />
      <Text className="flex-1 text-sm text-text-primary font-bevn-medium" numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Counter({ length, max }: { length: number; max: number }) {
  return <Text className="text-xs text-text-muted font-bevn-regular text-right">{TEXT.counter(length, max)}</Text>;
}

export function TrainingPlanSheet({ editor, members }: { editor: TrainingPlanEditor; members: readonly TrainingPlanMember[] }) {
  const { form, busy } = editor;
  const saveError = editor.save.error;

  return (
    <BottomSheet
      visible={editor.open}
      title={editor.editing ? TEXT.editTitle : TEXT.createTitle}
      onClose={editor.close}
      dismissible={!busy}
      footer={
        <View className="gap-sm">
          {saveError ? (
            <Text accessibilityRole="alert" className="text-xs text-status-failed font-bevn-regular">{messageOf(saveError, TEXT.saveFailed)}</Text>
          ) : null}
          <View className="flex-row gap-md">
            <Button className="flex-1" variant="secondary" title={TEXT.cancel} onPress={editor.close} disabled={busy} />
            <Button
              className="flex-[2]"
              icon={editor.editing ? 'save' : 'send'}
              title={editor.save.isPending ? TEXT.saving : editor.editing ? TEXT.save : TEXT.assign}
              loading={editor.save.isPending}
              disabled={!editor.canSubmit}
              onPress={editor.submit}
            />
          </View>
        </View>
      }
    >
      {/* Giao cho: chỉ chọn lúc tạo — giáo án đã giao thì không đổi người nhận được */}
      <View className="gap-xs">
        <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.assignTo}</Text>
        {editor.editing ? (
          <View className="flex-row items-center gap-sm rounded-md px-md py-sm border border-border bg-bg-elevated">
            <Icon name="lock" size={14} color={Colors.text.muted} />
            <Text className="flex-1 text-sm text-text-primary font-bevn-medium" numberOfLines={1}>{editor.recipient}</Text>
          </View>
        ) : (
          <ScrollView nestedScrollEnabled style={{ maxHeight: TRAINING_PLAN_MEMBER_LIST_MAX_HEIGHT }} contentContainerStyle={{ gap: 8 }}>
            <RecipientOption label={TEXT.wholeClassOption} selected={!form.memberId} disabled={busy} onPress={() => editor.setField('memberId', '')} />
            {members.map((member) => (
              <RecipientOption key={member.id} label={member.name} selected={form.memberId === member.id} disabled={busy} onPress={() => editor.setField('memberId', member.id)} />
            ))}
          </ScrollView>
        )}
      </View>

      <View className="gap-xs">
        <Text className="text-sm text-text-secondary font-bevn-medium">
          {TEXT.titleLabel}
          <Text className="text-status-failed font-bevn-medium">{' *'}</Text>
        </Text>
        <TextInput
          accessibilityLabel={TEXT.titleLabel}
          value={form.title}
          onChangeText={(value) => editor.setField('title', value)}
          editable={!busy}
          maxLength={LIMITS.titleMax}
          placeholderTextColor={Colors.text.muted}
          className={INPUT_CLASS}
        />
        {editor.errors.title ? <Text className="text-xs text-status-failed font-bevn-regular">{editor.errors.title}</Text> : null}
      </View>

      {/* Nhờ AI soạn bản nháp theo mục tiêu — HLV rà soát rồi mới giao */}
      <View className="gap-xs rounded-md p-md border border-border">
        <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.objectiveLabel}</Text>
        <TextInput
          accessibilityLabel={TEXT.objectiveLabel}
          value={editor.objective}
          onChangeText={editor.setObjective}
          editable={!busy}
          maxLength={LIMITS.objectiveMax}
          placeholderTextColor={Colors.text.muted}
          className={INPUT_CLASS}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="auto-awesome"
          title={editor.suggest.isPending ? TEXT.suggesting : TEXT.suggest}
          loading={editor.suggest.isPending}
          disabled={busy}
          onPress={editor.suggest.run}
          className="mt-xs"
        />
        {editor.suggest.outcome ? (
          <Text accessibilityRole="alert" className="text-xs text-text-secondary font-bevn-regular">
            {editor.suggest.outcome === 'filled' ? TEXT.suggested : TEXT.suggestEmpty}
          </Text>
        ) : null}
        {editor.suggest.error ? (
          <Text accessibilityRole="alert" className="text-xs text-status-failed font-bevn-regular">{messageOf(editor.suggest.error, TEXT.suggestFailed)}</Text>
        ) : null}
      </View>

      <View className="gap-xs">
        <Text className="text-sm text-text-secondary font-bevn-medium">
          {TEXT.instructionsLabel}
          <Text className="text-status-failed font-bevn-medium">{' *'}</Text>
        </Text>
        <TextInput
          accessibilityLabel={TEXT.instructionsLabel}
          value={form.instructions}
          onChangeText={(value) => editor.setField('instructions', value)}
          editable={!busy}
          multiline
          maxLength={LIMITS.instructionsMax}
          textAlignVertical="top"
          placeholderTextColor={Colors.text.muted}
          className={clsx(INPUT_CLASS, 'min-h-[160px]')}
        />
        <View className="flex-row justify-between gap-sm">
          <Text className="flex-1 text-xs text-status-failed font-bevn-regular">{editor.errors.instructions ?? ''}</Text>
          <Counter length={form.instructions.length} max={LIMITS.instructionsMax} />
        </View>
      </View>

      <View className="gap-xs">
        <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.homeworkLabel}</Text>
        <TextInput
          accessibilityLabel={TEXT.homeworkLabel}
          value={form.homework}
          onChangeText={(value) => editor.setField('homework', value)}
          editable={!busy}
          multiline
          maxLength={LIMITS.homeworkMax}
          textAlignVertical="top"
          placeholderTextColor={Colors.text.muted}
          className={clsx(INPUT_CLASS, 'min-h-[88px]')}
        />
        <Counter length={form.homework.length} max={LIMITS.homeworkMax} />
      </View>
    </BottomSheet>
  );
}
