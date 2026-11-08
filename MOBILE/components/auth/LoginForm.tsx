// components/auth/LoginForm.tsx
// Màn đăng nhập: email + mật khẩu + Cloudflare Turnstile, rồi nút Google đặt dưới nút Đăng nhập như web.
// Logic ở hooks/shared/useLoginForm; đăng nhập Google ở hooks/shared/useGoogleAuth.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { Controller } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '../shared/Brand';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { PasswordInput } from '../shared/PasswordInput';
import { GoogleSignInSection } from './GoogleSignInSection';
import { LoginCaptcha } from './LoginCaptcha';
import { useLoginForm } from '../../hooks/shared/useLoginForm';
import { Colors } from '../../constants/theme';
import { LOGIN_TEXT as TEXT } from '../../constants/auth';
import { ROUTES } from '../../navigation/routes';

export function LoginForm() {
  const insets = useSafeAreaInsets();
  const { form, submit, captchaToken, setCaptchaToken, captchaAttempt } = useLoginForm();
  const { control, formState: { errors, isSubmitting } } = form;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24) + 10,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View className="items-center mb-xl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">{TEXT.tagline}</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-surface rounded-xl p-xl border border-border">
          <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-xl text-center">{TEXT.title}</Text>

          {/* Email */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.email}</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className={clsx(
                    'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular',
                    errors.email ? 'border-status-failed' : 'border-border'
                  )}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.email && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.email.message}</Text>}
          </View>

          {/* Password */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">{TEXT.password}</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <PasswordInput
                  value={value ?? ''}
                  onChangeText={onChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  hasError={Boolean(errors.password)}
                />
              )}
            />
            {errors.password && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.password.message}</Text>}
            <Link href={ROUTES.forgotPassword} asChild>
              <TouchableOpacity className="self-end mt-sm">
                <Text className="text-primary text-sm font-bevn-medium">{TEXT.forgotPassword}</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <LoginCaptcha key={captchaAttempt} onChange={setCaptchaToken} />
          {/* Submit */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={TEXT.submit}
            accessibilityState={{ disabled: isSubmitting || !captchaToken, busy: isSubmitting }}
            className={clsx('bg-primary rounded-md p-md items-center justify-center mt-sm', (isSubmitting || !captchaToken) && 'opacity-60')}
            onPress={() => { void submit(); }}
            disabled={isSubmitting || !captchaToken}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color={Colors.text.inverse} />
              : <Text className="text-text-inverse text-md font-bold font-bevn-bold text-center">{TEXT.submit}</Text>}
          </TouchableOpacity>

          <GoogleSignInSection mode="login" />

          {/* Register link */}
          <View className="flex-row justify-center items-center mt-xl">
            <Text className="text-text-secondary text-sm font-bevn-regular">{TEXT.noAccount}</Text>
            <Link href={ROUTES.register} asChild>
              <TouchableOpacity>
                <Text className="text-primary text-sm font-semibold font-bevn-semibold">{TEXT.registerNow}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAwareView>
  );
}
