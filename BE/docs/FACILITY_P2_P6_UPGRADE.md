# Đồng bộ nghiệp vụ cơ sở P2–P6 (2026-10-05)

Đối chiếu `SCMS_Backend_Tasks.md`. Mã nguồn FE/BE đã được cập nhật; database chính chưa được nâng cấp bởi phiên làm việc này. Các kiểm thử ghi dữ liệu chỉ dùng schema PostgreSQL và database MongoDB riêng có tiền tố `scms_verify_`.

## Phạm vi đã triển khai

| Giai đoạn | Backend | Frontend |
| --- | --- | --- |
| P1 | 5 role; context cơ sở bắt buộc; lọc truy vấn và chặn ID khác cơ sở; phân công đúng role của tài khoản | Portal ADMIN; bộ chọn cơ sở; gửi `X-Facility-Id`; hủy request và xóa cache nghiệp vụ khi đổi cơ sở; khóa chuyển cơ sở trong lúc lưu |
| P2 | RoomCapability; SubjectRequirement; CoachSpecialization; chặn tài nguyên không đáp ứng buổi học tương lai | Điều kiện giảng dạy, thiết bị phòng, chuyên môn HLV; gói/môn học/tài khoản chỉ ADMIN sửa |
| P3 | Snapshot yêu cầu khi tạo lớp; Slot/SchedulePattern; sinh toàn bộ lịch trong transaction; kiểm tra phòng, chuyên môn, nghỉ phép và trùng lịch | Khung giờ, sinh lịch định kỳ; HLV gửi đơn; quản lý chọn thay HLV/dời/hủy từng buổi trước khi duyệt |
| P4 | Snapshot giá/điều khoản đã bán; đơn quầy PENDING → xác nhận → cấp gói; khóa chống xác nhận trùng; đăng ký toàn khóa kiểm tra đến cuối buổi cuối, quota, sức chứa, trùng giờ | Đơn bán tại quầy, xác nhận thu tiền có lý do; điều hướng và quyền theo role mới |
| P5 | QR có hạn và kiểm tra gói tại lúc quét; HLV điểm danh từ 30 phút trước đến hết buổi; ADMIN/MANAGER sửa có lý do; Issue riêng tư và theo cơ sở | Cửa sổ điểm danh tương ứng; hội viên tạo/sửa/xóa yêu cầu đang mở; nhân viên phản hồi |
| P6 | Báo cáo thu ròng theo cơ sở và thời điểm thu/hoàn; audit trước/sau cùng transaction với mutation | Nhật ký có phân trang; cảnh báo số liệu hoàn tiền lịch sử chưa đối soát |

`Subject` tái sử dụng model `Sport`; `/subjects` là alias tương thích. `Session` tái sử dụng `ClassSchedule`. User/Profile thuộc MongoDB; PostgreSQL giữ projection ID cần cho FK của module nghiệp vụ. Chuyên môn, lớp và thanh toán vẫn thuộc PostgreSQL.

## Chuẩn bị nâng cấp database chính

1. Sao lưu PostgreSQL và MongoDB, kiểm tra có thể khôi phục bản sao; tạm dừng ghi dữ liệu trong lúc chuyển ID. Chuyển ID giữa hai DB không phải distributed transaction; script có thể chạy lại sau khi xử lý lỗi, nhưng không thay thế bản sao lưu.
2. Lưu cấu hình kết nối thật ở `BE/.env` (được Git bỏ qua). Cần `DATABASE_URL`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`; local dùng `PORT=8080`. Chỉ thêm các cấu hình email/payment/avatar đang sử dụng. Không dùng `.env.test` để chạy dữ liệu chính.
3. Nếu Node trên máy không resolve được SRV của Atlas, thêm `DNS_SERVERS=1.1.1.1,8.8.8.8`. Tùy chọn này chỉ áp dụng cho tiến trình Node.
4. Chạy từ thư mục `BE`, kiểm tra lịch sử migration trước khi deploy:

```powershell
npx prisma migrate status
```

**Riêng database được cung cấp:** truy vấn read-only `_prisma_migrations` cho thấy migration `20260925090000_add_vietqr_sepay_payment` chưa được ghi nhận, nhưng migration online khác đã có `Payment.planId`. Trước `db:deploy`, hoàn thiện DDL còn thiếu bằng script tương thích, sau đó mới ghi nhận migration cũ đã áp dụng:

```powershell
npx prisma db execute --file prisma/compatibility/legacy-vietqr.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260925090000_add_vietqr_sepay_payment
```

Script giữ nguyên dữ liệu và checksum migration lịch sử; chỉ thêm cột/index/FK còn thiếu, có thể chạy lại. Không chạy `resolve` trước khi `db execute` thành công. Database khác đã áp dụng migration này không cần bước trên.

Sau bước tương thích (nếu cần), chạy:

```powershell
npm run db:deploy
npm run db:generate
npm run db:migrate:roles
npm run db:migrate:identities
```

Hai migration mới là `20261005000000_facilities_roles` và `20261005000100_facility_operations`. Migration P1 đổi enum SQL STAFF thành RECEPTIONIST và tạo cơ sở mặc định `legacy-main`; P2–P6 gắn dữ liệu nghiệp vụ cũ vào cơ sở đó. Snapshot giá cũ lấy từ payment có `paidAt` đầu tiên. Không suy diễn số tiền đã hoàn từ ghi chú cũ.

Nếu database đã được chỉnh bằng `db push` hoặc lịch sử migration không khớp, đối chiếu schema/lịch sử và baseline đúng các migration **đã thực sự áp dụng** trước khi tiếp tục. Không dùng `migrate reset` hoặc tự đánh dấu migration mới đã chạy để bỏ qua lỗi.

Lệnh identity không có `--apply` chỉ đọc và đếm tài khoản. Khi đã kiểm tra bản sao lưu, chạy:

```powershell
npm run db:migrate:identities -- --apply --admin-email=existing-admin@example.com
npm run build
```

Thay email mẫu bằng tài khoản MongoDB hiện có sẽ được cấp ADMIN. Nếu đã có ADMIN đúng, bỏ `--admin-email`. Script không tự chọn tài khoản để nâng quyền. Nó đồng bộ User/Profile ObjectId sang projection PostgreSQL, giữ FK bằng cascade, cập nhật các coachId plain, phân công nhân sự cũ vào `legacy-main`, và thiết lập chuyên môn từ lớp đang được phân công.

Kiểm tra read-only database được cung cấp cho thấy MongoDB hiện vẫn có STAFF và chưa có ADMIN. Cần chốt email quản trị trước khi áp dụng migration; không tự động nâng quyền tài khoản đầu tiên.

Sau đó ADMIN kiểm tra danh sách cơ sở, phân công nhân sự thật, chuyên môn, phòng và lịch cũ. Đăng xuất/đăng nhập lại sau khi đổi role hoặc migration ID.

## Chạy local

Tạo `FE/.env.local` với:

```dotenv
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Khởi động lại Vite sau khi đổi env. Chạy BE và FE ở hai terminal riêng:

