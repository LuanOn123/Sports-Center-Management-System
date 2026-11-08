import { api, ApiError } from '../lib/api';
import { MOBILE_ROLES, type GoogleRegisterPayload, type LoginTokens, type User } from '../lib/types';

export function assertMobileRole(user: User) {
  if (!MOBILE_ROLES.includes(user.role)) throw new ApiError('Ứng dụng di động chỉ dành cho Hội viên và Huấn luyện viên. Vui lòng đăng nhập bằng bản web.', 403);
}
export function loginWithCaptcha(email: string, password: string, turnstileToken: string) {
  if (!turnstileToken.trim()) throw new ApiError('Vui lòng hoàn tất xác minh bảo mật.', 400);
  return api.publicPost<LoginTokens>('/auth/login', { email: email.trim().toLowerCase(), password, turnstileToken });
}

/**
 * POST /auth/google-login — đăng nhập bằng Google ID token (không cần CAPTCHA, giống web).
 * Email chưa có tài khoản → 404 kèm `errors.code = ACCOUNT_NOT_REGISTERED` (đọc bằng businessCodeOf).
 */
export const loginWithGoogleCredential = (credential: string) =>
  api.publicPost<LoginTokens>('/auth/google-login', { credential });

/**
 * POST /auth/google-register — tạo tài khoản hội viên từ Google ID token; BE bắt buộc số điện thoại và trả luôn token
 * (email đã dùng → 409). Họ tên và email do BE lấy từ token, không gửi từ mobile.
 */
export const registerWithGoogleCredential = (payload: GoogleRegisterPayload) =>
  api.publicPost<LoginTokens>('/auth/google-register', payload);
