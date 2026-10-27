# Đổi huấn luyện viên theo buổi

Coach vào **Đổi HLV theo buổi**, chọn một buổi tương lai được phân công tại cơ sở hiện tại và ghi lý do. Mỗi coach chỉ có một yêu cầu PENDING cho một buổi. Quản lý cơ sở chọn HLV khác và ghi phản hồi để duyệt; hoặc từ chối. Admin chỉ theo dõi, theo phân quyền hiện tại admin không sửa lịch.

Buổi có `coachId` riêng thì chỉ HLV đó được gửi yêu cầu. Nếu buổi dùng phân công mặc định của lớp, chỉ HLV chính (hoặc HLV duy nhất) được gửi để tránh việc HLV hỗ trợ thay thế nhầm toàn bộ phân công chính của buổi.

Khi duyệt, hệ thống kiểm tra lại trạng thái, giờ học, phân công hiện tại, HLV thay thế thuộc cơ sở, chuyên môn, điều kiện phòng và xung đột lịch. Nếu buổi đã dời giờ hoặc đổi người dạy trong lúc chờ, không tự áp dụng yêu cầu cũ. Duyệt và cập nhật lịch dùng cùng transaction, khóa buổi học và giữ cơ chế kiểm tra của updateSchedule. Chỉ `ClassSchedule.coachId` của buổi được chọn được đổi; không sửa ClassMember của cả lớp hay thời gian/phòng học. Quyết định và thông báo được ghi atomic; gửi thông báo sau commit.

Luồng mới lưu `CoachChangeRequest`, không tạo `LeaveRequest`, không ghi khoảng ngày nghỉ, số ngày công hoặc dữ liệu tính lương/thưởng. Đơn nghỉ cũ giữ nguyên lịch sử và hiệu lực cũ; không tự suy diễn thành yêu cầu đổi HLV. URL `/coach/leave` chuyển đến trang mới; endpoint tạo đơn nghỉ cũ chỉ còn dành cho lễ tân. Xin nghỉ học của hội viên và nghỉ của lễ tân giữ nguyên.

## Cập nhật cơ sở dữ liệu

Trước khi chạy backend mới, cấu hình `DATABASE_URL` và `DIRECT_DATABASE_URL` đúng môi trường rồi chạy trong `BE/`:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
```

Migration `20261027080000_coach_change_requests` thêm bảng mới và ba loại thông báo; không chuyển đổi hoặc xóa đơn cũ. Có partial unique index để chặn hai yêu cầu PENDING trùng buổi/coach ở cấp DB. Chưa áp dụng migration lên cơ sở dữ liệu trong phiên triển khai mã nguồn này vì workspace chưa có cấu hình kết nối.

## Kiểm tra

`npm run test:coach-changes` (BE): service tests bằng delegates cô lập, không liên hệ DB thật. Kiểm tra gửi đúng một buổi, từ chối trùng/sai phân công/quá khứ, phạm vi cơ sở, trạng thái đã xử lý, lịch thay đổi, phân quyền và duyệt/từ chối.

`npx playwright test coach-changes.spec.ts` (FE): kiểm tra form coach, quyết định manager, dữ liệu gửi và chuyển hướng URL cũ. Các test dùng API giả lập; cần kiểm tra tích hợp trên môi trường có PostgreSQL sau khi áp dụng migration.
