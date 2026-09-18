// services/authService.ts
// Tầng gọi API xác thực và tài khoản cá nhân

import { api } from '../lib/api';
import type { User, LoginTokens } from '../lib/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  fitnessGoal?: string;
  trainingLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  trainingPreference?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** GET /auth/me */
export const getMe = () => api.get<User>('/auth/me');

/** PATCH /auth/me */
export const updateMe = (payload: UpdateProfilePayload) =>
  api.patch<User>('/auth/me', payload);

/** PATCH /auth/me/change-password */
export const changePassword = (payload: ChangePasswordPayload) =>
  api.patch('/auth/me/change-password', payload);

/** POST /auth/login */
export const loginApi = (payload: LoginPayload) =>
  api.post<LoginTokens & { user: User }>('/auth/login', payload);

/** POST /auth/register */
export const registerApi = (payload: RegisterPayload) =>
  api.post<LoginTokens & { user: User }>('/auth/register', payload);

/** POST /auth/logout */
export const logoutApi = (refreshToken?: string) =>
  api.post('/auth/logout', { refreshToken });
