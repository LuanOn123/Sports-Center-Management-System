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

/**
 * Đường dẫn https làm "quay lại" gửi cho VietQR (tham số url) — BẮT BUỘC: thiếu url thì dl.vietqr.io chỉ mở app ngân hàng trống, không kèm số tiền
 * và nội dung (kể cả app có cờ autofill). Nên là trang web của hệ thống hoặc app link đưa người dùng về app; để trống thì dùng địa chỉ gốc của API
 * (lib/vietqr › resolvePaymentReturnUrl). Scheme riêng của app (pulsecenter://…) không dùng được.
 */
export const PAYMENT_RETURN_URL_ENV = process.env.EXPO_PUBLIC_PAYMENT_RETURN_URL;

/** Chữ của luồng mở app ngân hàng: bảng chọn app + hộp thoại hướng dẫn hiện trước khi rời app (lib/bankAppLaunch) */
export const BANK_APP_TEXT = {
  pickerTitle: 'Chọn app ngân hàng',
  pickerHintAutofill: 'App có nhãn "Tự điền" mở sẵn số tiền và nội dung — bạn chỉ cần đăng nhập và xác nhận.',
  pickerHintScan: 'App khác: mình lưu sẵn mã QR và sao chép nội dung chuyển khoản; trong app chọn Quét QR → Chọn ảnh.',
  preparing: 'Đang lưu mã QR…',
  badgeAutofill: 'Tự điền',
  badgeScan: 'Quét QR',
  cannotOpenTitle: 'Không mở được app',
  cannotOpen: (appName: string) => `Máy chưa cài ${appName} hoặc app không hỗ trợ mở nhanh.`,
  open: (appName: string) => `Mở ${appName}`,
  openAnyway: 'Vẫn mở app',
  savedTitle: 'Đã lưu mã QR',
  saved: (appName: string) => `Trong ${appName} chọn Quét QR → Chọn ảnh vừa lưu. Nội dung chuyển khoản cũng đã được sao chép.`,
  notSavedTitle: 'Chưa lưu được mã QR',
  /** Lý do chưa lưu được ảnh (theo SaveImageResult của lib/device) */
  notSaved: {
    unavailable: 'Bản app hiện tại chưa hỗ trợ lưu ảnh.',
    denied: 'Pulse chưa có quyền lưu ảnh — cho phép trong Cài đặt để lưu mã QR.',
    failed: 'Có lỗi khi lưu ảnh.',
    opened: 'Ảnh mã QR đã mở ở tab mới — hãy lưu ảnh rồi quét trong app ngân hàng.',
  },
  manualNote: 'Nội dung chuyển khoản đã được sao chép — bạn có thể nhập tay số tài khoản và số tiền.',
} as const;

/** Thông báo sau khi bấm nút "Lưu mã QR" (không mở app) */
export const QR_SAVE_TEXT = {
  saved: { title: 'Đã lưu mã QR', message: 'Mở app ngân hàng → Quét QR → chọn ảnh vừa lưu trong thư viện.' },
  unavailable: { title: 'Cần cập nhật ứng dụng', message: 'Bản app hiện tại chưa hỗ trợ lưu ảnh. Vui lòng cập nhật app, hoặc dùng nút sao chép thông tin chuyển khoản.' },
  denied: { title: 'Chưa có quyền lưu ảnh', message: 'Hãy cho phép Pulse lưu ảnh trong Cài đặt, hoặc dùng nút sao chép thông tin chuyển khoản.' },
  failed: { title: 'Không lưu được mã QR', message: 'Vui lòng thử lại hoặc chuyển khoản thủ công theo thông tin bên dưới.' },
} as const;
