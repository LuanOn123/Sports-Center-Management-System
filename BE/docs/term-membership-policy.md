# Quyền học trọn kỳ khi gói còn ít nhất 50%

Tại thời điểm đăng ký, gói phải ACTIVE và `(endDate - now) / (endDate - startDate) >= 0.5`. Dùng ngày bắt đầu/kết thúc của subscription đã mua, không dùng thời lượng plan có thể đã bị chỉnh sửa và không làm tròn ngày. Đúng 50% được chấp nhận.

- Giữ luật cũ khi gói đã phủ hết các buổi: không bắt một khóa ngắn phải có 50% thời hạn gói.
- Ngoại lệ vượt hạn gói chỉ áp dụng đăng ký trọn lớp trong một học kỳ, trong thời gian kỳ mở đăng ký. Không áp dụng tự động cho đặt buổi lẻ, lớp không có kỳ, kỳ khác hoặc lớp khác.
- Giữ nguyên kiểm tra Premium, quota, sức chứa, trùng lịch, hình phạt, trạng thái tài khoản và thời gian mở cổng.
- Lưu snapshot `Enrollment.termMembershipGrant` trong cùng transaction tạo đăng ký. Không sửa `MembershipSubscription.endDate` hoặc kéo dài gói tập.
- Quyền theo buổi đã đăng ký vẫn dùng được sau khi gói hết hạn: điểm danh QR/mã dự phòng, chuyên cần lễ tân, thống kê và đổi buổi cùng lớp/kỳ. Đổi buổi không chuyển quyền sang kỳ khác hoặc vượt hạn kỳ đã duyệt.
- Vào cơ sở bằng quyền học chỉ được tại cơ sở của buổi đã đặt và trong cửa sổ điểm danh hiện hành. Không tạo quyền sử dụng phòng tập tự do sau hạn gói.
- Đăng ký bị hủy, hủy lịch, xử lý kỷ luật và hủy/hoàn tiền gói vẫn theo luồng hiện tại. Đặt lại thông thường không giữ snapshot đã hủy.
- Dữ liệu cũ không được tự cấp ngoại lệ. Các snapshot mới chỉ được BE tạo sau khi kiểm tra điều kiện.

## Triển khai

Thay đổi có migration thêm một cột JSONB nullable, không cập nhật dữ liệu hội viên cũ. Áp dụng migration trước khi chạy phiên bản BE mới:

```sh
cd BE
npm run db:deploy
npm run build
npm run test:term-membership
```

Theo phạm vi bàn giao, migration được chuẩn bị để nhóm backend deploy; chưa áp dụng lên database từ tác vụ này. Bên deploy cần cấu hình `DATABASE_URL` và `DIRECT_DATABASE_URL` hợp lệ, chạy migration trước khi khởi động BE mới. Test nghiệp vụ dùng delegates cô lập, không ghi database thật.

`GET /classes/:id/course-plan` bổ sung `registration.membershipCoverage` (nullable): `policy`, `qualifiedAt`, `validUntil`, `subscriptionEndDate`. FE dùng preview này và gửi `POST /enrollments/bulk` như cũ; không tự bỏ blocker do BE trả về.
