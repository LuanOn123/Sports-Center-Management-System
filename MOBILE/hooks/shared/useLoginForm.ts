// hooks/shared/useLoginForm.ts
// Form đăng nhập email + mật khẩu kèm Cloudflare Turnstile (giống web: POST /auth/login cần turnstileToken dùng một lần).
// Sau mỗi lần gửi token bị hủy và widget được tạo lại để lấy token mới.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { LOGIN_TEXT as TEXT } from '../../constants/auth';

const schema = z.object({
  email: z.string().trim().email(TEXT.emailInvalid),
  password: z.string().min(1, TEXT.passwordRequired),
});
export type LoginFormValues = z.infer<typeof schema>;

export function useLoginForm() {
  const { login } = useAuth();
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const form = useForm<LoginFormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const submit = form.handleSubmit(async (data) => {
    Haptic.medium();
    try {
      await login(data.email, data.password, captchaToken);
      Haptic.success();
    } catch (e) {
      Haptic.error();
      showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.errorFallback);
    } finally {
      setCaptchaToken('');
      setCaptchaAttempt((value) => value + 1);
    }
  });

  return { form, submit, captchaToken, setCaptchaToken, captchaAttempt };
}
