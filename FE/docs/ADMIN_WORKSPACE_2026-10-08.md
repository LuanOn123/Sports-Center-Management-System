# Cập nhật quản trị và vận hành — 08/10/2026

## Giao diện và phân quyền

- Admin quản lý thông tin cơ sở và phân công MANAGER trong cùng màn hình Cơ sở. Form cơ sở không hiển thị/gửi múi giờ; backend dùng mặc định Asia/Ho_Chi_Minh khi tạo.
- Danh sách phân công chỉ gồm MANAGER đang hoạt động, chưa có phân công MANAGER đang hiệu lực ở bất kỳ cơ sở nào. Có thể tạo tài khoản MANAGER ngay trong luồng phân công.
- Thêm/thay quản lý dùng `PUT /facilities/{facilityId}/manager`. Thay quản lý là một transaction; chỉ gỡ người cũ nếu toàn bộ thay thế thành công. Backend dùng advisory lock theo user để tránh gán đồng thời vào nhiều cơ sở; phát hiện phân công cũ đã thay đổi trả 409.
- Người dùng gộp quản lý tài khoản và hồ sơ hội viên. Lọc vai trò MEMBER, mở chi tiết → Gói & tập luyện để xem/chỉnh sửa hồ sơ và xem gói hiện tại. URL cũ `/admin/members` chuyển về Người dùng với bộ lọc MEMBER.
- Admin không có mục huấn luyện viên, điều kiện giảng dạy, khung giờ, sinh lịch định kỳ hoặc bán gói tại quầy. Manager quản lý hồ sơ/chuyên môn và phân công huấn luyện viên. Bán gói tại quầy chỉ dành cho RECEPTIONIST, có chặn phía backend.
- Admin chỉ xem lịch hoạt động, danh sách đăng ký, điểm danh và danh sách chờ. Backend chặn ghi ClassSchedule từ ADMIN, kể cả thao tác qua các chức năng gián tiếp. Các API tạo/sửa/hủy/hoàn tất lịch chỉ dành cho MANAGER; lễ tân xem lịch và xử lý đăng ký, không còn mục Tạo lịch nhanh.

## Lớp học và đăng ký

- Chọn nhiều bộ môn bằng tìm kiếm/checkbox và thẻ đã chọn. Chỉ hiển thị phòng đang hoạt động có loại khu vực được tất cả bộ môn đã chọn hỗ trợ.
- Mỗi phòng hiển thị tên, loại khu vực, sức chứa. Phòng lưu vào `Class.defaultRoomId`; loại khu vực lớp suy ra từ phòng. Sĩ số không vượt sức chứa phòng và giới hạn lớp 200.
- Backend kiểm tra phòng thuộc cơ sở hiện tại, đang hoạt động, cùng loại khu vực và đủ sức chứa. Trường defaultRoomId là tùy chọn để tương thích lớp cũ/API cũ; form FE yêu cầu chọn phòng khi lưu.
- Admin chi tiết lớp → Khóa học & đăng ký: số hội viên duy nhất, lượt đăng ký BOOKED/COMPLETED, danh sách người đăng ký và toàn bộ buổi học (gồm lịch cũ/đã hủy). API `GET /classes/{id}/registrations`.

## Tổng quan và nhật ký

- `GET /reports/facilities?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`: chỉ ADMIN, đọc toàn hệ thống, không bị giới hạn bởi cơ sở đang chọn. Khoảng ngày dùng giờ Việt Nam.
- Doanh thu: các khoản đã thu theo paidAt trong kỳ, trừ khoản hoàn theo refundedAt trong kỳ. Có thể âm nếu kỳ đó hoàn nhiều hơn thu.
- Hội viên theo cơ sở: hội viên đang hoạt động, đã mua gói khác FREE tại cơ sở đó, mọi thời điểm. Một hội viên có thể xuất hiện ở nhiều cơ sở; tổng toàn hệ thống đếm duy nhất.
- Lượt đăng ký: theo bookedAt trong kỳ, không tính CANCELLED. Buổi học: theo startTime trong kỳ.
- Nhật ký trình bày người thực hiện, cơ sở, hoạt động, tên hội viên/lớp/phòng và thời điểm buổi học. Bộ lọc cơ sở dùng `filterFacilityId` để không xung đột header X-Facility-Id. Enrollment được ghi audit từ lúc triển khai; không tự tạo lại nhật ký đăng ký trong quá khứ.

## Triển khai backend

Migration mới: `BE/prisma/migrations/20261012000000_class_default_room/migration.sql`, thêm cột nullable và khóa ngoại phòng mặc định; dữ liệu lớp cũ được giữ.

Sau khi cấu hình DATABASE_URL tại backend, chạy trong thư mục BE:

```powershell
npm run db:deploy
npm run db:generate
npm run build
```

Sau đó khởi động lại/triển khai BE và FE cùng phiên bản. Môi trường Codex hiện thiếu DATABASE_URL nên chưa áp dụng migration và chưa kiểm thử database thật. Kiểm tra hành vi bằng unit tests và browser tests dùng API fixtures; hợp đồng FE được sinh từ Swagger backend trong repo.

## Kết quả kiểm tra

- FE typecheck/build: đạt; BE TypeScript: đạt; git diff --check: đạt.
- Unit tests: 67/67, gồm 8 kiểm tra service/guard backend với database được mock.
- Hợp đồng API: FE 163 / BE 163, không thiếu endpoint.
- Browser suite toàn bộ: 176/179 đạt ở lượt đầu. Đã sửa bảng cuộn trên mobile và cập nhật hai fixture/kỳ vọng theo API chuyên cần và quyền lễ tân hiện tại. Chạy lại toàn bộ admin-redesign + workflow: 17/17 đạt, gồm cả 3 bài trước đó lỗi.
- Các màn hình admin mới được kiểm tra accessibility và không tràn ngang ở 375px/1440px.
