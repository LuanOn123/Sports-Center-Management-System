# Đối chiếu mobile với web — 12/10/2026

Nguồn tham chiếu: `C:\WDP\WEB\Sports-Center-Management-System\FE` và hợp đồng triển khai trong `BE/src/modules`.

## Trạng thái hiện tại — 13/10/2026

Theo yêu cầu mới nhất, mobile đã quay lại `/auth/login` với Cloudflare như web. Đã khôi phục widget và public Site Key, bỏ việc gọi `/auth/mobile-login`, và gỡ các thay đổi backend của endpoint không CAPTCHA. Không cần deploy backend mới cho luồng đăng nhập này. Xem `MOBILE_LOGIN_RESTORED_2026-10-13.md`.

## Lịch sử ngày 12/10: mobile không dùng Cloudflare (đã thay thế)

Theo yêu cầu tiếp theo của người dùng, đã bỏ widget, token CAPTCHA, cấu hình Site Key/origin và dependency WebView khỏi mobile. Mobile gọi `POST /auth/mobile-login` với email/mật khẩu. Endpoint được thêm vào cả `C:\WDP\Sports-Center-Management-System\BE` và `C:\WDP\WEB\Sports-Center-Management-System\BE`, chỉ cấp token cho MEMBER/COACH sau khi xác thực mật khẩu và trạng thái tài khoản. Web tiếp tục dùng `/auth/login` có CAPTCHA.

Cần triển khai backend mới lên Render để endpoint mới hoạt động. Những ghi nhận CAPTCHA dưới đây là lịch sử của đợt kiểm tra ban đầu, không còn mô tả UI mobile hiện tại.

Kiểm chứng cập nhật: 11 kiểm thử mobile đạt; 30 kiểm thử xác thực backend đạt, gồm member/coach đăng nhập không có cấu hình Cloudflare, role nhân sự bị chặn, mật khẩu sai/tài khoản khóa bị từ chối, và đăng nhập web vẫn yêu cầu CAPTCHA. TypeScript mobile/backend và export web đạt. UI tại cổng 8082 đã kiểm tra không còn widget Cloudflare.

## Lỗi đăng nhập trong đợt kiểm tra ban đầu

- Web/backend yêu cầu `turnstileToken` với action `login` trong `POST /auth/login`; mobile cũ chỉ gửi email/mật khẩu.
- `.env` mobile cũ không có public Site Key; đã bổ sung key cùng widget của web và origin cho WebView.
- Widget web đã tải và hiển thị “Đã xác minh bảo mật” tại `http://localhost:8082/auth/login`.
- Mỗi lần gửi đăng nhập đều hủy token đã sử dụng và tạo lượt xác minh mới. Token hết hạn/lỗi sẽ vô hiệu hóa nút đăng nhập.
- Đăng ký thành công quay về đăng nhập thay vì tự gọi login thiếu CAPTCHA.
- Khởi động lại Expo để nạp cấu hình: `npx expo start --clear`. Tiến trình cũ tại 8081 chưa nạp các biến mới; phiên kiểm tra đã khởi động tại 8082.
- Kiểm tra kết nối tới Render từ Node và trình duyệt bị timeout. Đây là giới hạn xác nhận đăng nhập thật; không kết luận mọi lỗi đăng nhập đều đã hết.

## Đối chiếu chức năng

