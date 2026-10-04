# 🏋️‍♂️ Sports Center Management System (Hệ thống Quản lý Trung tâm Thể thao)

## 1. 📖 Giới thiệu chung
**Sports Center Management System** là một hệ thống phần mềm toàn diện giúp số hóa các hoạt động quản lý của một trung tâm thể thao/phòng Gym. 
Hệ thống kết nối 3 đối tượng chính: **Khách hàng (Hội viên)**, **Huấn luyện viên (Coach)** và **Quản trị viên (Admin)**. Nổi bật với tính năng thanh toán chuyển khoản tự động và trợ lý ảo AI thông minh.

---

## 2. 🛠 Công nghệ sử dụng (Backend)
- **Framework:** Node.js, Express.js, TypeScript.
- **Cơ sở dữ liệu:** PostgreSQL quản lý thông qua Prisma ORM.
- **Tích hợp AI:** Groq API (model `qwen/qwen3.8-27b`) cho tốc độ xử lý siêu tốc.
- **Thanh toán:** Tích hợp Webhook SePay (Tự động xác nhận giao dịch qua mã QR ngân hàng).
- **Lưu trữ file:** Cloudinary (Avatar, hình ảnh, đính kèm chat).
- **Gửi Email:** Brevo / Resend / Nodemailer (Gửi OTP, thông báo).
- **Tài liệu API:** Swagger UI.

---

## 3. 👥 Phân quyền & Các tính năng chính

### 👤 Khách vãng lai (Guest)
- Trò chuyện với **Smart Chatbot AI** ngay tại trang chủ để hỏi giá gói tập, lịch học, chính sách (AI đọc dữ liệu thật từ DB).
- Đăng ký tài khoản (xác thực email qua mã OTP).

### 🏋️ Hội viên (Member)
- **Quản lý hồ sơ:** Cập nhật thông tin thể trạng (chiều cao, cân nặng, mục tiêu, trình độ).
- **AI Personal Trainer:** Tự động sinh lịch tập và gợi ý dinh dưỡng 7 ngày dựa trên AI, lưu thành hồ sơ cá nhân với HLV ảo.
- **Đăng ký gói tập:** Xem các hạng gói (Standard, Premium...), thanh toán quét mã QR và hệ thống tự kích hoạt gói ngay khi nhận được tiền.
- **Lịch học (Classes):** Xem lịch học các môn (Yoga, Gym, Bơi lội...), đăng ký tham gia lớp.
- **Điểm danh:** Check-in lớp học thông qua mã điểm danh do HLV cung cấp.
- **Nhận thông báo:** Báo sắp hết hạn gói, báo giờ vào lớp.

### 🏃‍♂️ Huấn luyện viên (Coach)
- Quản lý hồ sơ chuyên môn và xem lịch dạy của mình.
- Xem danh sách học viên trong lớp, kiểm tra điểm danh.
- Viết đánh giá (Feedback) định kỳ cho sự tiến bộ của hội viên.

### 👑 Quản trị viên (Admin)
- Quản lý toàn diện: User, Gói tập, Môn thể thao (Sports), Phòng tập (Rooms).
- Xếp lịch học, phân công HLV.
- Quản lý tài chính: Xem báo cáo doanh thu, lịch sử hóa đơn, trạng thái thanh toán.

---

## 4. 🔄 Các luồng hoạt động cốt lõi (Core Workflows)

### Luồng 1: Mua gói tập & Tự động kích hoạt (SePay)
1. Hội viên chọn Gói tập (Membership Plan) -> Hệ thống tạo ra 1 `Invoice` trạng thái `PENDING`.
2. FE hiển thị mã QR thanh toán ngân hàng (chứa nội dung CK chuẩn của SePay).
3. Hội viên dùng app ngân hàng quét mã và chuyển khoản.
4. SePay nhận biến động số dư -> Bắn **Webhook** về `/api/v1/payments/sepay-webhook`.
5. Hệ thống xác thực chữ ký Webhook, tìm `Invoice` tương ứng -> Cập nhật trạng thái `PAID` -> Tự động tạo `Subscription` (kích hoạt gói tập) cho hội viên.

### Luồng 2: AI Personal Trainer (Trợ lý lên lịch tập)
1. Hội viên khai báo Profile (Mục tiêu: Tăng cơ giảm mỡ, Trình độ: Người mới...).
2. Bấm nút "Tạo lịch tập AI" -> FE gọi `POST /api/v1/ai/generate-training-plan`.
3. Backend gom dữ liệu Profile truyền cho **Groq AI (Qwen model)**.
4. AI trả về lịch trình chi tiết (chuẩn Markdown).
5. BE tự động tạo 1 Account hệ thống tên là "Trợ Lý AI" (Role: Coach) và gán vào `TrainingPlan` của hội viên.

### Luồng 3: Đăng ký lớp & Điểm danh
1. Admin tạo `Class` (VD: Yoga Cơ Bản) và gán `Coach`. Xếp `ClassSchedule` vào lúc 18h thứ 3-5-7 ở Phòng A.
2. Hội viên xem lịch -> Bấm `Enroll` (Đăng ký) lớp học.
3. Tới giờ học, HLV sinh ra 1 Mã điểm danh (Manual Code).
4. Hội viên nhập mã này trên App -> Hệ thống ghi nhận `Attendance` thành công.

### Luồng 4: Quên mật khẩu (Forgot Password)
1. User nhập Email cần khôi phục -> BE tạo mã OTP (Mã hoá SHA-256) lưu vào DB, hạn 10 phút.
2. Hệ thống gọi Brevo/Resend API gửi mail chứa OTP cho User.
3. User nhập OTP và Mật khẩu mới -> BE đối chiếu hash, đổi mật khẩu thành công.
