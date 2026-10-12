// constants/payment.ts
// Cấu hình thanh toán SePay (VietQR) — khớp FE web (shared/SepayCheckout.tsx)

/** Chu kỳ hỏi lại trạng thái đơn khi còn PENDING */
export const SEPAY_POLL_INTERVAL_MS = 4000;

/** Kích thước ảnh VietQR hiển thị */
export const SEPAY_QR_SIZE = 240;

/** Nút "DEV: giả lập SePay đã thu tiền" — chỉ bản dev và khi bật EXPO_PUBLIC_SEPAY_MOCK_MODE (BE cần SEPAY_MOCK_MODE=true) */
export const SEPAY_MOCK_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_SEPAY_MOCK_MODE === 'true';

// ─── Mở app ngân hàng (VietQR deeplink — dịch vụ công khai của VietQR, không qua BE) ─

/** API công khai của VietQR: danh sách app ngân hàng hỗ trợ deeplink + danh sách mã ngân hàng */
export const VIETQR_API_BASE = 'https://api.vietqr.io/v2';

/** Danh sách app/ngân hàng ít thay đổi — cache 1 ngày */
export const VIETQR_DIRECTORY_STALE_MS = 24 * 60 * 60 * 1000;

/** Tiền tố tên file khi lưu ảnh QR vào thư viện ảnh */
export const QR_IMAGE_FILE_PREFIX = 'pulse-vietqr';
