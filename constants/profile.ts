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

/** Nhãn vai trò hiển thị (hồ sơ, tab Tài khoản) */
export const ROLE_LABEL: Record<string, string> = {
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
};
