import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { ApiError } from '../../lib/api';
import { Brand } from '../../components';
import { showAlert } from '../../lib/alert';

const schema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register: authRegister } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await authRegister({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone || undefined,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Đăng ký thất bại. Vui lòng thử lại.';
      showAlert('Lỗi đăng ký', msg);
    }
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Brand size="lg" />
          <Text style={styles.tagline}>Bắt đầu hành trình của bạn</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Điền thông tin để đăng ký thành viên</Text>

          {/* Full Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Họ và tên</Text>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.fullName && styles.inputError]}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="words"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.text.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
          </View>

          {/* Phone (optional) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Số điện thoại <Text style={styles.optional}></Text></Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="0901234567"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="phone-pad"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Ít nhất 6 ký tự"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showPwd}
                    value={value ?? ''}
                    onChangeText={onChange}
                  />
                )}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(p => !p)} activeOpacity={0.7}>
                <MaterialIcons name={showPwd ? 'visibility-off' : 'visibility'} size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, isSubmitting && styles.btnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color={Colors.text.inverse} />
              : <Text style={styles.btnText}>Đăng ký</Text>}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Đăng nhập</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  tagline: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: Spacing.sm, fontFamily: 'BeVietnamPro_400Regular' },
  card: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  subtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4, marginBottom: Spacing.xl, fontFamily: 'BeVietnamPro_400Regular' },
  fieldContainer: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, color: Colors.text.secondary, marginBottom: 6, fontFamily: 'BeVietnamPro_500Medium' },
  optional: { color: Colors.text.muted, fontWeight: FontWeight.regular },
  input: {
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text.primary, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
    fontFamily: 'BeVietnamPro_400Regular',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingRight: Spacing.sm,
  },
  passwordInput: {
    flex: 1,
    padding: Spacing.md,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontFamily: 'BeVietnamPro_400Regular',
  },
  eyeBtn: {
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputError: { borderColor: Colors.status.failed },
  errorText: { fontSize: FontSize.xs, color: Colors.status.failed, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.text.inverse, fontSize: FontSize.md, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
  footerText: { color: Colors.text.secondary, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_400Regular' },
  link: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});

