// components/auth/RegisterForm.tsx
// Màn đăng ký hội viên bằng email (web: features/auth/Register.tsx). Logic + luật nhập liệu ở hooks/shared/useRegisterForm
// và lib/memberRegistration; trường hồ sơ (số điện thoại bắt buộc, giới tính, ngày sinh, mục tiêu) dùng chung với đăng ký Google.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { Controller, FormProvider } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '../shared/Brand';
import { FormField } from '../shared/FormField';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { PasswordInput } from '../shared/PasswordInput';
import { GoogleSignInSection } from './GoogleSignInSection';
import { MemberProfileFields } from './MemberProfileFields';
import { useFieldScroll } from '../../hooks/shared/useFieldScroll';
import { useRegisterForm } from '../../hooks/shared/useRegisterForm';
import { Colors } from '../../constants/theme';
import { REGISTER_TEXT as TEXT } from '../../constants/auth';
import { ROUTES } from '../../navigation/routes';

const INPUT_CLASS = 'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular';

export function RegisterForm() {
  const insets = useSafeAreaInsets();
  const { form, submit } = useRegisterForm();
  const scroll = useFieldScroll();
  const { control, formState: { errors, isSubmitting } } = form;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScrollView
        ref={scroll.scrollRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24) + 10,
          paddingBottom: Math.max(insets.bottom, 24) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-xl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">{TEXT.subtitle}</Text>
        </View>

        <FormProvider {...form}>
          <View className="bg-bg-surface rounded-xl p-xl border border-border" onLayout={scroll.onContainerLayout}>
            <Text className="text-xl font-bold font-bevn-bold text-text-primary text-center mb-xl">{TEXT.title}</Text>

            <FormField label={TEXT.fullName} error={errors.fullName?.message} onLayout={scroll.onFieldLayout('fullName')}>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={clsx(INPUT_CLASS, errors.fullName ? 'border-status-failed' : 'border-border')}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor={Colors.text.muted}
                    autoCapitalize="words"
                    autoComplete="name"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={() => scroll.scrollToField('fullName')}
                  />
                )}
              />
            </FormField>

            <FormField label={TEXT.email} error={errors.email?.message} onLayout={scroll.onFieldLayout('email')}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={clsx(INPUT_CLASS, errors.email ? 'border-status-failed' : 'border-border')}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.text.muted}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={() => scroll.scrollToField('email')}
                  />
                )}
              />
            </FormField>

            <FormField label={TEXT.password} error={errors.password?.message} onLayout={scroll.onFieldLayout('password')}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    onFocus={() => scroll.scrollToField('password')}
                    placeholder={TEXT.passwordPlaceholder}
                    hasError={Boolean(errors.password)}
                  />
                )}
              />
            </FormField>

            <FormField label={TEXT.confirmPassword} error={errors.confirmPassword?.message} onLayout={scroll.onFieldLayout('confirmPassword')}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    onFocus={() => scroll.scrollToField('confirmPassword')}
                    placeholder={TEXT.confirmPlaceholder}
                    hasError={Boolean(errors.confirmPassword)}
                  />
                )}
              />
            </FormField>

            <MemberProfileFields scroll={scroll} />

            <TouchableOpacity
              accessibilityRole="button"
              className={clsx('bg-primary rounded-md p-md items-center justify-center mt-sm', isSubmitting && 'opacity-60')}
              onPress={() => { void submit(); }}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting
                ? <ActivityIndicator color={Colors.text.inverse} />
                : <Text className="text-text-inverse text-md font-bold font-bevn-bold text-center">{TEXT.submit}</Text>}
            </TouchableOpacity>

            <GoogleSignInSection mode="register" />

            <View className="flex-row justify-center items-center mt-xl">
              <Text className="text-text-secondary text-sm font-bevn-regular">{TEXT.haveAccount}</Text>
              <Link href={ROUTES.login} asChild>
                <TouchableOpacity>
                  <Text className="text-primary text-sm font-semibold font-bevn-semibold">{TEXT.login}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </FormProvider>
      </ScrollView>
    </KeyboardAwareView>
  );
}
