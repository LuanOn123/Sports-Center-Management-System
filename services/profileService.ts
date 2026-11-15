// services/profileService.ts
// Tầng gọi API hồ sơ cá nhân — thuần túy, không có state, không có hook

import { api } from '../lib/api';
import type { Gender, TrainingLevel } from '../lib/types';

export interface UpdateProfileBody {
  fullName: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  fitnessGoal?: string;
  trainingLevel?: TrainingLevel;
  trainingPreference?: string;
}

/** PATCH /auth/me — cập nhật thông tin cá nhân (mục tiêu / trình độ / thời gian tập chỉ BE lưu cho MEMBER) */
export const updateProfile = (body: UpdateProfileBody) => api.patch('/auth/me', body);

/** PATCH /auth/me/change-password — BE thu hồi mọi phiên đăng nhập của tài khoản */
export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  api.patch('/auth/me/change-password', body);

/** POST /auth/me/avatar (multipart, trường `avatar`) — trả về user đã cập nhật ảnh */
export const uploadAvatar = (formData: FormData) => api.uploadAvatar(formData);
