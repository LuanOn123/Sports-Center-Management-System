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
import { showAlert } from '../../lib/alert';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      showAlert('Lỗi đăng nhập', msg);
    }
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialIcons name="bolt" size={40} color={Colors.text.inverse} />
          </View>
          <Text style={styles.appName}>PulseCenter</Text>
          <Text style={styles.tagline}>Trung tâm thể thao của bạn</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập</Text>
          <Text style={styles.subtitle}>Chào mừng trở lại!</Text>

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
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.inputRow}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, styles.inputFlex, errors.password && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.text.muted}
                    secureTextEntry={!showPwd}
                    autoComplete="current-password"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(p => !p)}>
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
              : <Text style={styles.btnText}>Đăng nhập</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
            <Link href="/auth/register" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Đăng ký ngay</Text>
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
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoContainer: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  appName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  tagline: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  card: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  subtitle: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4, marginBottom: Spacing.xl, fontFamily: 'BeVietnamPro_400Regular' },
  fieldContainer: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, color: Colors.text.secondary, marginBottom: 6, fontFamily: 'BeVietnamPro_500Medium' },
  input: {
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text.primary, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border,
    fontFamily: 'BeVietnamPro_400Regular',
  },
  inputFlex: { flex: 1 },
  inputError: { borderColor: Colors.status.failed },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyeBtn: { padding: Spacing.md, backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSize.xs, color: Colors.status.failed, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.text.inverse, fontSize: FontSize.md, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
  footerText: { color: Colors.text.secondary, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_400Regular' },
  link: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
});

