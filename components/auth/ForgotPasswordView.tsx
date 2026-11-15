// components/auth/ForgotPasswordView.tsx
// Quên mật khẩu qua OTP email (web: features/auth/ForgotPassword.tsx) — 2 bước trên cùng một màn: nhập email → nhập OTP + mật khẩu mới.
// Logic ở hooks/shared/useForgotPassword; quy tắc OTP ở lib/passwordReset.

import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '../shared/Brand';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { PasswordInput } from '../shared/PasswordInput';
import { useForgotPassword } from '../../hooks/shared/useForgotPassword';
import { useKeyboard } from '../../hooks/shared/useKeyboard';
import {
  OTP_LENGTH, PASSWORD_RESET_FORM_TEXT as TEXT, PASSWORD_RESET_SCROLL as SCROLL, PASSWORD_RESET_TEXT,
} from '../../constants/passwordReset';
import { Colors } from '../../constants/theme';
import { formatCountdown } from '../../lib/format';
import { Haptic } from '../../lib/haptics';
import { ROUTES } from '../../navigation/routes';

export function ForgotPasswordView() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();
  const f = useForgotPassword();
  const { otpInfo } = f;
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  /** Cuộn tới ô đang nhập để bàn phím không che */
  const scrollTo = (offset: number) => {
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: offset, animated: true }), SCROLL.delayMs);
  };

  const resendLabel = otpInfo.resendWaitMs > 0 ? PASSWORD_RESET_TEXT.resendIn(formatCountdown(otpInfo.resendWaitMs)) : undefined;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: keyboard.visible ? 'flex-start' : 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24) + (keyboard.visible ? 10 : 20),
          paddingBottom: Math.max(insets.bottom, 20) + (keyboard.visible ? 40 : 16),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View className="items-center mb-xl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">{TEXT.headerSubtitle}</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-surface rounded-xl p-xl border border-border">
          {f.step === 'email' ? (
            <>
              <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-sm text-center">{TEXT.emailTitle}</Text>
              <Text className="text-sm text-text-secondary mb-xl text-center font-bevn-regular">{TEXT.emailHint}</Text>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.emailLabel}</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={f.email}
                  onChangeText={f.setEmail}
                  onFocus={() => scrollTo(SCROLL.email)}
                />
              </View>

              <TouchableOpacity
                className={clsx('bg-primary rounded-md p-md items-center justify-center', (f.sending || otpInfo.resendWaitMs > 0) && 'opacity-60')}
                onPress={() => { void f.sendOtp(); }}
                disabled={f.sending || otpInfo.resendWaitMs > 0}
                activeOpacity={0.85}
              >
                {f.sending
                  ? <ActivityIndicator color={Colors.text.inverse} />
                  : <Text className="text-text-inverse text-md font-bold font-bevn-bold">{resendLabel ?? PASSWORD_RESET_TEXT.sendButton}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-sm text-center">{TEXT.resetTitle}</Text>
              <Text className="text-sm text-text-secondary mb-lg text-center font-bevn-regular">
                {TEXT.sentTo} <Text className="text-text-primary font-bevn-semibold">{f.email}</Text>
              </Text>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.otpLabel}</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular text-center tracking-[6px]"
                  placeholder="000000"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  value={f.otp}
                  onChangeText={f.setOtp}
                  onFocus={() => scrollTo(SCROLL.otp)}
                />
                {f.sentAt !== null && (
                  <Text className={clsx('text-xs mt-1 font-bevn-regular', otpInfo.locked || otpInfo.validForMs <= 0 ? 'text-status-failed' : 'text-text-muted')}>
                    {otpInfo.locked
                      ? PASSWORD_RESET_TEXT.locked
                      : otpInfo.validForMs > 0
                        ? PASSWORD_RESET_TEXT.validFor(formatCountdown(otpInfo.validForMs), otpInfo.attemptsLeft)
                        : PASSWORD_RESET_TEXT.expired}
                  </Text>
                )}
              </View>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.newPasswordLabel}</Text>
                <PasswordInput
                  placeholder={TEXT.newPasswordPlaceholder}
                  autoComplete="new-password"
                  value={f.newPassword}
                  onChangeText={f.setNewPassword}
                  onFocus={() => scrollTo(SCROLL.newPassword)}
                  revealed={f.showPassword}
                  onToggleReveal={f.toggleShowPassword}
                />
              </View>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.confirmLabel}</Text>
                {/* Dùng chung nút ẩn/hiện với ô mật khẩu mới */}
                <PasswordInput
                  placeholder={TEXT.confirmPlaceholder}
                  autoComplete="new-password"
                  value={f.confirmPassword}
                  onChangeText={f.setConfirmPassword}
                  onFocus={() => scrollTo(SCROLL.confirmPassword)}
                  revealed={f.showPassword}
                  showToggle={false}
                />
              </View>

              <TouchableOpacity
                className={clsx('bg-primary rounded-md p-md items-center justify-center', (f.submitting || otpInfo.locked) && 'opacity-60')}
                onPress={() => { void f.submitReset(); }}
                disabled={f.submitting || otpInfo.locked}
                activeOpacity={0.85}
              >
                {f.submitting
                  ? <ActivityIndicator color={Colors.text.inverse} />
                  : <Text className="text-text-inverse text-md font-bold font-bevn-bold">{TEXT.submit}</Text>}
              </TouchableOpacity>

              <View className="flex-row justify-center gap-lg mt-lg">
                <TouchableOpacity onPress={() => { void f.sendOtp(); }} disabled={f.sending || otpInfo.resendWaitMs > 0} activeOpacity={0.7}>
                  <Text className={clsx('text-sm font-semibold font-bevn-semibold', otpInfo.resendWaitMs > 0 ? 'text-text-muted' : 'text-primary')}>
                    {f.sending ? PASSWORD_RESET_TEXT.sending : resendLabel ?? PASSWORD_RESET_TEXT.resend}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={f.changeEmail} activeOpacity={0.7}>
                  <Text className="text-text-muted text-sm font-bevn-medium">{TEXT.changeEmail}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Back to login */}
          <View className="flex-row justify-center items-center mt-xl">
            <Link href={ROUTES.login} asChild>
              <TouchableOpacity onPress={() => Haptic.light()} activeOpacity={0.7}>
                <Text className="text-primary text-sm font-semibold font-bevn-semibold">{TEXT.backToLogin}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAwareView>
  );
}
