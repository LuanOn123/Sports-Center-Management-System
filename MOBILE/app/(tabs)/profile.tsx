import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../../components/shared/Icon';
import { PasswordInput } from '../../components/shared/PasswordInput';
import { Avatar } from '../../components/shared/Avatar';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/theme';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';
import { Haptic } from '../../lib/haptics';
import { CoachSpecializations } from '../../components/coach/CoachSpecializations';
import { ProfileInfoForm } from '../../components/profile/ProfileInfoForm';
import { ROLE_LABEL } from '../../constants/profile';

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
type PwdForm = z.infer<typeof pwdSchema>;

const FIELD_SCROLL_OFFSETS: Record<string, number> = {
  fullName: 120,
  phone: 360,
  fitnessGoalNote: 560,
  trainingNote: 820,
  currentPassword: 80,
  newPassword: 160,
  confirmPassword: 240,
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const isCoach = user?.role === 'COACH';
  const [tab, setTab] = useState<'info' | 'security'>('info');
  const [isInputFocused, setIsInputFocused] = useState(false);

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
          <View className={clsx('flex-row items-center gap-1 mt-sm bg-[#D4FF0020] rounded-full px-lg py-1', isCoach && 'bg-[#D4FF0025] border border-[#D4FF0040]')}>
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
                <Icon name="workspace-premium" size={16} color="#F5CB65" />
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

        {isCoach && user?.coachProfile?.id && <View className="mb-lg"><CoachSpecializations coachId={user.coachProfile.id} /></View>}
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

        {tab === 'info' && <ProfileInfoForm onFieldFocus={handleFocus} getInputRef={getInputRef} />}

        {tab === 'security' && (
          <View className="bg-bg-surface rounded-xl p-xl border border-border mb-lg">
            {/* Current Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu hiện tại</Text>
              <Controller
                control={pwdControl}
                name="currentPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    ref={getInputRef('currentPassword')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={(e) => handleFocus('currentPassword', e)}
                    placeholder="••••••••"
                    hasError={Boolean(pwdErrors.currentPassword)}
                  />
                )}
              />
              {pwdErrors.currentPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{pwdErrors.currentPassword.message}</Text>}
            </View>

            {/* New Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu mới</Text>
              <Controller
                control={pwdControl}
                name="newPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    ref={getInputRef('newPassword')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={(e) => handleFocus('newPassword', e)}
                    placeholder="Ít nhất 6 ký tự"
                    hasError={Boolean(pwdErrors.newPassword)}
                  />
                )}
              />
              {pwdErrors.newPassword && <Text className="text-xs text-status-failed mt-1 font-bevn-regular">{pwdErrors.newPassword.message}</Text>}
            </View>

            {/* Confirm New Password */}
            <View className="mb-lg">
              <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Xác nhận mật khẩu mới</Text>
              <Controller
                control={pwdControl}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    ref={getInputRef('confirmPassword')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={(e) => handleFocus('confirmPassword', e)}
                    placeholder="Nhập lại mật khẩu mới..."
                    hasError={Boolean(pwdErrors.confirmPassword)}
                  />
                )}
              />
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
        <TouchableOpacity className="bg-[#FF8D9A15] rounded-lg p-lg items-center border border-[#FF8D9A30]" onPress={handleLogout}>
          <Text className="text-status-failed font-bold font-bevn-bold text-md">Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAwareView>
  );
}