```powershell
# terminal 1, BE
npm run dev
# terminal 2, FE
npm run dev
```

Không khởi động BE dùng database chính trước khi deploy migration: schema chính được kiểm tra trong phiên này còn role STAFF, chưa có Facility/FacilityStaff.

## Kiểm chứng đã chạy

- BE TypeScript build và Prisma generate.
- Integration nghiệp vụ trên PostgreSQL schema riêng và ping MongoDB riêng: scope, snapshot, điều kiện phòng/HLV, trùng lịch, rollback audit, duyệt nghỉ có xử lý lịch, xác nhận đồng thời, hoàn tiền một phần, đăng ký tranh chỗ và thời hạn toàn khóa, điểm danh/quyền sửa.
- HTTP Express thật với JWT + hai database riêng: scope/role, privacy ticket, audit, tạo User/Profile MongoDB và projection PostgreSQL cùng ID, chuyển UUID cũ sang ObjectId vẫn giữ phân công lớp.
- Migration SQL chạy trên schema legacy thử riêng: phòng cũ còn nguyên, cơ sở mặc định được tạo, STAFF được đổi.
- FE conflict scan, typecheck, 57 unit tests và production build.
- Browser suite 157 case: lần chạy tổng có 153 pass, 4 case phụ thuộc quyền/fixture cũ đã sửa; chạy lại toàn bộ hai file liên quan có 28/28 pass. Accessibility tại 375px và 1440px đã qua. Browser tests dùng mock API; không thay thế kiểm thử HTTP thật ở trên.
- Thêm 3 case mới: kiểm tra cấu hình phòng đã lưu/lỗi lookup không được ghi đè, và accessibility của 9 màn hình vận hành ở cả 375px/1440px. Cả 3 đã qua sau khi sửa locator/assertion của fixture. Tổng cộng 160 case UI được kiểm tra qua lượt tổng và các lượt chạy lại có mục tiêu.

Chạy lại integration từ BE cần `.env.test` chỉ trỏ tới tài nguyên thử riêng:

```powershell
npm run test:operations
npm run test:operations:http
npm run test:operations:migration
```

Các test nghiệp vụ/HTTP chặn nếu tên schema/database không có tiền tố `scms_verify_`; test migration tạo rồi xóa schema thử cụ thể. Không dùng các test E2E cũ tùy tiện trên dữ liệu chính.

## Giới hạn và dữ liệu cần đối soát

- Sinh lịch định kỳ hiện hỗ trợ `Asia/Ho_Chi_Minh`, tối đa khoảng ngày 366 ngày. Múi giờ khác trả lỗi rõ ràng.
- Payment REFUNDED cũ không có số tiền/thời điểm hoàn được báo là chưa đối soát; thu ròng chưa được coi là đã xác minh cho đến khi bổ sung dữ liệu thật.
- Chưa gọi email, ngân hàng/SePay hay Cloudinary thật; không phát sinh giao dịch ngoài các database thử.
- Migration database chính và deploy/push chưa thực hiện trong thay đổi này. Không coi bộ test mock UI là bằng chứng hệ thống production đã được nâng cấp.
- Các khóa truy cập đã gửi trong hội thoại cần được thay mới ở dịch vụ tương ứng và trong `.env`; không đưa chúng vào source, báo cáo hoặc commit.
