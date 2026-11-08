// hooks/shared/useGoogleAuth.ts
// Nút "Đăng nhập / Đăng ký bằng Google" (web: GoogleLogin ở Login.tsx và Register.tsx).
//  - login: lấy ID token → POST /auth/google-login. Email chưa có tài khoản (404 ACCOUNT_NOT_REGISTERED) → mời hoàn tất đăng ký
//    ngay bằng chính ID token đó, không bắt chọn lại Google.
//  - register: lấy ID token → màn "Hoàn tất đăng ký Google" (số điện thoại, giới tính, ngày sinh, mục tiêu) → POST /auth/google-register.

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ApiError, businessCodeOf } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { googleErrorMessage, googleSignInUnavailableReason, signInWithGoogle } from '../../lib/googleSignIn';
import { holdGoogleAccount } from '../../lib/googleRegistration';
import { ACCOUNT_NOT_REGISTERED_CODE, GOOGLE_TEXT as TEXT } from '../../constants/auth';
import { ROUTES } from '../../navigation/routes';

export type GoogleAuthMode = 'login' | 'register';

export function useGoogleAuth(mode: GoogleAuthMode) {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    // Nút luôn hiện; chưa dùng được (Expo Go, web, thiếu cấu hình) thì giải thích thay vì im lặng
    const reason = googleSignInUnavailableReason();
    if (reason) {
      showAlert(TEXT.unavailableTitle, TEXT.unavailable[reason]);
      return;
    }
    setBusy(true);
    try {
      const outcome = await signInWithGoogle();
      if (outcome.status === 'cancelled') return;
      const account = { idToken: outcome.idToken, email: outcome.email, name: outcome.name, photo: outcome.photo };

      if (mode === 'register') {
        holdGoogleAccount(account);
        router.push(ROUTES.googleRegister);
        return;
      }
      try {
        await loginWithGoogle(account.idToken);
        Haptic.success();
      } catch (e) {
        if (businessCodeOf(e) !== ACCOUNT_NOT_REGISTERED_CODE) throw e;
        holdGoogleAccount(account);
        showConfirm(TEXT.notRegisteredTitle, TEXT.notRegistered, () => router.push(ROUTES.googleRegister), undefined, TEXT.registerNow);
      }
    } catch (e) {
      // null = người dùng tự đóng bảng chọn tài khoản → không báo lỗi
      const message = e instanceof ApiError ? e.message : googleErrorMessage(e);
      if (message) {
        Haptic.error();
        showAlert(TEXT.loginFailedTitle, message);
      }
    } finally {
      setBusy(false);
    }
  };

  return { busy, start };
}
