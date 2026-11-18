// constants/trainingPlans.ts
// Giáo án tập luyện của HLV cho một lớp (web: shared/TrainingPlans): giới hạn độ dài khớp BE và chữ hiển thị

/** Giới hạn BE (training-plans.routes: planText + suggest) */
export const TRAINING_PLAN_LIMITS = {
  titleMin: 2,
  titleMax: 120,
  instructionsMin: 3,
  instructionsMax: 6000,
  homeworkMax: 3000,
  objectiveMax: 300,
} as const;

/** Danh sách "Giao cho" cao tối đa chừng này (px) rồi cuộn riêng — lớp đông học viên không làm bảng dài vô tận */
export const TRAINING_PLAN_MEMBER_LIST_MAX_HEIGHT = 208;

export const TRAINING_PLAN_TEXT = {
  title: 'Giáo án tập luyện',
  create: 'Tạo giáo án',
  edit: 'Sửa giáo án',
  empty: 'Chưa có giáo án được giao.',
  wholeClass: 'Giáo án cả lớp',
  personal: 'Giáo án cá nhân',
  coach: (name: string) => `HLV ${name}`,
  homework: 'Bài tập về nhà',

  createTitle: 'Tạo giáo án',
  editTitle: 'Sửa giáo án',
  assignTo: 'Giao cho',
  wholeClassOption: 'Cả lớp',
  titleLabel: 'Tiêu đề',
  titleTooShort: `Tiêu đề cần ít nhất ${TRAINING_PLAN_LIMITS.titleMin} ký tự.`,
  objectiveLabel: 'Mục tiêu để AI gợi ý (tùy chọn)',
  suggest: 'Tạo bản nháp bằng AI',
  suggesting: 'Đang tạo bản nháp…',
  suggested: 'Bản nháp đã được điền vào nội dung. Hãy rà soát trước khi giao.',
  suggestEmpty: 'AI chưa trả về bản nháp. Bạn thử lại hoặc tự viết nội dung nhé.',
  instructionsLabel: 'Nội dung giáo án',
  instructionsTooShort: `Nội dung cần ít nhất ${TRAINING_PLAN_LIMITS.instructionsMin} ký tự.`,
  homeworkLabel: 'Bài tập về nhà (tùy chọn)',
  counter: (length: number, max: number) => `${length}/${max}`,
  cancel: 'Hủy',
  assign: 'Giao giáo án',
  save: 'Lưu giáo án',
  saving: 'Đang lưu…',
  assignedTo: (target: string) => `Đã giao giáo án cho ${target}.`,
  assignedWholeClass: 'cả lớp',
  saved: 'Đã lưu giáo án.',
  savedTitle: 'Giáo án',
  saveFailed: 'Không lưu được giáo án. Vui lòng thử lại.',
  suggestFailed: 'Không tạo được bản nháp. Vui lòng thử lại.',
} as const;
