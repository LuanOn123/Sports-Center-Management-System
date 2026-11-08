// constants/goals.ts
// Mục tiêu & tiến độ khóa học (GoalTarget). Giới hạn khớp BE (enrollments.schema, attendance.schema); ngưỡng, màu và câu chữ
// khớp web (shared/Attendance.tsx getProgressTheme, pages/member/ClassDetailPage.tsx, components/member/EnrollConfirmModal.tsx).
// BE là nơi lưu mục tiêu và tính tiến độ; mobile chỉ hiển thị và gửi đánh giá.

import { Colors } from './theme';

/** Mục tiêu hội viên nhập khi đăng ký lớp (BE: tối đa 500 ký tự) */
export const GOAL_MAX_LENGTH = 500;
/** Lời dặn của HLV trong một lần đánh giá (BE: tối đa 1000 ký tự) */
export const EVALUATION_NOTE_MAX_LENGTH = 1000;
/** Ghi chú sức khỏe khi đăng ký lớp (BE: tối đa 1000 ký tự) */
export const HEALTH_NOTES_MAX_LENGTH = 1000;
/** Bộ đếm ký tự ghi chú sức khỏe đổi màu cảnh báo từ mốc này (web: 950) */
export const HEALTH_NOTES_WARN_LENGTH = 950;

/** Tiến độ là phần trăm nguyên 0–100; HLV chỉnh theo bước 5 (web: thanh trượt step 5) */
export const PROGRESS_MIN = 0;
export const PROGRESS_MAX = 100;
export const PROGRESS_STEP = 5;
/** Mốc chọn nhanh trong sheet đánh giá */
export const PROGRESS_PRESETS: readonly number[] = [0, 25, 50, 75, 100];

export interface ProgressLevel {
  key: 'low' | 'mid' | 'high';
  /** Tiến độ nhỏ hơn mốc này (không tính mốc) thì thuộc mức */
  below: number;
  label: string;
  /** Chú thích dưới thanh tiến độ */
  legend: string;
  color: string;
}

/** Ba mức theo web: dưới 20% cần nỗ lực, 20–69% đang tiến bộ, từ 70% tốt */
export const PROGRESS_LEVELS: readonly ProgressLevel[] = [
  { key: 'low', below: 20, label: 'Cần nỗ lực (<20%)', legend: '0% (Cần nỗ lực <20%)', color: Colors.status.failed },
  { key: 'mid', below: 70, label: 'Đang tiến bộ (20–69%)', legend: '50% (Đang tiến bộ <70%)', color: Colors.status.pending },
  { key: 'high', below: Number.POSITIVE_INFINITY, label: 'Tiến độ tốt (≥70%)', legend: '100% (Đạt mục tiêu ≥70%)', color: Colors.status.success },
];

/** Mục tiêu BE hiển thị khi học viên chưa có mục tiêu riêng (goal-evaluation.service.ts) */
export const DEFAULT_GOAL_LABEL = 'Hoàn thành khóa học';

export const GOAL_TEXT = {
  // ── Sheet đăng ký trọn khóa (web: EnrollConfirmModal) ──
  enrollTitle: 'Xác nhận đăng ký & Lưu ý thể trạng',
  enrollConfirm: 'Xác nhận đăng ký trọn khóa',
  enrollBusy: 'Đang xử lý…',
  enrollAllOrNothing: 'Đăng ký áp dụng cho tất cả các buổi sắp tới của khóa hoặc không buổi nào.',
  cancel: 'Hủy',
  goalLabel: 'Mục tiêu của bạn trong khóa học này',
  optional: '(Tùy chọn)',
  goalPlaceholder: 'Ví dụ: Bơi ếch liên tục 50m, giữ thăng bằng 30s, nâng tạ 50kg...',
  goalHint: 'Bạn có thể tự ghi mục tiêu riêng cho lớp này, hoặc bấm nút ở trên để điền nhanh mục tiêu từ hồ sơ.',
  useProfileGoal: 'Dùng mục tiêu từ hồ sơ',
  usingProfileGoal: 'Đang dùng mục tiêu hồ sơ',
  profileGoalLine: (goal: string) => `Mục tiêu trong hồ sơ cá nhân: “${goal}”`,
  initialProgressLabel: 'Tiến độ mục tiêu ban đầu:',
  initialProgressValue: '0% (Bắt đầu)',
  healthLabel: 'Bạn có chấn thương hoặc vấn đề sức khỏe cần HLV lưu ý không?',
  healthPlaceholder: 'Ví dụ: Đau cổ chân trái, gãy tay vừa lành xương, huyết áp cao, hen suyễn, không gập người được sâu...',
  healthCounter: (length: number) => `${length}/${HEALTH_NOTES_MAX_LENGTH} ký tự`,
  saveToProfile: 'Lưu thông tin này vào hồ sơ sức khỏe cá nhân của tôi',
  summarySessions: (count: number) => `${count} buổi`,
  summaryCoach: (name: string) => `HLV: ${name}`,
  summaryRoom: (name: string) => `Phòng: ${name}`,

  // ── Thẻ mục tiêu & tiến độ của hội viên (web: ClassDetailPage) ──
  cardTitle: 'Mục tiêu & Tiến độ khóa học của bạn',
  cardSubtitle: 'Theo dõi sự tiến bộ và nhận xét từ Huấn luyện viên sau mỗi buổi học',
  goalHeading: 'MỤC TIÊU KHÓA HỌC',
  fixedBadge: 'Mục tiêu cố định theo khóa',
  progressLabel: 'Tiến độ hoàn thành:',
  logTitle: 'Nhật ký đánh giá từ Huấn luyện viên',
  logEmpty: 'Chưa có buổi học nào được ghi nhận đánh giá. HLV sẽ đánh giá sự tiến bộ của bạn sau mỗi buổi học kết thúc!',
  coachLabel: 'HLV:',
  coachNote: 'Lời dặn của HLV:',
  evaluationProgress: (value: number) => `Tiến độ: ${value}%`,
  /** Thẻ ở chi tiết buổi học: đánh giá của HLV cho đúng buổi này */
  sessionEvaluationTitle: 'Đánh giá của HLV cho buổi này',

  // ── HLV: danh sách học viên, đánh giá, hồ sơ học viên (web: Attendance, CoachWorkspace) ──
  evaluateButton: 'Đánh giá',
  evaluateTitle: 'Đánh giá tiến độ',
  studentGoal: 'Mục tiêu học viên:',
  evaluateProgressLabel: 'Đánh giá tiến độ sau buổi dạy:',
  evaluateNoteLabel: 'Lời dặn / Ghi chú cho học viên:',
  evaluateNotePlaceholder: 'Nhập nhận xét lý do tăng/giảm tiến độ, lời dặn kỹ thuật động tác...',
  evaluateSave: 'Lưu đánh giá',
  evaluateSaving: 'Đang lưu…',
  evaluateFailed: 'Không lưu được đánh giá. Vui lòng thử lại.',
  evaluateLoadFailed: 'Chưa tải được mục tiêu của học viên. Kéo xuống để thử lại.',
  healthBadge: 'Y tế',
  healthTitle: 'Cảnh báo y tế / Lưu ý chấn thương:',
  searchPlaceholder: 'Tìm học viên theo tên hoặc email',
  searchNoResult: 'Không tìm thấy học viên phù hợp.',
  rosterCount: (shown: number, total: number) => `${shown} / ${total} học viên`,
  viewProfile: 'Xem hồ sơ học viên',
  learnerGoalHeading: 'Mục tiêu tập luyện',
  courseGoalHeading: 'Mục tiêu khóa học này',
} as const;
