// lib/memberRegistration.ts
// Luật nhập liệu và chuyển form thành body gửi BE khi đăng ký hội viên (bằng email hoặc hoàn tất đăng ký Google).
// Khớp BE (RegisterSchema / GoogleRegisterSchema: số điện thoại bắt buộc, còn lại tùy chọn) và web (features/auth/Register.tsx):
// giới tính/ngày sinh/mục tiêu trống thì không gửi. Độ tuổi 12–80 là luật riêng của mobile (BE chỉ chặn ngày tương lai và quá 120 năm).

import { z } from 'zod';
import {
  DEFAULT_REGISTER_GENDER, FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH, PASSWORD_MIN_LENGTH, REGISTER_TEXT as TEXT,
} from '../constants/auth';
import { FITNESS_GOAL_OPTIONS, PROFILE_TEXT_MAX } from '../constants/profile';
import { memberBirthDateError, vnPhoneError } from './businessRules';
import { joinChoiceText } from './profileFields';
import type { GoogleRegisterPayload, RegisterPayload } from './types';

/** Các trường hồ sơ hội viên dùng chung cho đăng ký bằng email và hoàn tất đăng ký Google */
const memberProfileShape = {
  phone: z.string().superRefine((value, ctx) => {
    const message = vnPhoneError(value, true);
    if (message) ctx.addIssue({ code: 'custom', message });
  }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional().superRefine((value, ctx) => {
    const message = memberBirthDateError(value);
    if (message) ctx.addIssue({ code: 'custom', message });
  }),
  fitnessGoals: z.array(z.string()),
  fitnessGoalNote: z.string(),
};

// BE giới hạn độ dài trên chuỗi mục tiêu đã ghép (lựa chọn + ghi chú)
const goalFits = (v: { fitnessGoals: string[]; fitnessGoalNote: string }) =>
  joinChoiceText({ selected: v.fitnessGoals, note: v.fitnessGoalNote }, FITNESS_GOAL_OPTIONS).length <= PROFILE_TEXT_MAX;
const goalTooLong = { message: TEXT.tooLong(PROFILE_TEXT_MAX), path: ['fitnessGoalNote'] };

export const googleRegisterSchema = z.object(memberProfileShape).refine(goalFits, goalTooLong);

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(FULL_NAME_MIN_LENGTH, TEXT.fullNameMin).max(FULL_NAME_MAX_LENGTH, TEXT.fullNameMax),
    email: z.string().trim().email(TEXT.emailInvalid),
    password: z.string().min(PASSWORD_MIN_LENGTH, TEXT.passwordMin),
    confirmPassword: z.string().min(1, TEXT.confirmRequired),
    ...memberProfileShape,
  })
  .refine((v) => v.password === v.confirmPassword, { message: TEXT.confirmMismatch, path: ['confirmPassword'] })
  .refine(goalFits, goalTooLong);

export type MemberProfileValues = z.infer<typeof googleRegisterSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const DEFAULT_MEMBER_PROFILE_VALUES: MemberProfileValues = {
  phone: '',
  gender: DEFAULT_REGISTER_GENDER,
  dateOfBirth: '',
  fitnessGoals: [],
  fitnessGoalNote: '',
};

function profileFieldsOf(values: MemberProfileValues) {
  const fitnessGoal = joinChoiceText({ selected: values.fitnessGoals, note: values.fitnessGoalNote }, FITNESS_GOAL_OPTIONS);
  return {
    phone: values.phone.trim(),
    ...(values.gender ? { gender: values.gender } : {}),
    ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
    ...(fitnessGoal ? { fitnessGoal } : {}),
  };
}

export function toRegisterPayload(values: RegisterFormValues): RegisterPayload {
  return { email: values.email, password: values.password, fullName: values.fullName, ...profileFieldsOf(values) };
}

export function toGoogleRegisterPayload(credential: string, values: MemberProfileValues): GoogleRegisterPayload {
  return { credential, ...profileFieldsOf(values) };
}
