import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Platform, ScrollView, ActivityIndicator,
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
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';
import { ROUTES } from '../../navigation/routes';

const schema = z
  .object({
    fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu'),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keyboard } from 'react-native';
import { Haptic } from '../../lib/haptics';

export default function RegisterScreen() {
  const { register: authRegister } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setIsKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvent, () => setIsKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    Haptic.medium();
    try {
      await authRegister({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone || undefined,
      });
      Haptic.success();
    } catch (e) {
      Haptic.error();
      const msg = e instanceof ApiError ? e.message : 'Đăng ký thất bại. Vui lòng thử lại.';
      showAlert('Lỗi đăng ký', msg);
    }
  };

  const handleInputFocus = (offset = 60) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 100);
  };

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24) + 10,
          paddingBottom: Math.max(insets.bottom, 24) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center mb-xl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">Bắt đầu hành trình của bạn</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-surface rounded-xl p-xl border border-border">
          <Text className="text-xl font-bold font-bevn-bold text-text-primary">Tạo tài khoản</Text>
          <Text className="text-sm text-text-secondary mt-1 mb-xl font-bevn-regular">Điền thông tin để đăng ký thành viên</Text>

          {/* Full Name */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Họ và tên</Text>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className={clsx(
                    'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular',
                    errors.fullName ? 'border-status-failed' : 'border-border'
                  )}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="words"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.fullName && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.fullName.message}</Text>}
          </View>

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
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.email && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.email.message}</Text>}
          </View>

          {/* Phone (optional) */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Số điện thoại</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                  placeholder="0901234567"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="phone-pad"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
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
                    placeholder="Ít nhất 6 ký tự"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showPwd}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onFocus={() => handleInputFocus(180)}
                  />
                )}
              />
              <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowPwd(p => !p)} activeOpacity={0.7}>
                <Icon name={showPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.password.message}</Text>}
          </View>

          {/* Confirm Password */}
          <View className="mb-lg">
            <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Xác nhận mật khẩu</Text>
            <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border pr-sm', errors.confirmPassword ? 'border-status-failed' : 'border-border')}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                    placeholder="Nhập lại mật khẩu"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showConfirmPwd}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onFocus={() => handleInputFocus(260)}
                  />
                )}
              />
              <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowConfirmPwd(p => !p)} activeOpacity={0.7}>
                <Icon name={showConfirmPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.confirmPassword.message}</Text>}
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
              : <Text className="text-text-inverse text-md font-bold font-bevn-bold text-center">Đăng ký</Text>}
          </TouchableOpacity>

          {/* Login link */}
          <View className="flex-row justify-center items-center mt-xl">
            <Text className="text-text-secondary text-sm font-bevn-regular">Đã có tài khoản? </Text>
            <Link href={ROUTES.login} asChild>
              <TouchableOpacity>
                <Text className="text-primary text-sm font-semibold font-bevn-semibold">Đăng nhập</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAwareView>
  );
}
