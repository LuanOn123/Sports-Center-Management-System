// hooks/shared/useForgotPassword.ts
// Quên mật khẩu qua OTP email — 2 bước trên cùng một màn: (1) nhập email để nhận mã OTP 6 số (hiệu lực 5 phút, BE luôn trả
// 200 dù email không tồn tại), (2) nhập OTP + mật khẩu mới. Gửi lại mã chỉ sau 60 giây và mỗi mã nhập sai tối đa 5 lần (BE);
// quy tắc thuần ở lib/passwordReset, đồng hồ ở useOtpStatus.

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useOtpStatus } from './useOtpStatus';
import { requestPasswordReset, resetPassword } from '../../services/authService';
import { ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { countsAsWrongOtp, resetFormError } from '../../lib/passwordReset';
import { OTP_MAX_ATTEMPTS, PASSWORD_RESET_FORM_TEXT as TEXT, PASSWORD_RESET_TEXT } from '../../constants/passwordReset';
import { ROUTES } from '../../navigation/routes';

export type ForgotPasswordStep = 'email' | 'reset';

export function useForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Lần gửi mã gần nhất (mốc + email) và số lần nhập sai mã đó — chỉ để hướng dẫn, BE mới là nơi quyết định */
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [sentEmail, setSentEmail] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Đếm ngược gửi lại (60 giây) và hiệu lực (5 phút) của mã đã gửi cho email đang nhập
  const emailKey = email.trim().toLowerCase();
  const otpInfo = useOtpStatus(sentAt !== null && sentEmail === emailKey ? sentAt : null, failedAttempts);

  const sendOtp = async () => {
    if (!email.trim()) {
      Haptic.warning();
      showAlert(TEXT.missingTitle, TEXT.missingEmail);
      return;
    }
    if (otpInfo.resendWaitMs > 0) return; // BE chỉ phát hành mã mới sau 60 giây — nút đã khóa, chặn cả bấm dồn
    setSending(true);
    Haptic.medium();
    try {
      await requestPasswordReset(email);
      setSentAt(Date.now());
      setSentEmail(emailKey);
      setFailedAttempts(0);
      setOtp('');
      setStep('reset');
      Haptic.success();
    } catch (e) {
      Haptic.error();
      showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.sendFailed);
    } finally {
      setSending(false);
    }
  };

  const submitReset = async () => {
    const invalid = resetFormError({ otp, newPassword, confirmPassword });
    if (invalid) {
      Haptic.warning();
      showAlert(invalid.title, invalid.message);
      return;
    }
    setSubmitting(true);
    Haptic.medium();
    try {
      await resetPassword({ email, otp, newPassword });
      Haptic.success();
      showAlert(TEXT.successTitle, TEXT.success, () => router.replace(ROUTES.login));
    } catch (e) {
      Haptic.error();
      if (countsAsWrongOtp(e)) {
        // Mã sai: mỗi lần nhập là một lần thử của mã này, đủ số lần thì BE khóa mã
        const used = failedAttempts + 1;
        setFailedAttempts(used);
        const left = Math.max(0, OTP_MAX_ATTEMPTS - used);
        showAlert(TEXT.errorTitle, `${e.message}\n${left > 0 ? PASSWORD_RESET_TEXT.attemptsLeft(left) : PASSWORD_RESET_TEXT.locked}`);
      } else {
        showAlert(TEXT.errorTitle, e instanceof ApiError ? e.message : TEXT.resetFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const changeEmail = () => {
    Haptic.light();
    setStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return {
    step,
    email, setEmail,
    otp, setOtp: (value: string) => setOtp(value.replace(/[^0-9]/g, '')),
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    showPassword, toggleShowPassword: () => setShowPassword((value) => !value),
    sending,
    submitting,
    sentAt,
    otpInfo,
    sendOtp,
    submitReset,
    changeEmail,
  };
}
