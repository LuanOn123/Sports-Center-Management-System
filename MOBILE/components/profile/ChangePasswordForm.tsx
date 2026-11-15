// components/profile/ChangePasswordForm.tsx
// Tab "Bảo mật" của hồ sơ: đổi mật khẩu (web: ProfilePage / CoachProfile). Logic ở hooks/shared/useChangePassword;
// luật nhập ở lib/passwordChange.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeSyntheticEvent, TargetedEvent } from 'react-native';
import clsx from 'clsx';
import { Controller } from 'react-hook-form';
import { PasswordInput } from '../shared/PasswordInput';
import { useChangePassword } from '../../hooks/shared/useChangePassword';
import { PASSWORD_CHANGE_TEXT as TEXT } from '../../constants/profile';
import { Colors } from '../../constants/theme';
import type { PasswordChangeValues } from '../../lib/passwordChange';

type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

interface ChangePasswordFormProps {
  /** Cuộn tới ô đang nhập (màn hình cha quản lý ScrollView) */
  onFieldFocus: (fieldKey: string, e?: FocusEvent) => void;
  getInputRef: (fieldKey: string) => React.RefObject<any>;
}

const FIELDS: Array<{ name: keyof PasswordChangeValues; label: string; placeholder: string }> = [
  { name: 'currentPassword', label: TEXT.currentLabel, placeholder: '••••••••' },
  { name: 'newPassword', label: TEXT.newLabel, placeholder: TEXT.newPlaceholder },
  { name: 'confirmPassword', label: TEXT.confirmLabel, placeholder: TEXT.confirmPlaceholder },
];

export function ChangePasswordForm({ onFieldFocus, getInputRef }: ChangePasswordFormProps) {
  const { form, submit, isSubmitting } = useChangePassword();
  const { control, formState: { errors } } = form;

  return (
    <View className="bg-bg-surface rounded-xl p-xl border border-border mb-lg">
      {FIELDS.map((field) => (
        <View key={field.name} className="mb-lg">
          <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{field.label}</Text>
          <Controller
            control={control}
            name={field.name}
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput
                ref={getInputRef(field.name)}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                onFocus={(e) => onFieldFocus(field.name, e)}
                placeholder={field.placeholder}
                hasError={Boolean(errors[field.name])}
              />
            )}
          />
          {errors[field.name] && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors[field.name]?.message}</Text>}
        </View>
      ))}
      <TouchableOpacity
        className={clsx('bg-primary rounded-md p-md items-center mt-sm', isSubmitting && 'opacity-60')}
        onPress={() => { void submit(); }}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color={Colors.text.inverse} /> : <Text className="text-text-inverse font-bold font-bevn-bold text-md">{TEXT.submit}</Text>}
      </TouchableOpacity>
    </View>
  );
}
