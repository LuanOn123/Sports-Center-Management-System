// components/auth/GoogleSignInSection.tsx
// Phần "HOẶC TIẾP TỤC VỚI / HOẶC ĐĂNG KÝ NHANH VỚI" + nút Google đặt DƯỚI nút Đăng nhập / Đăng ký, giống web.
// Logic (lấy ID token, đăng nhập, mời đăng ký khi email chưa có tài khoản) ở hooks/shared/useGoogleAuth.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGoogleAuth, type GoogleAuthMode } from '../../hooks/shared/useGoogleAuth';
import { Colors } from '../../constants/theme';
import { GOOGLE_TEXT as TEXT } from '../../constants/auth';

export function GoogleSignInSection({ mode }: { mode: GoogleAuthMode }) {
  const { busy, start } = useGoogleAuth(mode);
  const label = mode === 'login' ? TEXT.loginButton : TEXT.registerButton;

  return (
    <View className="mt-xl">
      <View className="flex-row items-center gap-md mb-md">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-xs text-text-muted font-bevn-semibold">{mode === 'login' ? TEXT.loginDivider : TEXT.registerDivider}</Text>
        <View className="flex-1 h-px bg-border" />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy, disabled: busy }}
        className="flex-row items-center justify-center gap-sm rounded-md border border-border bg-bg-elevated p-md"
        style={{ opacity: busy ? 0.6 : 1 }}
        onPress={() => { void start(); }}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator size="small" color={Colors.text.primary} />
        ) : (
          <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
            <Text className="text-sm font-bevn-bold" style={{ color: Colors.brand.google }}>G</Text>
          </View>
        )}
        <Text className="text-md text-text-primary font-bevn-semibold">{label}</Text>
      </TouchableOpacity>
    </View>
  );
}
