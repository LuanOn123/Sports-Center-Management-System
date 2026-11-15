// constants/coachProfile.ts
// Hồ sơ huấn luyện viên xem từ chi tiết lớp (web: CoachCard + CoachProfileDialog) — câu chữ khớp web.

export const COACH_PROFILE_TEXT = {
  cardRolePrimary: 'HUẤN LUYỆN VIÊN CHÍNH',
  cardRoleSupport: 'HUẤN LUYỆN VIÊN HỖ TRỢ',
  cardLink: 'Hồ sơ & đánh giá',
  defaultName: 'Huấn luyện viên',
  defaultSpecialization: 'Huấn luyện viên Pulse',
  sheetTitle: 'Hồ sơ huấn luyện viên',
  eyebrow: 'PULSE SPORTS CENTER',
  rolePrimary: 'Huấn luyện viên chính của lớp',
  roleSupport: 'Huấn luyện viên hỗ trợ của lớp',
  specialtyTitle: 'Chuyên môn',
  noSpecialty: 'Chưa cập nhật chuyên môn.',
  experienceTitle: 'Kinh nghiệm',
  noExperience: 'Chưa cập nhật kinh nghiệm.',
  years: (n: number) => `${n} năm huấn luyện`,
  bioTitle: 'Giới thiệu',
  noBio: 'Huấn luyện viên chưa cập nhật phần giới thiệu.',
  reviewsTitle: 'Đánh giá của học viên',
  reviewNotEligible: 'Bạn có thể viết đánh giá sau khi đã tham gia ít nhất một buổi của lớp này do huấn luyện viên dạy.',
} as const;

/** Thẻ "Bộ môn được phép giảng dạy" ở hồ sơ của HLV (do quản lý phân công, HLV chỉ xem) */
export const COACH_SPECIALIZATION_TEXT = {
  title: 'Bộ môn được phép giảng dạy',
  /** Bộ môn đã được phân công nhưng không còn trong danh mục bộ môn */
  unknownSport: 'Bộ môn chưa xác định',
  empty: 'Chưa được phân công bộ môn.',
  contactManager: 'Liên hệ quản lý khi cần cập nhật chuyên môn hoặc bộ môn giảng dạy.',
  separator: ' · ',
} as const;
