// components/shared/BirthDateField.tsx
// Ô chọn ngày sinh (hồ sơ + đăng ký): bấm để mở DatePickerSheet, chỉ cho chọn ngày sinh
// ứng với độ tuổi MIN_MEMBER_AGE–MAX_MEMBER_AGE (constants/profile.ts).

import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Icon } from './Icon';
import { DatePickerSheet } from './DatePickerSheet';
import { Colors } from '../../constants/theme';
import { DEFAULT_BIRTH_AGE, MAX_MEMBER_AGE, MIN_MEMBER_AGE } from '../../constants/profile';
import { birthDateBounds, formatIsoDate, todayParts } from '../../lib/profileFields';

interface BirthDateFieldProps {
  /** "YYYY-MM-DD" hoặc rỗng */
  value?: string;
  onChange: (isoDate: string) => void;
  hasError?: boolean;
}

export function BirthDateField({ value, onChange, hasError }: BirthDateFieldProps) {
  const [open, setOpen] = useState(false);
  const { bounds, defaultValue } = useMemo(() => {
    const today = todayParts();
    return {
      bounds: birthDateBounds(today, MIN_MEMBER_AGE, MAX_MEMBER_AGE),
      defaultValue: { year: today.year - DEFAULT_BIRTH_AGE, month: 1, day: 1 },
    };
  }, []);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Chọn ngày sinh"
        className={clsx('bg-bg-elevated rounded-md p-md border flex-row items-center justify-between', hasError ? 'border-status-failed' : 'border-border')}
        onPress={() => setOpen(true)}
      >
        <Text className={clsx('text-md font-bevn-regular', value ? 'text-text-primary' : 'text-text-muted')}>
          {formatIsoDate(value) || 'Chọn ngày sinh'}
        </Text>
        <Icon name="calendar-today" size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
      <Text className="text-xs text-text-muted font-bevn-regular mt-1">{`Độ tuổi từ ${MIN_MEMBER_AGE} đến ${MAX_MEMBER_AGE}`}</Text>
      <DatePickerSheet
        visible={open}
        title="Chọn ngày sinh"
        value={value}
        defaultValue={defaultValue}
        min={bounds.min}
        max={bounds.max}
        onConfirm={(date) => {
          onChange(date);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
