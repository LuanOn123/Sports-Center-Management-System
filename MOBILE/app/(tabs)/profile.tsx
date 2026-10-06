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
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../../components/shared/Icon';
import { Avatar } from '../../components/shared/Avatar';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/theme';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';
import { Haptic } from '../../lib/haptics';

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
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

const FIELD_SCROLL_OFFSETS: Record<string, number> = {
  fullName: 60,
  phone: 140,
  fitnessGoal: 220,
  trainingPreference: 320,
  currentPassword: 80,
  newPassword: 160,
  confirmPassword: 240,
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

    // Native (iOS/Android): Scroll smoothly to exact position so active input is centered in view
    const targetOffset = FIELD_SCROLL_OFFSETS[fieldKey] ?? 160;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: targetOffset, animated: true });
    }, 120);
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
    mutationFn: (data: ProfileForm) => {
      Haptic.medium();
      return api.patch('/auth/me', data);
    },
    onSuccess: async () => {
      Haptic.success();
      await refreshUser();
      showAlert('Thành công', 'Hồ sơ đã được cập nhật!');
    },
    onError: (e) => {
      Haptic.error();
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      Haptic.medium();
      const formData = new FormData();
      // Ưu tiên suy đuôi file từ mimeType (đáng tin trên mọi nền tảng) thay vì parse
      // asset.uri — trên web/Android, uri có thể là "blob:..."/"content://..." không
      // có phần đuôi, parse kiểu split('.').pop() sẽ ra rác.
      const mimeExt = asset.mimeType?.split('/')[1]?.toLowerCase();
      const ext = (mimeExt === 'jpeg' ? 'jpg' : mimeExt) || asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const fileName = asset.fileName || `avatar.${ext}`;

      if (Platform.OS === 'web') {
        // Web KHÔNG hỗ trợ FormData.append(field, {uri,name,type}) kiểu RN native —
        // phải là Blob thật, nếu không multer nhận field "avatar" như text
        // "[object Object]" thay vì file ⇒ BE báo "Avatar file is required".
        const blob = await fetch(asset.uri).then((r) => r.blob());
        formData.append('avatar', blob, fileName);
      } else {
        formData.append('avatar', { uri: asset.uri, name: fileName, type: mimeType } as unknown as Blob);
      }
      return api.uploadAvatar(formData);
    },
    onSuccess: async () => {
      Haptic.success();
      await refreshUser();
    },
    onError: (e) => {
      Haptic.error();
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật ảnh đại diện thất bại');
    },
  });

  const handlePickAvatar = async () => {
    Haptic.light();
    const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (req.status !== ImagePicker.PermissionStatus.GRANTED) {
        showAlert(
          'Thiếu quyền truy cập',
          canAskAgain === false
            ? 'Vui lòng cấp quyền thư viện ảnh cho Pulse trong Cài đặt thiết bị.'
            : 'Cần quyền truy cập thư viện ảnh để đổi ảnh đại diện.'
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      showAlert('Ảnh quá lớn', 'Ảnh đại diện tối đa 5MB. Vui lòng chọn ảnh khác.');
      return;
    }
    uploadAvatar.mutate(asset);
  };

  const changePwd = useMutation({
    mutationFn: (data: PwdForm) => {
      Haptic.medium();
      return api.patch('/auth/me/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      Haptic.success();
      resetPwd();
      // BE thu hồi toàn bộ refresh token của các thiết bị khi đổi mật khẩu — chủ động
      // đăng xuất ngay thay vì chờ tới request kế tiếp mới phát hiện qua 401.
      showAlert('Thành công', 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.', () => {
        logout();
      });
    },
    onError: (e) => {
      Haptic.error();
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Đổi mật khẩu thất bại');
    },
  });

  const updateLevel = useMutation({
    mutationFn: (level: string) => {
      Haptic.selection();
      return api.patch('/auth/me', { trainingLevel: level });
    },
    onSuccess: async () => {
      Haptic.success();
      await refreshUser();
      setEditingLevel(false);
    },
    onError: (e) => {
      Haptic.error();
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const handleLogout = () => {
    Haptic.warning();
    showConfirm('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', logout, undefined, 'Đăng xuất', true);
  };

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScreenHeader
        title="Hồ sơ cá nhân"
        subtitle="Thông tin tài khoản & cài đặt bảo mật"
      />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: isInputFocused ? 200 : 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Header */}
        <View className="items-center mb-xl">
          <TouchableOpacity className="mb-md" onPress={handlePickAvatar} disabled={uploadAvatar.isPending} activeOpacity={0.8}>
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size={80} />
            <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-bg-elevated border-2 border-bg-primary justify-center items-center">
              {uploadAvatar.isPending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon name="photo-camera" size={14} color={Colors.text.primary} />
              )}
            </View>
          </TouchableOpacity>
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

