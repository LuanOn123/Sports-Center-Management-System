import { api, ApiError } from '../lib/api';
import { MOBILE_ROLES, type LoginTokens, type User } from '../lib/types';

export function assertMobileRole(user: User) {
  if (!MOBILE_ROLES.includes(user.role)) throw new ApiError('Ứng dụng di động chỉ dành cho Hội viên và Huấn luyện viên. Vui lòng đăng nhập bằng bản web.', 403);
}
export function loginWithCaptcha(email: string, password: string, turnstileToken: string) {
  if (!turnstileToken.trim()) throw new ApiError('Vui lòng hoàn tất xác minh bảo mật.', 400);
  return api.publicPost<LoginTokens>('/auth/login', { email: email.trim().toLowerCase(), password, turnstileToken });
}
