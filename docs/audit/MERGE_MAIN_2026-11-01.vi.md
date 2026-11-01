# Hợp nhất main với bản sửa local — 01/11/2026

## Phiên bản

- Nhánh làm việc: `develop`.
- Nền local trước sửa: `0f3db02`.
- Snapshot toàn bộ bản sửa local: `e0a9013`; được giữ bằng nhánh `codex/local-before-main-20261101`.
- Main đã fetch: `origin/main` tại `4a9e660`.
- Hợp nhất thật bằng merge hai nhánh, không squash hoặc ghi đè lịch sử main; chưa push/deploy.

## Quyết định sau đối chiếu

| Phần | Phiên bản được giữ / kết hợp | Lý do |
|---|---|---|
| OTP/rate limit | Main | Mongo counter dùng chung qua nhiều API instance, reserve attempt nguyên tử, cooldown và không serialize thông tin OTP. Thay limiter IP trong bộ nhớ của local. |
| Thu tiền | Main | Tắt thu tay tự do hoàn toàn; khoản thu phải đến từ đơn/gia hạn. Mạnh hơn việc chỉ đối chiếu subscription/giá của local. Giữ route cũ trả lỗi có hướng dẫn, không xóa route. |
| Hoàn tiền SePay | Main | Thêm duyệt hoàn ngoại lệ cho tiền chưa cấp gói, biên nhận xác nhận riêng; chặn cấp gói sau khi đã duyệt hoàn. |
| Booking khi hủy gói | Main + test local cập nhật | Đối chiếu từng buổi với gói trả phí độc lập, đúng thời gian/tier; thu hồi booking không đủ quyền và đôn danh sách chờ. Local chỉ kiểm tra còn gói khác hay không, không đủ chính xác. |
| UI hủy gói | Main | Lễ tân/Admin có quy trình hủy; không cho SUSPENDED thủ công và không chốt SUCCESS thu tiền bằng đổi enum. |
| Quản lý gói của Admin | Local + luồng Main | Giữ menu và route `/admin/subscriptions`; dùng modal/quyền mới của main, không phục hồi tạm ngưng thủ công. Có test trình duyệt cho route sau merge. |
| Ngày gia hạn / doanh thu | Main | Giữ timestamp nối tiếp và ngày Việt Nam; migration backfill `Payment.planId` có nguồn rõ ràng. |
| Quyền học / điểm danh / waitlist | Main | FREE được vào cơ sở nhưng không tự có quyền đặt/điểm danh lớp; giữ grant kỳ hợp lệ và kiểm tra lại lịch sau khi khóa. |
| Hồ sơ hội viên cho Coach | Kết hợp | Giữ DTO hạn chế PII của main, dùng resolver lịch dạy hiện tại của local để không cấp quyền cho HLV chính đã được thay thế ở buổi đó; HLV hỗ trợ/thay thế vẫn đúng quyền. |
| Ngày sinh | Main | Dùng một validator cho đăng ký, cập nhật profile, tạo/sửa người dùng và hội viên; tránh chỉ chặn ở auth. |
| Seed | Main + local | Main có chuyên môn/nhân sự cơ sở và HLV HIIT riêng Q7; giữ local gán term vào schedule pattern. Lọc FREE/giá không hợp lệ khỏi lựa chọn bán trên FE. |
| Migration Term | Main | Giữ `20261031000000_term_facility`; loại bản local `20261101000000_term_facility` chưa từng chạy để không tạo hai migration cho cùng thay đổi. Không sửa checksum migration main. |
| Fixture lịch | Kết hợp | Giữ dữ liệu bộ môn/HLV/chuyên môn đầy đủ của main, thêm type Prisma, guard DB local và cleanup quan hệ đúng thứ tự từ local; bỏ helper trùng. |
| Fixture CAPTCHA E2E | Kết hợp | Giữ cách bootstrap suite của main, dùng token mới mỗi login và single-use từ local; bắt buộc NODE_ENV=test, schema riêng, PostgreSQL/Mongo đều local. Không đổi xác minh CAPTCHA của production. |
| Regression / CI | Cả hai | Giữ QA isolation/live harness, CI và các test mới của main; giữ 21 regression local, cập nhật assertion theo nghiệp vụ chặt hơn, không sửa sản phẩm chỉ để chiều test cũ. |
| API contract | Local + metadata Main | Giữ tool phân biệt authorize/authorizeExact; metadata có endpoint hoàn tiền ngoại lệ mới, đồng bộ DTO deprecated receipt. |

Các thay đổi mailer, attendance, API, chính sách, UI học viên, fixture và tài liệu khác của main cũng được giữ lại. File `AUDIT_ROUND2_FIXES_2026-11-01.vi.md` là báo cáo **trước merge**, không mô tả toàn bộ trạng thái mới.

## Kiểm chứng bản hợp nhất trên máy hiện tại

- BE build: PASS.
- BE hardening: **84/84 PASS** (63 hiện có + 21 regression local đã cập nhật).
- CAPTCHA: **27/27 PASS**.
- Typecheck strict các file integration/E2E/helper thay đổi: PASS.
- FE `npm run verify`: **118/118 PASS**, typecheck/build PASS.
- Playwright: **20 bài PASS** (19 bài hoàn tiền/quyền manager/quick actions + 1 bài route Admin subscriptions). Đây là UI với API fixture, không phải kiểm thử ghi dữ liệu Render.
- Contract: **189 FE / 189 BE**, không thiếu endpoint.
- Không còn conflict Git; diff whitespace kiểm tra sạch.
- Vite còn cảnh báo bundle >500kB có từ trước, không cản build.

`npm run test:qa:isolation` đã được thử nhưng dừng trước khi tạo DB vì Docker Desktop Linux Engine không hoạt động. Vì vậy chưa xác nhận lại migrate/seed/SQL integration/live trên máy này; các kết quả live trong tài liệu main là bằng chứng của tác giả main, không được tính là lần chạy mới của bản hợp nhất.

## Lệnh kiểm tra DB sau khi Docker hoạt động

```powershell
cd BE
npm run test:qa:isolation -- --live
# Các suite E2E cũ được chạy riêng khi cần:
npm run test:qa:isolation -- --legacy-e2e
```

Harness tạo database tạm và dọn container thuộc lần chạy đó; không dùng database Render. Khi triển khai thực tế, dùng migration trong main (`npm run db:deploy`) theo quy trình sao lưu/preflight hiện có, không chạy seed demo vào database nghiệp vụ.
