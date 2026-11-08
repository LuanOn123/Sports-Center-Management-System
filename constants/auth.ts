// constants/auth.ts
// Quy tắc + câu chữ của luồng đăng ký / đăng nhập Google. Khớp BE (auth.schema.ts: RegisterSchema, GoogleRegisterSchema)
// và web (features/auth/Register.tsx, features/auth/Login.tsx).

import type { GoogleUnavailableReason } from '../lib/googleSignInTypes';
import type { Gender } from '../lib/types';

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 6;

/** Web chọn sẵn "Nam" ở ô giới tính khi đăng ký */
export const DEFAULT_REGISTER_GENDER: Gender = 'MALE';

/** Mã nghiệp vụ BE đặt trong `errors.code` khi đăng nhập Google bằng email chưa có tài khoản (HTTP 404) */
export const ACCOUNT_NOT_REGISTERED_CODE = 'ACCOUNT_NOT_REGISTERED';

export const REGISTER_TEXT = {
  subtitle: 'Bắt đầu hành trình của bạn',
  title: 'Tạo tài khoản',
  fullName: 'Họ và tên',
  fullNameMin: `Họ tên ít nhất ${FULL_NAME_MIN_LENGTH} ký tự`,
  fullNameMax: `Họ tên tối đa ${FULL_NAME_MAX_LENGTH} ký tự`,
  email: 'Email',
  emailInvalid: 'Email không hợp lệ',
  password: 'Mật khẩu',
  passwordPlaceholder: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  passwordMin: `Mật khẩu ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  confirmPassword: 'Xác nhận mật khẩu',
  confirmPlaceholder: 'Nhập lại mật khẩu',
  confirmRequired: 'Nhập lại mật khẩu',
  confirmMismatch: 'Mật khẩu xác nhận không khớp',
  phone: 'Số điện thoại',
  phonePlaceholder: '0901234567',
  gender: 'Giới tính',
  optional: '(không bắt buộc)',
  birthDate: 'Ngày sinh',
  goal: 'Mục tiêu của bạn',
  goalHint: '(chọn nhiều)',
  goalPlaceholder: 'Ví dụ: Giảm cân, tăng cơ, cải thiện vóc dáng...',
  tooLong: (max: number) => `Tối đa ${max} ký tự`,
  submit: 'Đăng ký',
  haveAccount: 'Đã có tài khoản? ',
  login: 'Đăng nhập',
  successTitle: 'Đăng ký thành công',
  successMessage: 'Vui lòng đăng nhập để bắt đầu sử dụng tài khoản.',
  errorTitle: 'Lỗi đăng ký',
  errorFallback: 'Đăng ký thất bại. Vui lòng thử lại.',
} as const;

export const GOOGLE_TEXT = {
  /** Phân cách dưới nút Đăng nhập / Đăng ký (web: "HOẶC TIẾP TỤC VỚI" / "HOẶC ĐĂNG KÝ NHANH VỚI") */
  loginDivider: 'HOẶC TIẾP TỤC VỚI',
  registerDivider: 'HOẶC ĐĂNG KÝ NHANH VỚI',
  loginButton: 'Đăng nhập bằng Google',
  registerButton: 'Đăng ký bằng Google',

  /** Chưa dùng được Google: nút vẫn hiện, bấm vào thì giải thích theo từng lý do */
  unavailableTitle: 'Chưa dùng được Google trên bản này',
  unavailable: {
    web: 'Đăng nhập Google chỉ dùng được trên ứng dụng Android/iOS. Bạn vẫn có thể dùng email và mật khẩu.',
    'expo-go': 'Expo Go không hỗ trợ đăng nhập Google. Hãy dùng bản ứng dụng cài riêng (development build) hoặc đăng nhập bằng email và mật khẩu.',
    'not-configured': 'Ứng dụng chưa có cấu hình Google (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID). Vui lòng đăng nhập bằng email và mật khẩu.',
    'native-module-missing': 'Bản ứng dụng này chưa gắn Google. Hãy build lại development build rồi thử lại, hoặc đăng nhập bằng email và mật khẩu.',
  } satisfies Record<GoogleUnavailableReason, string>,
  playServicesMissing: 'Thiết bị chưa có Google Play Services. Hãy cài hoặc cập nhật rồi thử lại.',
  noIdToken: 'Google không trả chứng thực đăng nhập. Hãy kiểm tra Web client ID của ứng dụng rồi thử lại.',

  loginFailedTitle: 'Đăng nhập Google chưa thành công',
  loginFailedFallback: 'Không đăng nhập được bằng Google. Vui lòng thử lại.',
  /** Web: tài khoản Google chưa đăng ký → mời sang đăng ký hội viên */
  notRegisteredTitle: 'Tài khoản Google chưa đăng ký',
  notRegistered: 'Tài khoản Google này chưa được đăng ký trong hệ thống. Vui lòng đăng ký tài khoản trước!',
  registerNow: 'Đăng ký ngay',

  completeTitle: 'Hoàn tất đăng ký Google',
  completeSubtitle: 'Bổ sung số điện thoại và mục tiêu tập luyện để kích hoạt tài khoản',
  completeSubmit: 'Hoàn tất đăng ký & Bắt đầu',
  completeBack: 'Quay lại phương thức khác',
  completeFailedTitle: 'Đăng ký Google chưa thành công',
  completeFailedFallback: 'Đăng ký bằng Google thất bại. Vui lòng thử lại.',
} as const;

export const LOGIN_TEXT = {
  tagline: 'Trung tâm thể thao của bạn',
  title: 'Đăng nhập',
  email: 'Email',
  emailInvalid: 'Email không đúng định dạng',
  password: 'Mật khẩu',
  passwordRequired: 'Vui lòng nhập mật khẩu',
  forgotPassword: 'Quên mật khẩu?',
  submit: 'Đăng nhập',
  noAccount: 'Chưa có tài khoản? ',
  registerNow: 'Đăng ký ngay',
  errorTitle: 'Lỗi đăng nhập',
  errorFallback: 'Đăng nhập thất bại. Vui lòng thử lại.',
} as const;
