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
} as const;
