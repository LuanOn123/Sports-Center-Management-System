// constants/facility.ts
// Dữ liệu thuộc cơ sở khác cơ sở đang chọn (BE trả 403 FORBIDDEN_SCOPE) — mã lỗi và câu chữ giải thích cho hội viên / HLV.
// BE gắn lớp, buổi học, gói, điểm danh theo cơ sở (header X-Facility-Id); thông báo "Lớp học mới" lại gửi cho mọi hội viên
// mà không kèm cơ sở, nên bấm thông báo có thể dẫn tới lớp của cơ sở khác.

/** Mã BE (message của AppError) khi bản ghi không thuộc cơ sở trong header X-Facility-Id */
export const WRONG_FACILITY_CODE = 'FORBIDDEN_SCOPE';

export type ScopedSubject = 'lớp học' | 'buổi học';

export const WRONG_FACILITY_TEXT = {
  title: 'Thuộc cơ sở khác',
  switchTo: (name: string) => `Chuyển sang ${name}`,
  back: 'Quay lại',
} as const;
