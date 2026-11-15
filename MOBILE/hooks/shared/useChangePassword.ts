// hooks/shared/useChangePassword.ts
// Tab "Bảo mật" của hồ sơ: đổi mật khẩu. BE thu hồi mọi phiên của tài khoản nên thành công thì đăng xuất ngay (không chờ 401 ở request kế tiếp)

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { changePassword } from '../../services/profileService';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { EMPTY_PASSWORD_CHANGE, passwordChangeSchema, type PasswordChangeValues } from '../../lib/passwordChange';
import { PASSWORD_CHANGE_TEXT as TEXT } from '../../constants/profile';

export function useChangePassword() {
  const { logout } = useAuth();
  const form = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema), defaultValues: EMPTY_PASSWORD_CHANGE });

  const mutation = useMutation({
    mutationFn: (data: PasswordChangeValues) => {
      Haptic.medium();
      return changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
    },
    onSuccess: () => {
      Haptic.success();
      form.reset();
      showAlert(TEXT.successTitle, TEXT.success, () => { void logout(); });
    },
    onError: (e) => {
      Haptic.error();
      showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.failed);
    },
  });

  return {
    form,
    submit: form.handleSubmit((data) => mutation.mutate(data)),
    isSubmitting: form.formState.isSubmitting || mutation.isPending,
  };
}
