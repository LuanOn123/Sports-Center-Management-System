/// <reference types="vite/client" />
/** Public widget key only. Verification is mandatory on the backend. */
export const turnstileSiteKey =
  import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || "";
export function requireLoginCaptcha(token?: string) {
  if (!turnstileSiteKey)
    throw new Error("Xác minh bảo mật chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
  if (!token?.trim())
    throw new Error("Vui lòng hoàn tất xác minh bảo mật trước khi đăng nhập.");
}
