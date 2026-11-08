// hooks/shared/useRegisterForm.ts
// Form đăng ký hội viên bằng email (web: features/auth/Register.tsx): họ tên, email, mật khẩu, số điện thoại (bắt buộc),
// giới tính, ngày sinh, mục tiêu. Đăng ký xong quay về màn đăng nhập (BE không trả token ở /auth/register).

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import {
  DEFAULT_MEMBER_PROFILE_VALUES, registerSchema, toRegisterPayload, type RegisterFormValues,
} from '../../lib/memberRegistration';
import { REGISTER_TEXT as TEXT } from '../../constants/auth';
import { ROUTES } from '../../navigation/routes';

export function useRegisterForm() {
  const router = useRouter();
  const { register: authRegister } = useAuth();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', ...DEFAULT_MEMBER_PROFILE_VALUES },
  });

  const submit = form.handleSubmit(async (values) => {
    Haptic.medium();
    try {
      await authRegister(toRegisterPayload(values));
      Haptic.success();
      showAlert(TEXT.successTitle, TEXT.successMessage, () => router.replace(ROUTES.login));
    } catch (e) {
      Haptic.error();
      showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.errorFallback);
    }
  });

  return { form, submit };
}
