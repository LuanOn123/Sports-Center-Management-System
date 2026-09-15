import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Ít nhất 2 ký tự'),
  phone: z.string().optional(),
  fitnessGoal: z.string().optional(),
  trainingPreference: z.string().optional(),
});
const pwdSchema = z.object({
  currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới ít nhất 6 ký tự'),
});
type ProfileForm = z.infer<typeof profileSchema>;
type PwdForm = z.infer<typeof pwdSchema>;

const LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Cơ bản' },
  { value: 'INTERMEDIATE', label: 'Trung cấp' },
  { value: 'ADVANCED', label: 'Nâng cao' },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<'info' | 'security'>('info');
  const [editingLevel, setEditingLevel] = useState(false);
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      fitnessGoal: user?.memberProfile?.fitnessGoal ?? '',
      trainingPreference: user?.memberProfile?.trainingPreference ?? '',
    },
  });

  const { control: pwdControl, handleSubmit: handlePwd, formState: { errors: pwdErrors, isSubmitting: pwdSubmitting }, reset: resetPwd } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/me', data),
    onSuccess: async () => {
      await refreshUser();
      showAlert('Thành công', 'Hồ sơ đã được cập nhật!');
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const changePwd = useMutation({
    mutationFn: (data: PwdForm) => api.patch('/auth/me/change-password', data),
    onSuccess: () => {
      resetPwd();
      showAlert('Thành công', 'Mật khẩu đã được thay đổi!');
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Đổi mật khẩu thất bại');
    },
  });

  const updateLevel = useMutation({
    mutationFn: (level: string) => api.patch('/auth/me', { trainingLevel: level }),
    onSuccess: async () => {
      await refreshUser();
      setEditingLevel(false);
    },
    onError: (e) => {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  const handleLogout = () => {
    showConfirm('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', logout, undefined, 'Đăng xuất', true);
  };


  const ROLE_LABEL: Record<string, string> = { MEMBER: 'Hội viên', COACH: 'HLV', STAFF: 'Lễ tân', MANAGER: 'Quản lý' };
  const LEVEL_LABEL: Record<string, string> = { BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROLE_LABEL[user?.role ?? 'MEMBER']}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'info' && styles.tabBtnActive]} onPress={() => setTab('info')}>
          <Text style={[styles.tabBtnText, tab === 'info' && styles.tabBtnTextActive]}>Thông tin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'security' && styles.tabBtnActive]} onPress={() => setTab('security')}>
          <Text style={[styles.tabBtnText, tab === 'security' && styles.tabBtnTextActive]}>Bảo mật</Text>
        </TouchableOpacity>
      </View>

      {tab === 'info' && (
        <View style={styles.card}>
          {/* Full name */}
          <View style={styles.field}>
            <Text style={styles.label}>Họ và tên</Text>
            <Controller control={control} name="fullName" render={({ field: { onChange, value } }) => (
              <TextInput style={[styles.input, errors.fullName && styles.inputError]} value={value} onChangeText={onChange} placeholderTextColor={Colors.text.muted} />
            )} />
            {errors.fullName && <Text style={styles.err}>{errors.fullName.message}</Text>}
          </View>
          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Số điện thoại</Text>
            <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="phone-pad" placeholderTextColor={Colors.text.muted} />
            )} />
          </View>
          {/* Fitness Goal */}
          <View style={styles.field}>
            <Text style={styles.label}>Mục tiêu tập luyện</Text>
            <Controller control={control} name="fitnessGoal" render={({ field: { onChange, value } }) => (
              <TextInput style={[styles.input, { height: 80 }]} value={value} onChangeText={onChange} multiline placeholder="Mô tả mục tiêu của bạn..." placeholderTextColor={Colors.text.muted} />
            )} />
          </View>
          {/* Training Preference */}
          <View style={styles.field}>
            <Text style={styles.label}>Thời gian tập yêu thích</Text>
            <Controller control={control} name="trainingPreference" render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="VD: Sáng sớm, chiều tối..." placeholderTextColor={Colors.text.muted} />
            )} />
          </View>
          {/* Training Level */}
          <View style={styles.field}>
            <Text style={styles.label}>Trình độ</Text>
            {!editingLevel ? (
              <TouchableOpacity style={styles.levelRow} onPress={() => setEditingLevel(true)}>
                <Text style={styles.levelValue}>{LEVEL_LABEL[user?.memberProfile?.trainingLevel ?? ''] ?? '—'}</Text>
                <Text style={styles.editLink}>Thay đổi</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.levelOptions}>
                {LEVEL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.levelOpt, user?.memberProfile?.trainingLevel === opt.value && styles.levelOptActive]}
                    onPress={() => updateLevel.mutate(opt.value)}
                    disabled={updateLevel.isPending}
                  >
                    <Text style={[styles.levelOptText, user?.memberProfile?.trainingLevel === opt.value && styles.levelOptTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
            onPress={handleSubmit((data) => updateProfile.mutate(data))}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color={Colors.text.inverse} /> : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>}
          </TouchableOpacity>
        </View>
      )}

      {tab === 'security' && (
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu hiện tại</Text>
            <Controller control={pwdControl} name="currentPassword" render={({ field: { onChange, value } }) => (
              <TextInput style={[styles.input, pwdErrors.currentPassword && styles.inputError]} value={value} onChangeText={onChange} secureTextEntry placeholderTextColor={Colors.text.muted} placeholder="••••••••" />
            )} />
            {pwdErrors.currentPassword && <Text style={styles.err}>{pwdErrors.currentPassword.message}</Text>}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu mới</Text>
            <Controller control={pwdControl} name="newPassword" render={({ field: { onChange, value } }) => (
              <TextInput style={[styles.input, pwdErrors.newPassword && styles.inputError]} value={value} onChangeText={onChange} secureTextEntry placeholderTextColor={Colors.text.muted} placeholder="Ít nhất 6 ký tự" />
            )} />
            {pwdErrors.newPassword && <Text style={styles.err}>{pwdErrors.newPassword.message}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, pwdSubmitting && styles.saveBtnDisabled]}
            onPress={handlePwd((data) => changePwd.mutate(data))}
            disabled={pwdSubmitting}
          >
            {pwdSubmitting ? <ActivityIndicator color={Colors.text.inverse} /> : <Text style={styles.saveBtnText}>Đổi mật khẩu</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.text.inverse, fontFamily: 'BeVietnamPro_700Bold' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  email: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  roleBadge: { marginTop: Spacing.sm, backgroundColor: Colors.primary + '20', borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: 3 },
  roleText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },
  tabRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  tabBtnTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontFamily: 'BeVietnamPro_700Bold' },
  card: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, color: Colors.text.secondary, marginBottom: 6, fontFamily: 'BeVietnamPro_500Medium' },
  input: { backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.text.primary, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border, fontFamily: 'BeVietnamPro_400Regular' },
  inputError: { borderColor: Colors.status.failed },
  err: { fontSize: FontSize.xs, color: Colors.status.failed, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  levelValue: { fontSize: FontSize.md, color: Colors.text.primary, fontFamily: 'BeVietnamPro_500Medium' },
  editLink: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_500Medium' },
  levelOptions: { flexDirection: 'row', gap: Spacing.sm },
  levelOpt: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border },
  levelOptActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  levelOptText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_500Medium' },
  levelOptTextActive: { color: Colors.text.inverse, fontWeight: FontWeight.bold },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
  logoutBtn: { backgroundColor: Colors.status.failed + '15', borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.status.failed + '30' },
  logoutText: { color: Colors.status.failed, fontWeight: FontWeight.bold, fontSize: FontSize.md, fontFamily: 'BeVietnamPro_700Bold' },
});
