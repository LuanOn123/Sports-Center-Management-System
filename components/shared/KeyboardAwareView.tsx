/**
 * KeyboardAwareView — dùng thay thế KeyboardAvoidingView ở tất cả các màn hình.
 *
 * - Web   : render View thường — KAV gây re-render -> blur input ngay lập tức trên web
 * - iOS   : behavior="padding" (đẩy nội dung lên trên keyboard)
 * - Android: behavior="height" (thu nhỏ chiều cao để tránh keyboard)
 */
import React from 'react';
import { KeyboardAvoidingView, View, Platform, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function KeyboardAwareView({ children, style, className }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1 }, style]} className={className}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      className={className}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
