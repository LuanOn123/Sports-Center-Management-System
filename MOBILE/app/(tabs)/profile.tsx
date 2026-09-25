import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/theme';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Ít nhất 2 ký tự'),
  phone: z.string().optional(),
  fitnessGoal: z.string().optional(),
  trainingPreference: z.string().optional(),
});
const pwdSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().min(6, 'Mật khẩu mới ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });
type ProfileForm = z.infer<typeof profileSchema>;
type PwdForm = z.infer<typeof pwdSchema>;

const LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Cơ bản' },
  { value: 'INTERMEDIATE', label: 'Trung cấp' },
  { value: 'ADVANCED', label: 'Nâng cao' },
];

const ROLE_LABEL: Record<string, string> = {
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  STAFF: 'Lễ tân',
  MANAGER: 'Quản lý',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const isCoach = user?.role === 'COACH';
  const [tab, setTab] = useState<'info' | 'security'>('info');
  const [editingLevel, setEditingLevel] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const queryClient = useQueryClient();

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, React.RefObject<any>>>({});

  const getInputRef = (key: string): React.RefObject<any> => {
    if (!inputRefs.current[key]) {
      inputRefs.current[key] = React.createRef();
    }
    return inputRefs.current[key];
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFocusOut = () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
            setIsInputFocused(false);
          }
        }, 100);
      };
      window.addEventListener('focusout', handleFocusOut);
      return () => window.removeEventListener('focusout', handleFocusOut);
    }

    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(hideEvent, () => setIsInputFocused(false));
    return () => sub.remove();
  }, []);

  const handleFocus = (fieldKey: string, e?: any) => {
    setIsInputFocused(true);
    // Web: use target DOM element or ref node to scroll into view smoothly
    if (Platform.OS === 'web') {
      const target = (e?.target as HTMLElement) || (inputRefs.current[fieldKey]?.current as any)?.node || inputRefs.current[fieldKey]?.current;
      if (target && typeof target.scrollIntoView === 'function') {
        setTimeout(() => {
          try {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {}
        }, 120);
        return;
      }
    }

    // Native (iOS/Android): measure and scroll ScrollView
    const inputRef = inputRefs.current[fieldKey];
    if (inputRef?.current && scrollViewRef.current) {
      setTimeout(() => {
        try {
          const scrollNode = scrollViewRef.current?.getScrollableNode?.();
          if (scrollNode && typeof inputRef.current.measureLayout === 'function') {
            inputRef.current.measureLayout(
              scrollNode,
              (_left: number, top: number) => {
                scrollViewRef.current?.scrollTo({ y: Math.max(0, top - 100), animated: true });
              },
              () => {}
            );
          }
        } catch {}
      }, 100);
    }
  };

  const { control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      fitnessGoal: user?.memberProfile?.fitnessGoal ?? '',
      trainingPreference: user?.memberProfile?.trainingPreference ?? '',
    },
  });

  // Sync form values when user data loads
  React.useEffect(() => {
    if (user) {
      reset({
        fullName: user.fullName ?? '',
        phone: user.phone ?? '',
        fitnessGoal: user.memberProfile?.fitnessGoal ?? '',
        trainingPreference: user.memberProfile?.trainingPreference ?? '',
      });
    }
  }, [user, reset]);

  const {
    control: pwdControl,
    handleSubmit: handlePwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
    reset: resetPwd,
  } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/me', data),
    onSuccess: async () => {
      await refreshUser();
      showAlert('Thành công', 'Hồ sơ đã được cập nhật!');
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const changePwd = useMutation({
    mutationFn: (data: PwdForm) =>
      api.patch('/auth/me/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      resetPwd();
      showAlert('Thành công', 'Mật khẩu đã được thay đổi!');
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Đổi mật khẩu thất bại');
    },
  });

  const updateLevel = useMutation({
    mutationFn: (level: string) => api.patch('/auth/me', { trainingLevel: level }),
    onSuccess: async () => {
      await refreshUser();
      setEditingLevel(false);
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const handleLogout = () => {
    showConfirm('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', logout, undefined, 'Đăng xuất', true);
  };

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      {/* Header */}
      <View
        className={clsx(
          'flex-row justify-between items-center px-md pb-sm bg-bg-surface border-b border-border',
          Platform.OS === 'ios' ? 'pt-[52px]' : Platform.OS === 'android' ? 'pt-[42px]' : 'pt-[14px]'
        )}
      >
        <TouchableOpacity
          className="w-10 h-10 justify-center items-center rounded-full"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Icon name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View className="flex-1 items-center px-xs">
          <Text className="text-lg font-bold font-bevn-bold text-text-primary text-center">Hồ sơ cá nhân</Text>
          <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular text-center" numberOfLines={1}>
            Thông tin tài khoản & cài đặt bảo mật
          </Text>
        </View>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: isInputFocused ? 280 : 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Header */}
        <View className="items-center mb-xl">
          <View className="w-20 h-20 rounded-full bg-primary justify-center items-center mb-md">
            <Text className="text-xxxl font-bold font-bevn-bold text-text-inverse">{user?.fullName?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <Text className="text-xl font-bold font-bevn-bold text-text-primary">{user?.fullName}</Text>
          <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">{user?.email}</Text>
          <View className={clsx('flex-row items-center gap-1 mt-sm bg-[#A3E63520] rounded-full px-lg py-1', isCoach && 'bg-[#A3E63525] border border-[#A3E63540]')}>
            <Icon name={isCoach ? 'sports' : 'person'} size={14} color={Colors.primary} />
            <Text className="text-primary text-sm font-semibold font-bevn-semibold">{ROLE_LABEL[user?.role ?? 'MEMBER']}</Text>
          </View>
        </View>

        {/* Thẻ thông tin riêng cho Huấn luyện viên */}
        {isCoach && (
          <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border shadow-sm">
            <Text className="text-md font-bold font-bevn-bold text-text-primary mb-md">Thông tin Huấn luyện viên</Text>
            <View className="gap-sm">
              <View className="flex-row items-center gap-1.5">
                <Icon name="fitness-center" size={16} color={Colors.primary} />
                <Text className="text-sm text-text-secondary font-bevn-medium">Chuyên môn:</Text>
                <Text className="text-sm font-semibold font-bevn-semibold text-text-primary flex-1">
                  {user?.coachProfile?.specialization || 'Đang cập nhật'}
                </Text>
              </View>

              <View className="flex-row items-center gap-1.5">
                <Icon name="workspace-premium" size={16} color="#F59E0B" />
                <Text className="text-sm text-text-secondary font-bevn-medium">Kinh nghiệm:</Text>
                <Text className="text-sm font-semibold font-bevn-semibold text-text-primary flex-1">
                  {user?.coachProfile?.experienceYears ? `${user.coachProfile.experienceYears} năm` : 'Đang cập nhật'}
                </Text>
              </View>

              {Boolean(user?.coachProfile?.bio) && (
                <View className="flex-row items-start gap-1.5">
                  <Icon name="description" size={16} color={Colors.text.secondary} style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text className="text-sm text-text-secondary font-bevn-medium">Giới thiệu:</Text>
                    <Text className="text-sm text-text-primary font-bevn-regular mt-0.5 leading-5">{user!.coachProfile!.bio}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View className="flex-row gap-md mb-lg">
          <TouchableOpacity
            className={clsx('flex-1 py-sm rounded-md items-center border', tab === 'info' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
            onPress={() => setTab('info')}
          >
            <Text className={clsx('text-sm font-bevn-medium', tab === 'info' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>Thông tin cá nhân</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={clsx('flex-1 py-sm rounded-md items-center border', tab === 'security' ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
            onPress={() => setTab('security')}
          >
            <Text className={clsx('text-sm font-bevn-medium', tab === 'security' ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>Bảo mật</Text>
          </TouchableOpacity>
        </View>

        {tab === 'info' && (
          <View className="bg-bg-surface rounded-xl p-xl border border-border mb-lg">
            {/* Full name */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Họ và tên</Text>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    ref={getInputRef('fullName')}
                    className={clsx(
                      'bg-bg-elevated rounded-md p-md text-text-primary text-md border font-bevn-regular',
                      errors.fullName ? 'border-status-failed' : 'border-border'
                    )}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={(e) => handleFocus('fullName', e)}
                    placeholder="Nhập họ và tên..."
                    placeholderTextColor={Colors.text.muted}
                    editable={true}
                  />
                )}
              />
              {errors.fullName && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{errors.fullName.message}</Text>}
            </View>

            {/* Phone */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Số điện thoại</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    ref={getInputRef('phone')}
                    className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={(e) => handleFocus('phone', e)}
                    keyboardType="phone-pad"
                    placeholder="Nhập số điện thoại..."
                    placeholderTextColor={Colors.text.muted}
                    editable={true}
                  />
                )}
              />
            </View>

            {/* Member-specific fields: only show for non-coaches */}
            {!isCoach && (
              <>
                {/* Fitness Goal */}
                <View className="mb-lg">
                  <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mục tiêu tập luyện</Text>
                  <Controller
                    control={control}
                    name="fitnessGoal"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        ref={getInputRef('fitnessGoal')}
                        className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular min-h-[80px]"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onFocus={(e) => handleFocus('fitnessGoal', e)}
                        multiline
                        placeholder="Mô tả mục tiêu của bạn..."
                        placeholderTextColor={Colors.text.muted}
                        textAlignVertical="top"
                        editable={true}
                      />
                    )}
                  />
                </View>

                {/* Training Preference */}
                <View className="mb-lg">
                  <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Thời gian tập yêu thích</Text>
                  <Controller
                    control={control}
                    name="trainingPreference"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        ref={getInputRef('trainingPreference')}
                        className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onFocus={(e) => handleFocus('trainingPreference', e)}
                        placeholder="VD: Sáng sớm, chiều tối..."
                        placeholderTextColor={Colors.text.muted}
                        editable={true}
                      />
                    )}
                  />
                </View>

                {/* Training Level */}
                <View className="mb-lg">
                  <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Trình độ</Text>
                  {!editingLevel ? (
                    <TouchableOpacity className="flex-row justify-between items-center bg-bg-elevated rounded-md p-md border border-border" onPress={() => setEditingLevel(true)}>
                      <Text className="text-md text-text-primary font-bevn-medium">{LEVEL_LABEL[user?.memberProfile?.trainingLevel ?? ''] ?? '—'}</Text>
                      <Text className="text-sm text-primary font-bevn-medium">Thay đổi</Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-row gap-sm">
                      {LEVEL_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          className={clsx(
                            'flex-1 py-sm rounded-md items-center border',
                            user?.memberProfile?.trainingLevel === opt.value ? 'bg-primary border-primary' : 'bg-bg-elevated border-border'
                          )}
                          onPress={() => updateLevel.mutate(opt.value)}
                          disabled={updateLevel.isPending}
                        >
                          <Text className={clsx('text-sm font-bevn-medium', user?.memberProfile?.trainingLevel === opt.value ? 'text-text-inverse font-bold' : 'text-text-secondary')}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity
              className={clsx('bg-primary rounded-md p-md items-center mt-sm', isSubmitting && 'opacity-60')}
              onPress={handleSubmit((data) => updateProfile.mutate(data))}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color={Colors.text.inverse} /> : <Text className="text-text-inverse font-bold font-bevn-bold text-md">Lưu thay đổi</Text>}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'security' && (
          <View className="bg-bg-surface rounded-xl p-xl border border-border mb-lg">
            {/* Current Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu hiện tại</Text>
              <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border pr-sm', pwdErrors.currentPassword ? 'border-status-failed' : 'border-border')}>
                <Controller
                  control={pwdControl}
                  name="currentPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      ref={getInputRef('currentPassword')}
                      className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      onFocus={(e) => handleFocus('currentPassword', e)}
                      secureTextEntry={!showCurrentPwd}
                      placeholderTextColor={Colors.text.muted}
                      placeholder="••••••••"
                      editable={true}
                    />
                  )}
                />
                <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowCurrentPwd((p) => !p)} activeOpacity={0.7}>
                  <Icon name={showCurrentPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              {pwdErrors.currentPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{pwdErrors.currentPassword.message}</Text>}
            </View>

            {/* New Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu mới</Text>
              <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border pr-sm', pwdErrors.newPassword ? 'border-status-failed' : 'border-border')}>
                <Controller
                  control={pwdControl}
                  name="newPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      ref={getInputRef('newPassword')}
                      className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      onFocus={(e) => handleFocus('newPassword', e)}
                      secureTextEntry={!showNewPwd}
                      placeholderTextColor={Colors.text.muted}
                      placeholder="Ít nhất 6 ký tự"
                      editable={true}
                    />
                  )}
                />
                <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowNewPwd((p) => !p)} activeOpacity={0.7}>
                  <Icon name={showNewPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              {pwdErrors.newPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{pwdErrors.newPassword.message}</Text>}
            </View>

            {/* Confirm New Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Xác nhận mật khẩu mới</Text>
              <View className={clsx('flex-row items-center bg-bg-elevated rounded-md border pr-sm', pwdErrors.confirmPassword ? 'border-status-failed' : 'border-border')}>
                <Controller
                  control={pwdControl}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      ref={getInputRef('confirmPassword')}
                      className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      onFocus={(e) => handleFocus('confirmPassword', e)}
                      secureTextEntry={!showConfirmPwd}
                      placeholderTextColor={Colors.text.muted}
                      placeholder="Nhập lại mật khẩu mới..."
                      editable={true}
                    />
                  )}
                />
                <TouchableOpacity className="p-sm justify-center items-center" onPress={() => setShowConfirmPwd((p) => !p)} activeOpacity={0.7}>
                  <Icon name={showConfirmPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              {pwdErrors.confirmPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{pwdErrors.confirmPassword.message}</Text>}
            </View>
            <TouchableOpacity
              className={clsx('bg-primary rounded-md p-md items-center mt-sm', pwdSubmitting && 'opacity-60')}
              onPress={handlePwd((data) => changePwd.mutate(data))}
              disabled={pwdSubmitting}
            >
              {pwdSubmitting ? <ActivityIndicator color={Colors.text.inverse} /> : <Text className="text-text-inverse font-bold font-bevn-bold text-md">Đổi mật khẩu</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity className="bg-[#EF444415] rounded-lg p-lg items-center border border-[#EF444430]" onPress={handleLogout}>
          <Text className="text-status-failed font-bold font-bevn-bold text-md">Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAwareView>
  );
}

