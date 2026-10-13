// components/profile/ProfileInfoForm.tsx
// Form "Thông tin cá nhân" chia 2 nhóm: Thông tin cá nhân (tên, ngày sinh, giới tính, SĐT)
// và Thông tin tập luyện (mục tiêu, trình độ, thời gian tập — chỉ tài khoản MEMBER).
// Logic ở hooks/shared/useProfileInfoForm.ts; lựa chọn ở constants/profile.ts.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeSyntheticEvent, TargetedEvent } from 'react-native';
import clsx from 'clsx';
import { Controller } from 'react-hook-form';
import { Icon } from '../shared/Icon';
import { FilterChip } from '../shared/FilterChip';
import { BirthDateField } from '../shared/BirthDateField';
import { Colors } from '../../constants/theme';
import { toggleChoice } from '../../lib/profileFields';
import { useProfileInfoForm } from '../../hooks/shared/useProfileInfoForm';
import {
  FITNESS_GOAL_OPTIONS,
  GENDER_OPTIONS,
  TRAINING_LEVEL_OPTIONS,
  TRAINING_TIME_OPTIONS,
} from '../../constants/profile';

type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

interface ProfileInfoFormProps {
  /** Cuộn tới ô đang nhập (màn hình cha quản lý ScrollView) */
  onFieldFocus: (fieldKey: string, e?: FocusEvent) => void;
  getInputRef: (fieldKey: string) => React.RefObject<any>;
}

const INPUT_CLASS = 'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View className="bg-bg-surface rounded-xl p-xl border border-border mb-lg">
      <View className="flex-row items-center gap-sm mb-lg">
        <Icon name={icon} size={18} color={Colors.primary} />
        <Text className="text-md font-bevn-bold text-text-primary">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="mb-lg">
      <Text className="text-sm text-text-secondary mb-sm font-bevn-medium">
        {label}
        {hint ? <Text className="text-xs text-text-muted font-bevn-regular">{`  ${hint}`}</Text> : null}
      </Text>
      {children}
      {error ? <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{error}</Text> : null}
    </View>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-sm">{children}</View>;
}

export function ProfileInfoForm({ onFieldFocus, getInputRef }: ProfileInfoFormProps) {
  const { form, hasMemberFields, isSaving, submit } = useProfileInfoForm();
  const { control, formState: { errors } } = form;

  const textInput = (name: 'fullName' | 'phone' | 'fitnessGoalNote' | 'trainingNote', props: React.ComponentProps<typeof TextInput>) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          ref={getInputRef(name)}
          className={clsx(INPUT_CLASS, errors[name] ? 'border-status-failed' : 'border-border')}
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          onFocus={(e) => onFieldFocus(name, e)}
          placeholderTextColor={Colors.text.muted}
          {...props}
        />
      )}
    />
  );

  return (
    <View>
      <Section icon="person" title="Thông tin cá nhân">
        <Field label="Họ và tên" error={errors.fullName?.message}>
          {textInput('fullName', { placeholder: 'Nhập họ và tên...', autoComplete: 'name' })}
        </Field>

        <Field label="Ngày sinh" error={errors.dateOfBirth?.message}>
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { value, onChange } }) => (
              <BirthDateField value={value} onChange={onChange} hasError={Boolean(errors.dateOfBirth)} />
            )}
          />
        </Field>

        <Field label="Giới tính" hint="(không bắt buộc)">
          <Controller
            control={control}
            name="gender"
            render={({ field: { value, onChange } }) => (
              <ChipGroup>
                {GENDER_OPTIONS.map((o) => (
                  <FilterChip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(value === o.value ? undefined : o.value)} />
                ))}
              </ChipGroup>
            )}
          />
        </Field>

        <Field label="Số điện thoại" error={errors.phone?.message}>
          {textInput('phone', { placeholder: 'Nhập số điện thoại...', keyboardType: 'phone-pad', autoComplete: 'tel' })}
        </Field>
      </Section>

      {hasMemberFields && (
        <Section icon="fitness-center" title="Thông tin tập luyện">
          <Field label="Mục tiêu tập luyện" hint="(chọn nhiều)" error={errors.fitnessGoalNote?.message}>
            <Controller
              control={control}
              name="fitnessGoals"
              render={({ field: { value, onChange } }) => (
                <ChipGroup>
                  {FITNESS_GOAL_OPTIONS.map((o) => (
                    <FilterChip key={o} label={o} active={value.includes(o)} onPress={() => onChange(toggleChoice(value, o))} />
                  ))}
                </ChipGroup>
              )}
            />
            <View className="mt-md">
              {textInput('fitnessGoalNote', { placeholder: 'Mô tả thêm (không bắt buộc)...', multiline: true, textAlignVertical: 'top', style: { minHeight: 64 } })}
            </View>
          </Field>

          <Field label="Trình độ tập luyện">
            <Controller
              control={control}
              name="trainingLevel"
              render={({ field: { value, onChange } }) => (
                <ChipGroup>
                  {TRAINING_LEVEL_OPTIONS.map((o) => (
                    <FilterChip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
                  ))}
                </ChipGroup>
              )}
            />
          </Field>

          <Field label="Thời gian tập yêu thích" hint="(chọn nhiều)" error={errors.trainingNote?.message}>
            <Controller
              control={control}
              name="trainingTimes"
              render={({ field: { value, onChange } }) => (
                <ChipGroup>
                  {TRAINING_TIME_OPTIONS.map((o) => (
                    <FilterChip key={o} label={o} active={value.includes(o)} onPress={() => onChange(toggleChoice(value, o))} />
                  ))}
                </ChipGroup>
              )}
            />
            <View className="mt-md">
              {textInput('trainingNote', { placeholder: 'Ghi chú thêm: môn yêu thích, chấn thương cần lưu ý...' })}
            </View>
          </Field>
        </Section>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        className={clsx('flex-row bg-primary rounded-md p-md items-center justify-center gap-sm mb-xl', isSaving && 'opacity-60')}
        onPress={submit}
        disabled={isSaving}
      >
        {isSaving ? <ActivityIndicator color={Colors.text.inverse} /> : <Icon name="check-circle" size={18} color={Colors.text.inverse} />}
        <Text className="text-text-inverse font-bevn-bold text-md">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
      </TouchableOpacity>
    </View>
  );
}
