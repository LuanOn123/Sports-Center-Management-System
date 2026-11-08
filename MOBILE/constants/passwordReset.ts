// constants/passwordReset.ts
// Quên mật khẩu bằng OTP — khớp BE (auth.service forgotPassword/resetPassword + middlewares/passwordResetLimit)

/** Hiệu lực của mã OTP (BE: OTP_TTL_MS) */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Chỉ được gửi lại mã sau chừng này kể từ lần gửi trước — BE bỏ qua yêu cầu sớm hơn nhưng vẫn trả 200, không gửi mail */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Mỗi mã chỉ được nhập sai chừng này lần, đủ số lần thì mã bị khóa và phải xin mã mới */
export const OTP_MAX_ATTEMPTS = 5;

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
