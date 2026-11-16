// constants/classes.ts
// Nhãn / tham số hiển thị lớp học (khớp FE web: StatusBadge REGULAR / PREMIUM)

import type { AreaType, ClassType } from '../lib/types';
import { FILTER_TEXT } from './filters';
import { Colors } from './theme';

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  REGULAR: 'Tiêu chuẩn',
  PREMIUM: 'Cao cấp',
};

export const CLASS_TYPE_COLOR: Record<ClassType, string> = {
  REGULAR: Colors.status.scheduled,
  PREMIUM: Colors.tier.PREMIUM,
};

/** Bộ lọc hạng lớp trên màn Khám phá (undefined = tất cả) */
export const CLASS_TYPE_FILTERS: (ClassType | undefined)[] = [undefined, 'REGULAR', 'PREMIUM'];

/** Khu vực tập của lớp — cùng chữ với bộ lọc "Tất cả khu vực" của web (BrowseClassesPage) */
export const CLASS_AREA_LABEL: Record<AreaType, string> = {
  INDOOR: 'Trong nhà',
  OUTDOOR: 'Ngoài trời',
  POOL: 'Hồ bơi',
};

/** Bộ lọc khu vực ở Khám phá (undefined = tất cả) */
export const CLASS_AREA_FILTERS: (AreaType | undefined)[] = [undefined, 'INDOOR', 'OUTDOOR', 'POOL'];

/**
 * Bảng "Bộ lọc" của Khám phá: môn tập, hạng lớp, khu vực và kỳ học (web: bốn ô chọn cạnh ô tìm kiếm).
 * Màn chính chỉ có ô tìm kiếm + nút "Bộ lọc"; bộ lọc đang bật hiện thành chip gỡ được (components/shared/ActiveFilterChips).
 * Chữ chung của mọi bảng lọc (nút, "Tất cả", "Xóa bộ lọc", nhãn gỡ chip) lấy từ FILTER_TEXT.
 */
export const CLASS_FILTER_TEXT = {
  ...FILTER_TEXT,
  sheetTitle: 'Bộ lọc lớp học',
  sport: 'Môn tập',
  type: 'Hạng lớp',
  area: 'Khu vực tập',
  term: 'Kỳ học',
  currentTerm: 'Kỳ hiện tại',
  /** Nút chính của bảng lọc: số lớp đang hiện (cập nhật ngay khi chọn) */
  apply: (count: number) => `Xem ${count} lớp`,
  noResult: 'Không có lớp phù hợp',
  noTerms: 'Cơ sở này chưa có kỳ học nào.',
} as const;

/** Thẻ "Lớp phụ trách" của HLV (web: CoachWorkspace mode "classes") */
export const COACH_CLASS_TEXT = {
  capacity: (n: number) => `Tối đa ${n} học viên / buổi`,
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  defaultDescription: 'Lớp tập luyện được phân công cho bạn.',
  detail: 'Chi tiết lớp',
  schedule: 'Xem lịch dạy',
} as const;

/** Số khung giờ trong tuần hiện trên thẻ lớp, phần còn lại gộp "+n khung giờ khác" */
export const CLASS_CARD_SLOT_PREVIEW = 2;

/** Màu nhãn trạng thái từng buổi trong khóa (lib/classPlan › sessionStatusLabel) */
export const SESSION_TONE_COLOR = {
  booked: Colors.status.success,
  completed: Colors.status.scheduled,
  full: Colors.status.failed,
  conflict: Colors.status.pending,
  none: Colors.text.muted,
} as const;

/** Còn ít chỗ hơn hoặc bằng số này thì báo "Sắp kín" */
export const LOW_SLOT_THRESHOLD = 3;

/**
 * "Các buổi của khóa" ở chi tiết lớp (components/classes/CourseSessionList): hiện gọn trong khung vừa đúng `visibleRows` buổi,
 * các buổi còn lại kéo xuống ngay trong khung. `estimatedRowHeight` (px) chỉ dùng tới khi đo được chiều cao thật của các dòng.
 */
export const COURSE_SESSION_LIST = {
  visibleRows: 5,
  estimatedRowHeight: 64,
  moreHint: (total: number) => `Kéo xuống trong khung để xem đủ ${total} buổi`,
} as const;

/**
 * Lớp của tôi (web MyClassesPage): hội viên không tự hủy hay đổi buổi — mỗi lớp chỉ có "Xem lớp",
 * cần hỗ trợ về lịch thì liên hệ lễ tân (dòng nhắc dưới tab Sắp tới)
 */
export const MY_CLASSES_TEXT = {
  viewClass: 'Xem lớp',
  supportNote: 'Nếu cần hỗ trợ về lịch học, vui lòng liên hệ lễ tân cơ sở.',
} as const;

/** Khung "Quyền đăng ký lớp học" ở Lớp của tôi (web MyClassesPage) — câu chữ khớp BE concurrentClassLimitMessage */
export const ENROLLMENT_QUOTA_TEXT = {
  lockedTitle: 'Mở quyền đăng ký lớp học',
  lockedFree: 'Tài khoản Free chưa bao gồm lớp học. Chọn gói Membership hoặc Premium để bắt đầu đăng ký.',
  lockedNoPlan: 'Bạn cần một gói tập còn hiệu lực để đăng ký lớp học.',
  viewPlans: 'Xem các gói tập',
  title: 'Quyền đăng ký lớp học',
  remaining: (n: number) => `Bạn có thể đăng ký thêm ${n} lớp khác nhau.`,
  full: 'Bạn đã đăng ký đủ số lớp của gói hiện tại. Hãy hoàn thành hoặc hủy lớp chưa bắt đầu trước khi đăng ký lớp mới.',
  note: 'Mỗi lớp có nhiều buổi vẫn chỉ tính là một lớp. Giới hạn áp dụng chung tại mọi cơ sở.',
  usedLabel: 'Lớp đang đăng ký',
} as const;
