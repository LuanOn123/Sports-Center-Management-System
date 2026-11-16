// constants/filters.ts
// Chữ dùng chung của mọi bảng "Bộ lọc" (Khám phá lớp, Lịch dạy của HLV): nút mở bảng, chip gỡ nhanh, chân bảng.
// Mỗi màn trải FILTER_TEXT vào bộ chữ riêng của mình (tên nhóm lọc, câu chữ số kết quả) — xem CLASS_FILTER_TEXT, SCHEDULE_FILTER_TEXT.

export const FILTER_TEXT = {
  button: 'Bộ lọc',
  all: 'Tất cả',
  done: 'Xong',
  clear: 'Xóa bộ lọc',
  remove: (label: string) => `Bỏ lọc ${label}`,
  active: (count: number) => `${count} bộ lọc đang bật`,
} as const;
