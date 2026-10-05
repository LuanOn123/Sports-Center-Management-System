# Kiểm tra và sửa main — 2026-10-04

Commit kiểm tra: `46ff6a7` (`merge develop into main`). Thay đổi sửa lỗi chưa commit.

## Đã sửa

- 17 file FE còn dấu xung đột merge đã được commit vào main, bao gồm TSX, CSS, JSON hợp đồng API và tests. Các vùng xung đột được đối chiếu và giữ nội dung develop để bảo toàn giao diện mới, OTP reset password, ObjectId và việc bỏ Training Plans. Sau xử lý, 17 file trùng với nội dung hợp lệ ở parent develop (`7172294`).
- Xóa `BE/src/modules/payments/sepay-payment.service.ts`: service SePay cũ không có caller, tham chiếu các field Prisma/config không tồn tại. API hiện dùng `sepay-payments.service.ts`.
- Cài lại dependency BE từ lockfile và sinh lại Prisma client. Thêm `predev`/`prebuild` để tránh dùng client cũ sau khi schema thay đổi.
- Chuyển `@prisma/client` sang runtime dependency vì server cần module này khi chạy.
- Cấu hình `FE/.env` cục bộ sang `http://localhost:8080/api/v1` theo lựa chọn chạy BE local của người dùng. File này được Git ignore. Cập nhật `.env.example` và tài liệu MongoDB replica set.

## Xác minh

- FE typecheck, FE production build và BE production build: PASS.
- FE unit tests: 54/54 PASS.
- FE Playwright: 146/147 PASS trong lượt đầy đủ; 1 test axe bị mất execution context trong lúc Vite reload sau thay đổi `.env`. Chạy lại riêng test đó: PASS. Các browser tests sử dụng API fixtures, không chứng minh database thật hoạt động.
- HTTP smoke trên Express app đã build, không kết nối DB: health 200, auth/me thiếu token 401, register body không hợp lệ 400, hai API Training Plans đã xóa trả 404.
- Không còn dấu xung đột merge; `git diff --check` PASS.

## Chưa xác minh / cần xử lý tiếp

Workspace hiện không có `BE/.env`. Không chạy migration, reset hoặc seed vào database chưa xác định.

Chuyển MongoDB đang chưa hoàn chỉnh ở lớp liên kết nghiệp vụ:

- `auth.service.ts` tạo User/MemberProfile trong MongoDB, commit Mongo transaction rồi tạo FREE subscription ở PostgreSQL với Mongo profile ID.
- `prisma/schema.prisma` vẫn giữ foreign key `MembershipSubscription.memberId -> MemberProfile.id` và các relation User/Profile khác ở PostgreSQL. Luồng tạo tài khoản hiện không tạo bản ghi PostgreSQL tương ứng, nên có thể lỗi foreign key sau khi tài khoản MongoDB đã được lưu.
- Nhiều module còn lookup User/Profile qua Prisma, gồm payments, subscriptions, enrollments, attendance, chat và feedback. Nếu PostgreSQL vẫn chứa UUID cũ còn MongoDB dùng ObjectId mới thì lookup và phân quyền không khớp.
- `seed-mongo.ts` và `prisma/seed.ts` tạo identity độc lập; không tự coi chạy cả hai seed là đã đồng bộ ID.
- Mongo transaction yêu cầu replica set hoặc Atlas; Mongo standalone theo URI mặc định không đáp ứng đăng ký hiện tại.

Cần xác định cấu hình và dữ liệu BE local trước khi hoàn thiện migration identity và kiểm thử đăng ký, đăng nhập, mua gói, đặt lớp, điểm danh, chat với database thật. Build và browser fixtures đã qua không có nghĩa các luồng này đã được xác nhận hoạt động.
