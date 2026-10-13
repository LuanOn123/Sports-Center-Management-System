# Khôi phục đăng nhập giống web — 13/10/2026

Mobile dùng API đang triển khai trên Render: `POST /api/v1/auth/login`.

Payload: `email` (trim và chữ thường), `password`, `turnstileToken` với action `login`.

- Khôi phục Cloudflare Turnstile với public Site Key giống web.
- Chỉ bật đăng nhập khi CAPTCHA hợp lệ; lỗi/hết hạn xóa token, có nút thử lại.
- Sau mỗi lần gửi, thay widget để lấy token mới, vì token dùng một lần.
- Public login không gửi Bearer token hoặc facility header của phiên cũ.
- Giữ bước tải `/auth/me`, kiểm tra member/coach, chọn cơ sở và khôi phục phiên hiện có.
- Gỡ endpoint `/auth/mobile-login` đã thêm ở lần trước trong cả hai bản mã backend. Web/backend trở về mã xác thực ban đầu.
- Bản web mobile dùng widget trực tiếp; Android/iOS dùng WebView với origin đã cấu hình.

Chạy lại Expo nếu đang dùng tiến trình cũ: `npx expo start --clear`.

Luồng này không phụ thuộc deploy backend mới. Chưa có tài khoản thật dành cho kiểm thử; kiểm tra gửi tài khoản không tồn tại chỉ xác nhận CAPTCHA và route hoạt động, không xác nhận đăng nhập thành công bằng tài khoản thật.

## Kết quả kiểm tra

- `npm test`: 11/11 ca đạt; kiểm tra đúng `/api/v1/auth/login`, payload đủ CAPTCHA và không gửi thông tin phiên cũ.
- TypeScript mobile và backend: đạt.
- Expo export web/Android/iOS: đạt tại `.expo/captcha-restored`.
- Kiểm tra trực tiếp UI tại `http://localhost:8084/auth/login`: Cloudflare trả “Đã xác minh bảo mật”, nút đăng nhập bật.
- Gửi tài khoản không tồn tại qua giao diện đến backend Render: nhận “Email hoặc mật khẩu không đúng.” Backend đã đi qua bước xác minh CAPTCHA và xử lý email/mật khẩu; không còn phản hồi “Route not found”.
- Token sau lần gửi được thay mới và widget tự xác minh lại.
