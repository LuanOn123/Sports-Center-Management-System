# Theo dõi gói được dùng để đăng ký lớp

## Triển khai

Migration `20261028160000_enrollment_subscription_attribution` thêm cột nullable
`Enrollment.subscriptionId`, khóa ngoại đến `MembershipSubscription` và index.
Không xóa hay tự gán lại dữ liệu cũ.

Áp dụng migration cho môi trường backend cần triển khai trước khi khởi động bản mới:

```powershell
npm --prefix BE run db:deploy
npm --prefix BE run db:generate
```

## Ghi nhận

- Đặt buổi mới, đặt lại buổi đã hủy, chuyển buổi, lên chỗ từ danh sách chờ:
  lưu ID gói đang được bộ kiểm tra điều kiện sử dụng trong cùng transaction.
- Đăng ký trọn khóa: mỗi buổi mới hoặc được kích hoạt lại ghi cùng ID gói đã
  được kiểm tra cho khóa đó. Buổi đã đặt giữ nguyên gói lịch sử.
- Đổi/gia hạn gói sau đó không tự sửa liên kết của lượt đặt cũ.
- Dữ liệu cũ không có liên kết được hiển thị là chưa ghi nhận gói. Không suy đoán
  từ gói hiện tại, ngày mua hay các gói mà cùng hội viên từng mua.

## Báo cáo

- Admin: `/admin/membership-insights`, toàn hệ thống.
- Quản lý: `/manager/membership-insights`, cơ sở được server xác định từ phân công.
- API: `GET /reports/memberships?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&termId=...`.
  `termId` là tùy chọn; Admin có thể truyền `facilityId=ALL`.
- Lượt mua/người mua/doanh thu tính theo cơ sở phát hành và khoảng ngày mua/thu.
  Sử dụng lớp tính theo cơ sở tổ chức, ngày đặt buổi và kỳ của buổi học nếu được lọc.
- Gói mua trước khoảng ngày vẫn được tính sử dụng nếu được dùng để đặt lớp trong khoảng đó.
- Chỉ tính lượt BOOKED/COMPLETED; loại các lượt hủy. Một học viên đặt nhiều buổi của
  cùng lớp đóng góp một người trong mức độ phổ biến lớp, cùng số lượt đặt buổi tương ứng.
- Gói FREE được cấp tự động không được xếp hạng như một lựa chọn mua gói.

Kiểm tra không kết nối CSDL:

```powershell
npm --prefix BE run test:membership-usage
```
