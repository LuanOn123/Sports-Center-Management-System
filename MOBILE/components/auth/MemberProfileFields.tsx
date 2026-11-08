// components/auth/MemberProfileFields.tsx
// Trường hồ sơ hội viên khi đăng ký — dùng chung cho đăng ký bằng email và hoàn tất đăng ký Google (web: Register.tsx):
// số điện thoại (bắt buộc), giới tính, ngày sinh (tuổi 12–80) và mục tiêu tập luyện.
// Trả về Fragment để các ô là con trực tiếp của thẻ form — useFieldScroll đo vị trí ô theo thẻ đó.

import React from 'react';
import { Text, TextInput } from 'react-native';
import clsx from 'clsx';
import { Controller, useFormContext } from 'react-hook-form';
import { BirthDateField } from '../shared/BirthDateField';
import { FilterChip } from '../shared/FilterChip';
import { ChipGroup, FormField } from '../shared/FormField';
import { Colors } from '../../constants/theme';
import { REGISTER_TEXT as TEXT } from '../../constants/auth';
import {
  FITNESS_GOAL_OPTIONS, GENDER_OPTIONS, VN_PHONE_MAX_DIGITS, VN_PHONE_MIN_DIGITS, VN_PHONE_PREFIX,
} from '../../constants/profile';
import { normalizeVnPhoneInput } from '../../lib/businessRules';
import { toggleChoice } from '../../lib/profileFields';
import type { MemberProfileValues } from '../../lib/memberRegistration';
import type { FieldScroll } from '../../hooks/shared/useFieldScroll';

const INPUT_CLASS = 'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular';

export function MemberProfileFields({ scroll }: { scroll: FieldScroll }) {
  const { control, formState: { errors } } = useFormContext<MemberProfileValues>();

  return (
    <>
      <FormField label={TEXT.phone} required error={errors.phone?.message} onLayout={scroll.onFieldLayout('phone')}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className={clsx(INPUT_CLASS, errors.phone ? 'border-status-failed' : 'border-border')}
              placeholder={TEXT.phonePlaceholder}
              placeholderTextColor={Colors.text.muted}
              keyboardType="number-pad"
              autoComplete="tel"
              value={value ?? ''}
              onChangeText={(text) => onChange(normalizeVnPhoneInput(text))}
              onBlur={onBlur}
              onFocus={() => scroll.scrollToField('phone')}
            />
          )}
        />
        {!errors.phone && (
          <Text className="text-xs text-text-muted mt-1 font-bevn-regular">
            {`Bắt đầu bằng ${VN_PHONE_PREFIX}, gồm ${VN_PHONE_MIN_DIGITS}–${VN_PHONE_MAX_DIGITS} số`}
          </Text>
        )}
      </FormField>

      <FormField label={TEXT.gender} hint={TEXT.optional}>
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
      </FormField>

      <FormField label={TEXT.birthDate} hint={TEXT.optional} error={errors.dateOfBirth?.message}>
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field: { onChange, value } }) => (
            <BirthDateField value={value} onChange={onChange} hasError={Boolean(errors.dateOfBirth)} />
          )}
        />
      </FormField>

      <FormField label={TEXT.goal} hint={TEXT.goalHint} error={errors.fitnessGoalNote?.message} onLayout={scroll.onFieldLayout('fitnessGoalNote')}>
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
        <Controller
          control={control}
          name="fitnessGoalNote"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className={clsx(INPUT_CLASS, 'mt-md min-h-[64px]', errors.fitnessGoalNote ? 'border-status-failed' : 'border-border')}
              placeholder={TEXT.goalPlaceholder}
              placeholderTextColor={Colors.text.muted}
              multiline
              textAlignVertical="top"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              onFocus={() => scroll.scrollToField('fitnessGoalNote')}
            />
          )}
        />
      </FormField>
    </>
  );
}
