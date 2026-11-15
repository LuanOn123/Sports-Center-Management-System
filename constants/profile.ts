// constants/profile.ts
// Lựa chọn của form hồ sơ cá nhân (giá trị enum khớp BE: auth.schema.ts updateMeSchema)

import type { Gender, TrainingLevel } from '../lib/types';

export interface ProfileOption<T extends string = string> {
  value: T;
  label: string;
}

export const GENDER_OPTIONS: ProfileOption<Gender>[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

export const TRAINING_LEVEL_OPTIONS: ProfileOption<TrainingLevel>[] = [
  { value: 'BEGINNER', label: 'Mới bắt đầu' },
  { value: 'INTERMEDIATE', label: 'Trung cấp' },
  { value: 'ADVANCED', label: 'Nâng cao' },
];

export const TRAINING_LEVEL_LABEL = Object.fromEntries(
  TRAINING_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TrainingLevel, string>;

/**
 * Mục tiêu phổ biến (chọn nhiều). BE lưu fitnessGoal dạng chuỗi tự do — các nhãn được
 * nối bằng ", " nên web/HLV vẫn đọc được bình thường.
 */
export const FITNESS_GOAL_OPTIONS = ['Tăng cơ', 'Giảm cân', 'Tăng sức bền', 'Cải thiện sức khỏe', 'Tăng độ dẻo dai'];

/** Khung giờ tập yêu thích (chọn nhiều) — lưu vào trainingPreference cùng ghi chú thêm */
export const TRAINING_TIME_OPTIONS = ['Sáng', 'Trưa', 'Chiều', 'Tối'];

/** Giới hạn độ dài của BE cho fitnessGoal / trainingPreference */
export const PROFILE_TEXT_MAX = 500;

/** Độ tuổi được phép khi khai ngày sinh (hồ sơ + đăng ký), tính tròn tuổi theo giờ Việt Nam */
export const MIN_MEMBER_AGE = 12;
export const MAX_MEMBER_AGE = 80;

/** Bộ chọn ngày sinh mở sẵn ở năm (hiện tại − số này) khi chưa có ngày sinh */
export const DEFAULT_BIRTH_AGE = 20;

/** Số điện thoại Việt Nam: bắt đầu bằng 0, tổng 10–11 chữ số */
export const VN_PHONE_PREFIX = '0';
export const VN_PHONE_MIN_DIGITS = 10;
export const VN_PHONE_MAX_DIGITS = 11;

/** Đăng ký (BE RegisterSchema / GoogleRegisterSchema) bắt buộc có số điện thoại — cùng câu với web */
export const PHONE_REQUIRED_MESSAGE = 'Vui lòng nhập số điện thoại.';

/** Màn Thông tin cá nhân: vị trí (px) cuộn tới theo từng ô khi bàn phím mở, ô lạ dùng giá trị mặc định; chờ bàn phím mở xong rồi mới cuộn */
export const PROFILE_FIELD_SCROLL_OFFSETS: Record<string, number> = {
  fullName: 120,
  phone: 360,
  fitnessGoalNote: 560,
  trainingNote: 820,
  currentPassword: 80,
  newPassword: 160,
  confirmPassword: 240,
};
export const PROFILE_FIELD_SCROLL_DEFAULT = 160;
export const PROFILE_FIELD_SCROLL_DELAY_MS = 120;

/** Ảnh đại diện: chọn ảnh vuông, nén 0.8, tối đa 5 MB (BE: multer avatar) */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_PICKER = { aspect: [1, 1] as [number, number], quality: 0.8 } as const;

export const AVATAR_TEXT = {
  permissionTitle: 'Thiếu quyền truy cập',
  permissionSettings: 'Vui lòng cấp quyền thư viện ảnh cho Pulse trong Cài đặt thiết bị.',
  permissionNeeded: 'Cần quyền truy cập thư viện ảnh để đổi ảnh đại diện.',
  tooLargeTitle: 'Ảnh quá lớn',
  tooLarge: 'Ảnh đại diện tối đa 5MB. Vui lòng chọn ảnh khác.',
  failed: 'Cập nhật ảnh đại diện thất bại',
  errorTitle: 'Lỗi',
} as const;

/** Tab "Bảo mật" — đổi mật khẩu (web: ProfilePage / CoachProfile) */
export const PASSWORD_CHANGE_TEXT = {
  tabInfo: 'Thông tin cá nhân',
  tabSecurity: 'Bảo mật',
  currentLabel: 'Mật khẩu hiện tại',
  newLabel: 'Mật khẩu mới',
  newPlaceholder: 'Ít nhất 6 ký tự',
  confirmLabel: 'Xác nhận mật khẩu mới',
  confirmPlaceholder: 'Nhập lại mật khẩu mới...',
  submit: 'Đổi mật khẩu',
  currentRequired: 'Nhập mật khẩu hiện tại',
  newTooShort: 'Mật khẩu mới ít nhất 6 ký tự',
  confirmRequired: 'Nhập lại mật khẩu mới',
  mismatch: 'Mật khẩu xác nhận không khớp',
  successTitle: 'Thành công',
  // BE thu hồi mọi phiên của tài khoản khi đổi mật khẩu → đăng nhập lại
  success: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.',
  errorTitle: 'Lỗi',
  failed: 'Đổi mật khẩu thất bại',
} as const;

export const PROFILE_SCREEN_TEXT = {
  title: 'Thông tin cá nhân',
  coachCardTitle: 'Thông tin Huấn luyện viên',
  specialization: 'Chuyên môn:',
  experience: 'Kinh nghiệm:',
  bio: 'Giới thiệu:',
  updating: 'Đang cập nhật',
  years: (n: number) => `${n} năm`,
} as const;

/** Nhãn vai trò hiển thị (hồ sơ, tab Tài khoản) */
export const ROLE_LABEL: Record<string, string> = {
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
};
