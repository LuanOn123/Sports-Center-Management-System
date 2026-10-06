// app/auth/forgot-password.tsx
// Quên mật khẩu qua OTP email — 2 bước trên cùng 1 màn hình:
// (1) nhập email để nhận mã OTP 6 số (hiệu lực 5 phút, BE luôn trả 200 dù email
//     không tồn tại — chống dò email), (2) nhập OTP + mật khẩu mới để đặt lại.
// Không có endpoint verify-otp riêng — BE xác minh OTP ngay trong bước reset.

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import clsx from 'clsx';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/shared/Icon';
import { KeyboardAwareView } from '../../components/shared/KeyboardAwareView';
import { Colors } from '../../constants/theme';
import { api, ApiError } from '../../lib/api';
import { Brand } from '../../components';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';

const OTP_TTL_MS = 5 * 60 * 1000;

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Đếm ngược 5 phút chỉ để hiển thị — BE mới là nơi quyết định OTP còn hạn hay không.
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setIsKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvent, () => setIsKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const handleInputFocus = (offset = 120) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 100);
  };

  const sendOtp = async () => {
    if (!email.trim()) {
      Haptic.warning();
      showAlert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }
    setSending(true);
    Haptic.medium();
    try {
      await api.publicPost('/auth/forgot-password', { email: email.trim() });
      setExpiresAt(Date.now() + OTP_TTL_MS);
      setNow(Date.now());
      setStep('reset');
      Haptic.success();
    } catch (e) {
      Haptic.error();
      const msg = e instanceof ApiError ? e.message : 'Không gửi được mã OTP. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    if (otp.trim().length !== 6) {
      Haptic.warning();
      showAlert('Thiếu thông tin', 'Mã OTP gồm 6 chữ số.');
      return;
    }
    if (newPassword.length < 6) {
      Haptic.warning();
      showAlert('Thiếu thông tin', 'Mật khẩu mới ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Haptic.warning();
      showAlert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    Haptic.medium();
    try {
      await api.publicPost('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      Haptic.success();
      showAlert('Thành công', 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại.', () => {
        router.replace('/auth/login');
      });
    } catch (e) {
      Haptic.error();
      const msg = e instanceof ApiError ? e.message : 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.';
      showAlert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    Haptic.light();
    setStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setExpiresAt(null);
  };

  const remaining = expiresAt ? expiresAt - now : 0;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: isKeyboardOpen ? 'flex-start' : 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24) + (isKeyboardOpen ? 10 : 20),
          paddingBottom: Math.max(insets.bottom, 20) + (isKeyboardOpen ? 40 : 16),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View className="items-center mb-xl">
          <Brand size="lg" />
          <Text className="text-sm text-text-secondary mt-sm font-bevn-regular">Khôi phục mật khẩu</Text>
        </View>

        {/* Card */}
        <View className="bg-bg-surface rounded-xl p-xl border border-border">
          {step === 'email' ? (
            <>
              <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-sm text-center">Quên mật khẩu</Text>
              <Text className="text-sm text-text-secondary mb-xl text-center font-bevn-regular">
                Nhập email đã đăng ký, chúng tôi sẽ gửi mã OTP 6 chữ số để đặt lại mật khẩu.
              </Text>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Email</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => handleInputFocus(60)}
                />
              </View>

              <TouchableOpacity
                className={clsx('bg-primary rounded-md p-md items-center justify-center', sending && 'opacity-60')}
                onPress={sendOtp}
                disabled={sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color={Colors.text.inverse} />
                  : <Text className="text-text-inverse text-md font-bold font-bevn-bold">Gửi mã OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-xl font-bold font-bevn-bold text-text-primary mb-sm text-center">Đặt lại mật khẩu</Text>
              <Text className="text-sm text-text-secondary mb-lg text-center font-bevn-regular">
                Mã OTP đã được gửi tới <Text className="text-text-primary font-bevn-semibold">{email}</Text>
              </Text>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mã OTP (6 chữ số)</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular text-center tracking-[6px]"
                  placeholder="000000"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ''))}
                  onFocus={() => handleInputFocus(60)}
                />
                {Boolean(expiresAt) && (
                  <Text className={clsx('text-xs mt-1 font-bevn-regular', remaining <= 0 ? 'text-status-failed' : 'text-text-muted')}>
                    {remaining > 0 ? `Mã có hiệu lực trong ${formatCountdown(remaining)}` : 'Mã đã hết hạn, vui lòng gửi lại.'}
                  </Text>
                )}
              </View>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Mật khẩu mới</Text>
                <View className="flex-row items-center bg-bg-elevated rounded-md border border-border pr-sm">
                  <TextInput
                    className="flex-1 p-md text-text-primary text-md font-bevn-regular"
                    placeholder="Ít nhất 6 ký tự"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showPwd}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => handleInputFocus(120)}
                  />
                  <TouchableOpacity className="p-sm justify-center items-center" onPress={() => { Haptic.light(); setShowPwd((p) => !p); }} activeOpacity={0.7}>
                    <Icon name={showPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-lg">
                <Text className="text-sm text-text-secondary mb-1.5 font-bevn-medium">Xác nhận mật khẩu mới</Text>
                <TextInput
                  className="bg-bg-elevated rounded-md p-md text-text-primary text-md border border-border font-bevn-regular"
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor={Colors.text.muted}
                  secureTextEntry={!showPwd}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => handleInputFocus(180)}
                />
              </View>

              <TouchableOpacity
                className={clsx('bg-primary rounded-md p-md items-center justify-center', submitting && 'opacity-60')}
                onPress={handleReset}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.text.inverse} />
                  : <Text className="text-text-inverse text-md font-bold font-bevn-bold">Đặt lại mật khẩu</Text>}
              </TouchableOpacity>

              <View className="flex-row justify-center gap-lg mt-lg">
                <TouchableOpacity onPress={sendOtp} disabled={sending} activeOpacity={0.7}>
                  <Text className="text-primary text-sm font-semibold font-bevn-semibold">{sending ? 'Đang gửi...' : 'Gửi lại mã'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleChangeEmail} activeOpacity={0.7}>
                  <Text className="text-text-muted text-sm font-bevn-medium">Đổi email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Back to login */}
          <View className="flex-row justify-center items-center mt-xl">
            <Link href="/auth/login" asChild>
              <TouchableOpacity onPress={() => Haptic.light()} activeOpacity={0.7}>
                <Text className="text-primary text-sm font-semibold font-bevn-semibold">Quay lại đăng nhập</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAwareView>
  );
}
