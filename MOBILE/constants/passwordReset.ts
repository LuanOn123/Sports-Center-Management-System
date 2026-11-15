// constants/passwordReset.ts
// Quên mật khẩu bằng OTP — khớp BE (auth.service forgotPassword/resetPassword + middlewares/passwordResetLimit)

/** Hiệu lực của mã OTP (BE: OTP_TTL_MS) */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Chỉ được gửi lại mã sau chừng này kể từ lần gửi trước — BE bỏ qua yêu cầu sớm hơn nhưng vẫn trả 200, không gửi mail */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Mỗi mã chỉ được nhập sai chừng này lần, đủ số lần thì mã bị khóa và phải xin mã mới */
export const OTP_MAX_ATTEMPTS = 5;

/** Mã OTP gồm đúng chừng này chữ số */
export const OTP_LENGTH = 6;

/** Mật khẩu mới (quên mật khẩu, đổi mật khẩu trong hồ sơ) dài tối thiểu chừng này ký tự (BE + web) */
export const PASSWORD_MIN_LENGTH = 6;

/** Màn quên mật khẩu cuộn tới ô đang nhập: vị trí (px) cần cuộn tới theo từng ô, sau chừng này mili-giây để bàn phím mở xong */
export const PASSWORD_RESET_SCROLL = { email: 60, otp: 60, newPassword: 120, confirmPassword: 180, delayMs: 100 } as const;

export const PASSWORD_RESET_FORM_TEXT = {
  headerSubtitle: 'Khôi phục mật khẩu',
  emailTitle: 'Quên mật khẩu',
  emailHint: 'Nhập email đã đăng ký, chúng tôi sẽ gửi mã OTP 6 chữ số để đặt lại mật khẩu.',
  emailLabel: 'Email',
  resetTitle: 'Đặt lại mật khẩu',
  sentTo: 'Mã OTP đã được gửi tới',
  otpLabel: 'Mã OTP (6 chữ số)',
  newPasswordLabel: 'Mật khẩu mới',
  newPasswordPlaceholder: 'Ít nhất 6 ký tự',
  confirmLabel: 'Xác nhận mật khẩu mới',
  confirmPlaceholder: 'Nhập lại mật khẩu mới',
  submit: 'Đặt lại mật khẩu',
  changeEmail: 'Đổi email',
  backToLogin: 'Quay lại đăng nhập',
  missingTitle: 'Thiếu thông tin',
  errorTitle: 'Lỗi',
  successTitle: 'Thành công',
  missingEmail: 'Vui lòng nhập email.',
  otpLength: 'Mã OTP gồm 6 chữ số.',
  passwordShort: 'Mật khẩu mới ít nhất 6 ký tự.',
  mismatch: 'Mật khẩu xác nhận không khớp.',
  success: 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại.',
  sendFailed: 'Không gửi được mã OTP. Vui lòng thử lại.',
  resetFailed: 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.',
} as const;

export const PASSWORD_RESET_TEXT = {
  sendButton: 'Gửi mã OTP',
  resend: 'Gửi lại mã',
  sending: 'Đang gửi...',
  resendIn: (time: string) => `Gửi lại sau ${time}`,
  validFor: (time: string, attemptsLeft: number) => `Mã có hiệu lực trong ${time} · còn ${attemptsLeft}/${OTP_MAX_ATTEMPTS} lần nhập`,
  expired: 'Mã đã hết hạn, vui lòng gửi lại.',
  locked: 'Mã OTP đã bị khóa vì nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.',
  attemptsLeft: (left: number) => `Bạn còn ${left} lần thử với mã này.`,
} as const;
