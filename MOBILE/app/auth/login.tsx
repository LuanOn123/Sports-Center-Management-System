import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import clsx from 'clsx';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';
import { ApiError } from '../../lib/api';
import { Brand } from '../../components';
import { showAlert } from '../../lib/alert';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      showAlert('Lỗi đăng nhập', msg);
    }
  };


  return (
    <KeyboardAvoidingView className="flex-1 bg-bg-primary" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View className="items-center mb-xxxl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">Trung tâm thể thao của bạn</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-surface rounded-xl p-xl border border-border">
          <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-xl text-center">Đăng nhập</Text>

          {/* Email */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Email</Text>
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
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu</Text>
            <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border pr-sm', errors.password ? 'border-status-failed' : 'border-border')}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                    placeholder="••••••••"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showPwd}
                    autoComplete="current-password"
                    value={value ?? ''}
                    onChangeText={onChange}
                  />
                )}
              />
              <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowPwd(p => !p)} activeOpacity={0.7}>
                <Icon name={showPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.password.message}</Text>}
          </View>

          {/* Submit */}
          <TouchableOpacity
            className={clsx('bg-primary rounded-md p-md items-center justify-center mt-sm', isSubmitting && 'opacity-60')}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color={Colors.text.inverse} />
              : <Text className="text-text-inverse text-md font-bold font-bevn-bold text-center">Đăng nhập</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <View className="flex-row justify-center items-center mt-xl">
            <Text className="text-text-secondary text-sm font-bevn-regular">Chưa có tài khoản? </Text>
            <Link href="/auth/register" asChild>
              <TouchableOpacity>
                <Text className="text-primary text-sm font-semibold font-bevn-semibold">Đăng ký ngay</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