| Vai trò / chức năng web | Mobile sau thay đổi | API / logic chính |
| --- | --- | --- |
| Member — tổng quan | Giữ thông tin gói, buổi sắp tới, bổ sung truy cập nhanh các chức năng | Gói và lịch sử đăng ký của chính member |
| Member — khám phá lớp | Tải đủ các trang, lọc tìm kiếm/bộ môn/hạng | `/classes`, `/sports` |
| Member — chi tiết lớp / trọn khóa | Kế hoạch khóa học, các buổi, chỗ trống, trùng lịch, blockers, điều kiện đăng ký | `/classes/:id/course-plan`, `/enrollments/bulk`; đọc đúng `summary` mới |
| Member — lớp của tôi / lịch / đổi buổi | Giữ các hành động, tải đầy đủ lịch sử và lựa chọn đổi buổi | `/enrollments/my`, `DELETE /enrollments/:id`, `/enrollments/:id/transfer` |
| Member — gói thành viên / VietQR | Chặn mua hạ hạng hoặc rút ngắn cùng hạng; hoàn tiền dựa giá snapshot; xem thêm lịch sử | `/subscriptions/member/:id`, `/payments/sepay/*`; backend quyết định kích hoạt/hoàn tiền |
| Member — thanh toán và hóa đơn | Thêm danh sách hóa đơn, chi tiết hóa đơn/thanh toán, in hoặc lưu/chia sẻ PDF | `/invoices/member/:id`, `/invoices/:id`, `/payments/:id` |
| Member — chuyên cần | QR/mã dự phòng; cập nhật NORMAL/NOTICE/WARNING, FIXED/RECURRING, giới hạn vắng và khiếu nại | `/attendance/my`, `/attendance/my/summary`, `/attendance/scan-qr` |
| Member — check-in cơ sở | Thêm check-in tại cơ sở chọn và lịch sử trên các cơ sở | `/facility-visits/check-in`, `/facility-visits/my`; dedupe do backend xử lý |
| Member — danh sách chờ | Vào chờ khi buổi đầy, xem thứ tự, rời chờ, làm mới lịch/quota khi được xếp chỗ | `/waitlist`, `/waitlist/my`, `DELETE /waitlist/:id` |
| Member — yêu cầu hỗ trợ | Tạo yêu cầu, xem trạng thái/phản hồi, xóa yêu cầu OPEN thông thường | `/issues`; báo cáo chuyên cần không có nút xóa |
| Coach — tổng quan | Lớp phụ trách, buổi sắp tới, thống kê tuần, hoàn thành/đã lên lịch/hủy, nhịp dạy và số buổi theo lớp | Chỉ tải lịch các lớp được phân công |
| Coach — lớp và lịch dạy | Tải đủ các trang kể cả lớp phụ trách ngừng hoạt động; tuần/lọc trạng thái | `/classes?coachId`, `/class-schedules?classId` |
| Coach — học viên / điểm danh | Thêm xem hồ sơ học viên; lỗi dữ liệu có trạng thái thử lại | `/enrollments/schedule/:id`, `/members/:id`, `/attendance` |
| Coach — xin nghỉ phép | Thêm gửi đơn, xem trạng thái và lý do xét duyệt | `/leave-requests`; nhập giờ Việt Nam, kiểm tra ngày hợp lệ và khoảng thời gian |
| Coach — đánh giá của hội viên | Trang đọc đánh giá và điểm trung bình có phân trang | `/feedbacks?coachId` |
| Coach — hồ sơ | Thêm các bộ môn được phép dạy; giữ chuyên môn/kinh nghiệm dưới dạng chỉ đọc | `/coaches/:id/specializations`, `/sports`; thay đổi phân công qua quản lý |
| Chung — hồ sơ / mật khẩu | Họ tên, điện thoại, giới tính, ngày sinh; member có mục tiêu/trình độ/thời gian tập | `/auth/me`, `/auth/me/change-password`; đăng xuất khi đổi mật khẩu |
| Chung — thông báo | Tải đủ lịch sử, đọc và đánh dấu đã đọc | `/notifications*` |
| Chung — chat | Gửi văn bản/ảnh/PDF, tải tệp có xác thực, xem ảnh, báo lỗi gửi và giữ bản nháp | `/chat/messages`, `/chat/attachments/:id`; 10 MB, định dạng giống web |
| Chung — trợ lý AI | Thêm trò chuyện với lịch sử, hủy request khi đóng, tách lịch sử khi đổi user/cơ sở | `/ai/chat` |

## Phiên đăng nhập và UI

- Stack/Tabs bảo vệ màn hình theo đăng nhập và role, tránh coach gọi API member và ngược lại.
- Refresh đồng thời dùng một request; từ chối refresh sẽ xóa phiên và báo AuthContext. Refresh trả muộn sau logout không được phục hồi token cũ.
- Public login không mang Bearer token của tài khoản cũ. Token socket được lấy lại khi reconnect.
- Chọn cơ sở hợp lệ, hủy query trước khi đổi, làm mới cache; chặn đổi cơ sở khi đang có mutation để tránh thao tác nhầm cơ sở.
- GMT+7 áp dụng cho hiển thị ngày giờ và giới hạn ngày/tuần, không phụ thuộc múi giờ thiết bị.
- Theme đồng bộ với `FE/src/shared/portal-theme.css`: nền `#0B1018`, surface `#131A26`, border `#263143`, text `#F1F4F9`, muted `#9BAAC0`, accent `#D4FF00`, màu trạng thái tương ứng. Giữ logo, hệ font tiếng Việt và bố cục mobile; form đăng nhập có độ rộng tối đa phù hợp trên desktop.

## Kiểm chứng và giới hạn

- `npm run typecheck`: đạt.
- `npm test`: 11 kiểm thử hồi quy đạt; sử dụng HTTP fixture cục bộ với Axios/interceptor thực, không dùng database production. Có kiểm tra retry giữ nguyên cơ sở ban đầu và dừng phân trang khi đổi cơ sở.
- Expo export web/Android/iOS: đã đạt; đây là kiểm tra đóng gói, không phải kiểm thử thiết bị thật.
- UI đăng nhập web đã kiểm tra trực tiếp; CAPTCHA xác minh thành công. Chưa có tài khoản member/coach kiểm thử được cung cấp và backend Render timeout, nên chưa xác nhận E2E các luồng sau đăng nhập với dữ liệu thật.
- Phiên UI dùng API giả lập bị bộ phê duyệt tự động chặn khi khởi chạy, lý do công cụ trả về “blocked by policy”. Fixture tạm đã dọn; kiểm thử hợp đồng API vẫn chạy được.
- Android/iOS dùng WebView có cấu hình hostname; cần kiểm tra trên thiết bị thật trước khi phát hành.

Khi backend truy cập lại được, cần nghiệm thu bằng một member và một coach: đăng nhập/khởi động lại/đăng xuất; chọn cơ sở; đăng ký/hủy/đổi buổi; trọn khóa có blocker; buổi đầy và hàng chờ; quét QR; thanh toán/đối soát/PDF; hỗ trợ; nghỉ phép; hồ sơ học viên; gửi/tải ảnh và PDF trong chat. Không thực hiện giao dịch tiền thật trong quá trình kiểm thử nếu chưa được người dùng yêu cầu cụ thể.
