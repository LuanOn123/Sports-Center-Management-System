// components/shared/PasswordInput.tsx
// Ô mật khẩu dùng chung (đăng nhập, đăng ký, quên mật khẩu, đổi mật khẩu): nút ẩn/hiện +
// sửa lỗi iOS xoá sạch mật khẩu khi quay lại ô và gõ tiếp (xem lib/secureText.ts).

import React, { forwardRef, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Platform } from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';
import clsx from 'clsx';
import { Icon } from './Icon';
import { Colors } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import { restoreSecureText } from '../../lib/secureText';

interface PasswordInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'> {
  value: string;
  onChangeText: (text: string) => void;
  hasError?: boolean;
  /** Cha điều khiển ẩn/hiện (vd: 2 ô dùng chung 1 nút); bỏ trống thì ô tự quản */
  revealed?: boolean;
  onToggleReveal?: () => void;
  /** Ẩn nút con mắt (ô đi kèm ô khác đã có nút) */
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<TextInputInstance, PasswordInputProps>(function PasswordInput(
  { value, onChangeText, hasError, revealed, onToggleReveal, showToggle = true, onFocus, ...inputProps },
  ref,
) {
  const [selfRevealed, setSelfRevealed] = useState(false);
  const shown = revealed ?? selfRevealed;
  // Đánh dấu vừa quay lại ô đang có chữ — chỉ iOS mới xoá sạch ở phím đầu tiên
  const refocused = useRef(false);

  const toggle = () => {
    Haptic.light();
    if (onToggleReveal) onToggleReveal();
    else setSelfRevealed((v) => !v);
  };

  return (
    <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border', showToggle && 'pr-sm', hasError ? 'border-status-failed' : 'border-border')}>
      <TextInput
        ref={ref}
        className="flex-1 p-md text-text-primary text-md font-bevn-regular"
        placeholderTextColor={Colors.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        secureTextEntry={!shown}
        value={value}
        onFocus={(e) => {
          refocused.current = Platform.OS === 'ios' && value.length > 0;
          onFocus?.(e);
        }}
        onChangeText={(text) => {
          const restore = refocused.current && !shown;
          refocused.current = false;
          onChangeText(restore ? restoreSecureText(value, text) : text);
        }}
      />
      {showToggle && (
        <TouchableOpacity
          className="p-sm justify-center items-center"
          onPress={toggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          <Icon name={shown ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
      )}
    </View>
  );
});
