import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  View,
  Platform,
  Keyboard,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  behavior?: 'padding' | 'height' | 'position';
  keyboardVerticalOffset?: number;
}

export function KeyboardAwareView({
  children,
  style,
  className,
  behavior,
  keyboardVerticalOffset = 0,
}: Props) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Web: View thường
  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1 }, style]} className={className}>
        {children}
      </View>
    );
  }

  // iOS: KeyboardAvoidingView với padding
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        className={className}
        behavior={behavior ?? 'padding'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  // Android: Tự động nâng toàn bộ layout lên trên bàn phím chuẩn xác kèm offset bù trừ thanh điều hướng
  return (
    <View
      style={[
        { flex: 1 },
        keyboardHeight > 0
          ? { paddingBottom: keyboardHeight + (keyboardVerticalOffset || 26) }
          : null,
        style,
      ]}
      className={className}
    >
      {children}
    </View>
  );
}
