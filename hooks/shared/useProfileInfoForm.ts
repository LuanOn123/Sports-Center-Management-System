// hooks/shared/useProfileInfoForm.ts
// Logic form "Thông tin cá nhân" (PATCH /auth/me — giống ProfilePage web): giá trị mặc định
// từ /auth/me, kiểm tra hợp lệ, ghép lựa chọn chip thành chuỗi BE lưu, gửi và tải lại user.

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { showAlert } from '../../lib/alert';
import { Haptic } from '../../lib/haptics';
import { joinChoiceText, splitChoiceText } from '../../lib/profileFields';
import { memberBirthDateError } from '../../lib/businessRules';
import { FITNESS_GOAL_OPTIONS, PROFILE_TEXT_MAX, TRAINING_TIME_OPTIONS } from '../../constants/profile';
import type { User } from '../../lib/types';

const tooLong = `Tối đa ${PROFILE_TEXT_MAX} ký tự`;

const profileInfoSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Ít nhất 2 ký tự').max(100, 'Tối đa 100 ký tự'),
    dateOfBirth: z.string().optional().superRefine((value, ctx) => {
      const message = memberBirthDateError(value);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    phone: z.string().refine((value) => !value || /^[0-9+]{9,15}$/.test(value), 'Số điện thoại cần 9–15 chữ số').optional(),
    fitnessGoals: z.array(z.string()),
    fitnessGoalNote: z.string(),
    trainingLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    trainingTimes: z.array(z.string()),
    trainingNote: z.string(),
  })
  // BE giới hạn độ dài trên chuỗi đã ghép (lựa chọn + ghi chú)
  .refine((v) => joinChoiceText({ selected: v.fitnessGoals, note: v.fitnessGoalNote }, FITNESS_GOAL_OPTIONS).length <= PROFILE_TEXT_MAX, { message: tooLong, path: ['fitnessGoalNote'] })
  .refine((v) => joinChoiceText({ selected: v.trainingTimes, note: v.trainingNote }, TRAINING_TIME_OPTIONS).length <= PROFILE_TEXT_MAX, { message: tooLong, path: ['trainingNote'] });

export type ProfileInfoValues = z.infer<typeof profileInfoSchema>;

function valuesOf(user: User | null | undefined): ProfileInfoValues {
  const goals = splitChoiceText(user?.memberProfile?.fitnessGoal, FITNESS_GOAL_OPTIONS);
  const times = splitChoiceText(user?.memberProfile?.trainingPreference, TRAINING_TIME_OPTIONS);
  return {
    fullName: user?.fullName ?? '',
    dateOfBirth: user?.dateOfBirth?.slice(0, 10) ?? '',
    gender: user?.gender,
    phone: user?.phone ?? '',
    fitnessGoals: goals.selected,
    fitnessGoalNote: goals.note,
    trainingLevel: user?.memberProfile?.trainingLevel,
    trainingTimes: times.selected,
    trainingNote: times.note,
  };
}

export function useProfileInfoForm() {
  const { user, refreshUser } = useAuth();
  // BE chỉ lưu mục tiêu / trình độ / thời gian tập cho tài khoản MEMBER
  const hasMemberFields = user?.role === 'MEMBER';
  const form = useForm<ProfileInfoValues>({ resolver: zodResolver(profileInfoSchema), defaultValues: valuesOf(user) });
  const { reset } = form;

  useEffect(() => {
    if (user) reset(valuesOf(user));
  }, [user, reset]);

  const save = useMutation({
    mutationFn: (v: ProfileInfoValues) => {
      Haptic.medium();
      return api.patch('/auth/me', {
        fullName: v.fullName,
        phone: v.phone,
        gender: v.gender,
        dateOfBirth: v.dateOfBirth || undefined,
        ...(hasMemberFields && {
          fitnessGoal: joinChoiceText({ selected: v.fitnessGoals, note: v.fitnessGoalNote }, FITNESS_GOAL_OPTIONS),
          trainingLevel: v.trainingLevel,
          trainingPreference: joinChoiceText({ selected: v.trainingTimes, note: v.trainingNote }, TRAINING_TIME_OPTIONS),
        }),
      });
    },
    onSuccess: async () => {
      Haptic.success();
      await refreshUser();
      showAlert('Thành công', 'Hồ sơ đã được cập nhật!');
    },
    onError: (e) => {
      Haptic.error();
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Cập nhật thất bại');
    },
  });

  return {
    form,
    hasMemberFields,
    isSaving: save.isPending,
    submit: form.handleSubmit((v) => save.mutate(v)),
  };
}
