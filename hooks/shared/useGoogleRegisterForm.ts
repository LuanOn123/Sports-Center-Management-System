// hooks/shared/useGoogleRegisterForm.ts
// Màn "Hoàn tất đăng ký Google" (web: form sau khi chọn tài khoản Google ở Register.tsx): bổ sung số điện thoại (bắt buộc),
// giới tính, ngày sinh, mục tiêu rồi POST /auth/google-register. BE trả luôn token nên đăng ký xong vào app ngay.
// Tài khoản Google lấy từ lib/googleRegistration (chỉ trong bộ nhớ); mất (mở lại app) thì quay về đăng nhập.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { signOutOfGoogle } from '../../lib/googleSignIn';
import { clearGoogleAccount, peekGoogleAccount } from '../../lib/googleRegistration';
import {
  DEFAULT_MEMBER_PROFILE_VALUES, googleRegisterSchema, toGoogleRegisterPayload, type MemberProfileValues,
} from '../../lib/memberRegistration';
import { GOOGLE_TEXT as TEXT } from '../../constants/auth';
import { ROUTES } from '../../navigation/routes';

export function useGoogleRegisterForm() {
  const router = useRouter();
  const { registerWithGoogle } = useAuth();
  const [account] = useState(peekGoogleAccount);
  const form = useForm<MemberProfileValues>({ resolver: zodResolver(googleRegisterSchema), defaultValues: DEFAULT_MEMBER_PROFILE_VALUES });

  useEffect(() => {
    if (!account) router.replace(ROUTES.login);
  }, [account, router]);

  const submit = form.handleSubmit(async (values) => {
    if (!account) return;
    Haptic.medium();
    try {
      await registerWithGoogle(toGoogleRegisterPayload(account.idToken, values));
      clearGoogleAccount();
      Haptic.success();
    } catch (e) {
      Haptic.error();
      showAlert(TEXT.completeFailedTitle, e instanceof ApiError ? e.message : TEXT.completeFailedFallback);
    }
  });

  /** Bỏ tài khoản Google đã chọn để chọn lại hoặc đăng ký bằng email */
  const back = () => {
    clearGoogleAccount();
    void signOutOfGoogle();
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.register);
  };

  return { form, account, submit, back };
}
