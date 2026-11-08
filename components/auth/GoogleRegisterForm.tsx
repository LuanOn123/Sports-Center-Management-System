// components/auth/GoogleRegisterForm.tsx
// Màn "Hoàn tất đăng ký Google" (web: form sau khi chọn tài khoản Google ở Register.tsx): hiện tài khoản Google đã chọn rồi bổ sung
// số điện thoại (bắt buộc), giới tính, ngày sinh, mục tiêu. Họ tên, email do BE lấy từ ID token; BE tự sinh mật khẩu ngẫu nhiên.

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { FormProvider } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../shared/Avatar';
import { Brand } from '../shared/Brand';
import { Icon } from '../shared/Icon';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { MemberProfileFields } from './MemberProfileFields';
import { useFieldScroll } from '../../hooks/shared/useFieldScroll';
import { useGoogleRegisterForm } from '../../hooks/shared/useGoogleRegisterForm';
import { Colors } from '../../constants/theme';
import { GOOGLE_TEXT as TEXT } from '../../constants/auth';

export function GoogleRegisterForm() {
  const insets = useSafeAreaInsets();
  const { form, account, submit, back } = useGoogleRegisterForm();
  const scroll = useFieldScroll();
  const { isSubmitting } = form.formState;

  // Mất tài khoản Google (mở lại app) → hook đã chuyển về màn đăng nhập
  if (!account) return null;

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
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular text-center">{TEXT.completeSubtitle}</Text>
        </View>

        <FormProvider {...form}>
          <View className="bg-bg-surface rounded-xl p-xl border border-border" onLayout={scroll.onContainerLayout}>
            <Text className="text-xl font-bold font-bevn-bold text-text-primary text-center mb-xl">{TEXT.completeTitle}</Text>

            <View className="flex-row items-center gap-md bg-bg-elevated rounded-md p-md border border-border mb-lg">
              <Avatar uri={account.photo} name={account.name ?? account.email} size={42} />
              <View className="flex-1">
                <Text className="text-sm font-bevn-bold text-text-primary" numberOfLines={1}>{account.name || account.email}</Text>
                <Text className="text-xs text-text-secondary font-bevn-regular" numberOfLines={1}>{account.email}</Text>
              </View>
              <Icon name="check-circle" size={18} color={Colors.status.success} />
            </View>

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
                : <Text className="text-text-inverse text-md font-bold font-bevn-bold text-center">{TEXT.completeSubmit}</Text>}
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button" className="flex-row items-center justify-center gap-xs mt-lg py-sm" onPress={back} disabled={isSubmitting}>
              <Icon name="arrow-back" size={14} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.completeBack}</Text>
            </TouchableOpacity>
          </View>
        </FormProvider>
      </ScrollView>
    </KeyboardAwareView>
  );
}
