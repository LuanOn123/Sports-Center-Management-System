// lib/passwordChange.ts
// Luật nhập form đổi mật khẩu trong hồ sơ (BE: PATCH /auth/me/change-password) — thuần, dùng với react-hook-form

import { z } from 'zod';
import { PASSWORD_CHANGE_TEXT as TEXT } from '../constants/profile';
import { PASSWORD_MIN_LENGTH } from '../constants/passwordReset';

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, TEXT.currentRequired),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, TEXT.newTooShort),
    confirmPassword: z.string().min(1, TEXT.confirmRequired),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { message: TEXT.mismatch, path: ['confirmPassword'] });

export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export const EMPTY_PASSWORD_CHANGE: PasswordChangeValues = { currentPassword: '', newPassword: '', confirmPassword: '' };
