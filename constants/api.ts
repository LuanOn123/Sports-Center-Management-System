// constants/api.ts
// Chuỗi BE dùng để báo lỗi mà lớp gọi API (lib/api.ts) phải xử lý riêng

/** message BE đặt khi body/query không qua kiểm tra (zod); chi tiết nằm ở errors[{ field, message }] */
export const VALIDATION_FAILED_MESSAGE = 'Validation failed';

/** Hiện khi BE báo dữ liệu không hợp lệ mà không kèm câu giải thích nào */
export const VALIDATION_FALLBACK_MESSAGE = 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.';
