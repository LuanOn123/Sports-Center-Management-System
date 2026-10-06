# Sports Center Web — Role-based features

Frontend có portal ADMIN, MANAGER, RECEPTIONIST, COACH và MEMBER. Sử dụng Vite, React, TypeScript, React Router và TanStack Query. Kết quả kiểm tra source và môi trường triển khai ngày 06/10/2026 nằm trong [báo cáo integration](../docs/INTEGRATION_AUDIT_2026-10-06.md) và [API contract map](../docs/API_CONTRACT_MAP.md).

## Chạy ứng dụng

Yêu cầu Node.js 22+ và npm.

```powershell
cd FE
npm ci
npm run dev
```

Mở http://127.0.0.1:5173 để xem landing page. `/register` tạo tài khoản hội viên; `/login` đăng nhập và chuyển vào portal theo ADMIN, MANAGER, RECEPTIONIST, COACH hoặc MEMBER. STAFF chỉ là alias tương thích dữ liệu cũ trên FE. Người đã đăng nhập được đưa về portal khi mở `/`. Không có tài khoản/mật khẩu mặc định trong FE.

## Landing page và đăng ký

- Landing page tiếng Việt gồm hero, nhóm người dùng, bộ môn, tính năng, bản xem trước tương tác, thống kê cấu trúc nền tảng, lợi ích, góc nhìn cộng đồng, CTA và footer. Theme charcoal/lime, ảnh thể thao từ Unsplash, font Barlow Condensed và Be Vietnam Pro từ Google Fonts; font hệ thống và nền tối dự phòng khi tài nguyên ngoài không tải được.
- Hiệu ứng reveal bằng IntersectionObserver, parallax bằng requestAnimationFrame, counter khi cuộn tới, hover; tôn trọng `prefers-reduced-motion`. CSS được giới hạn trong `.pulse-public` để giữ giao diện portal.
- Bản xem trước và lời trích dẫn tình huống được ghi rõ là minh họa, không phải dữ liệu hoặc đánh giá khách hàng thật. Không công bố số lượng khách hàng chưa xác minh.
- Form gọi `POST /auth/register` bằng API client hiện có. Contract đã đối chiếu với Swagger Render ngày 15/09/2026: `fullName`, `email`, `password` bắt buộc; `phone` tùy chọn; mật khẩu tối thiểu 6 ký tự. Không gửi mật khẩu xác nhận hay vai trò tự chọn. Thành công hiển thị xác nhận và link đăng nhập vì API đăng ký không trả token.
- Có kiểm tra mật khẩu xác nhận, chặn gửi lặp, trạng thái đang gửi, lỗi field, 409 email trùng và lỗi mạng. Kiểm thử mutation dùng Playwright interception, không tạo tài khoản thử trên production.
- `npx playwright test public.spec.ts` kiểm tra đăng ký, điều hướng, preview tabs, responsive và axe accessibility ở 375/768/1440px. Ảnh kiểm tra nằm trong `artifacts/landing-*.png` và `artifacts/register-*.png`.

Base URL mặc định: `https://sports-center-management-system.onrender.com/api/v1` — đúng Production Server (Render) trong ảnh. Có thể sao chép `.env.example` thành `.env` để cấu hình `VITE_API_BASE_URL`. Không thêm `/api/v1` lần nữa vào endpoint.

## Các màn hình manager hiện có

| Route | Chức năng đã nối API |
| --- | --- |
| `/manager/dashboard` | 4 báo cáo thật, lọc ngày, biểu đồ phương thức thanh toán/hạng hội viên, lịch hôm nay |
| `/admin/users` | ADMIN quản lý tài khoản, vai trò cố định, trạng thái; MANAGER không có quyền `/users` |
| `/manager/members` | Tìm kiếm, trình độ, phân trang, tạo MEMBER, chi tiết và tình trạng gói |
| `/manager/coaches` | Tìm kiếm/chuyên môn, phân trang, chi tiết, sửa hồ sơ; ADMIN tạo tài khoản |
| `/manager/staff` | Cổng quản lý phân công cơ sở; quản trị tài khoản `/users` thuộc ADMIN |
| `/manager/membership-plans` | Danh sách, lọc hạng/trạng thái, chi tiết; ADMIN sửa catalog/giá |
| `/manager/sports` | Tìm kiếm/lọc, phân trang, chi tiết; ADMIN sửa catalog |
| `/manager/rooms` | Tìm kiếm/lọc, phân trang, chi tiết, tạo, sửa, ngừng hoạt động |
| `/manager/classes` | Tìm kiếm/lọc, phân trang, chi tiết, tạo, sửa, ngừng hoạt động, phân công/gỡ coach |
| `/manager/schedules` | Lọc ngày/phòng/lớp/trạng thái/thời gian, phân trang, tạo/sửa/hủy lịch, xem người đăng ký |
| `/manager/reports` | Doanh thu, hội viên, đăng ký lớp, gói thành viên; xuất CSV từ số liệu đã tải |
| `/manager/profile` | Xem/sửa hồ sơ hiện tại, đổi mật khẩu |
| `/manager/roles` | Hiển thị các vai trò cố định; backend không có API tạo quyền tùy chỉnh |
| `/manager/audit-logs` | GET /audit-logs, yêu cầu cơ sở đang làm việc |

Mỗi truy vấn có loading, empty, error/retry. Mutation có trạng thái chờ, thông báo thành công và lỗi backend, tự làm mới dữ liệu. Xác nhận trước khi ngừng hoạt động/hủy lịch. Khi hủy lịch, UI giải thích tác động hủy các enrollment BOOKED.

## Hợp đồng API và giới hạn

- Nguồn hiện tại: Swagger từ source BE trong checkout, kết hợp `docs/workflow-contract-overrides.json` cho các schema mà Swagger chưa mô tả đầy đủ. Render đang lệch phiên bản; không dùng Swagger Render để ghi đè contract của source mới.
- Snapshot: `docs/openapi.json`, 151 operations.
- `docs/API_INVENTORY.md`: method/path, auth, path/query parameters, required fields, request schema, status codes, response examples, enum, pagination và lỗi của 151 operations. `npm run check:api-contract` đối chiếu method/path với route AST của BE.
- `src/shared/operations.json`: metadata cho service, bộ lọc, form và enum; không chứa response mẫu.
- `src/shared/generated.ts`: request types được tạo từ schema; response types được suy ra từ example vì backend không có `components.schemas`. Đây không phải lời khẳng định schema response đầy đủ.
- `src/shared/api.ts`: chỉ cho gọi operation và query parameter đã có trong snapshot; mã hóa path ID; Bearer token, refresh đồng thời chỉ một lần, timeout, lỗi field, logout.
- Token lưu trong `sessionStorage` của tab. Vai trò xác minh qua GET /auth/me, không lấy từ việc tự giải mã JWT; backend vẫn phải kiểm tra quyền trên mọi request.
- Giá gói/thanh toán trong response là chuỗi decimal; request giá là number theo Swagger.
- Pagination nằm cạnh `data`: `{page, limit, total, totalPages}`. Chỉ gửi page/limit khi operation thực sự khai báo chúng.
- `coachId` của phân công là **CoachProfile.id**, không phải User.id. Chỉ cho chọn nếu API trả đúng mã hồ sơ; không suy đoán mã từ user ID.
- Các trường cập nhật thiếu schema được giữ chưa khả dụng. Xem `docs/MISSING_API.md`.
- Portal dùng Be Vietnam Pro và fallback sans-serif; landing page bổ sung ảnh thể thao từ Unsplash. Bản xem trước nền tảng được dựng bằng HTML/CSS tương tác.

## Review UI/UX

Xem [báo cáo review và các thay đổi](docs/FRONTEND_REVIEW.md). Khung điều hướng dùng chung, font/control được chuẩn hóa, có kiểm thử responsive ở 8 độ rộng và axe accessibility.

## Kiểm thử

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:ui
```

- TypeScript + Vite production build.
- Unit test: chặn endpoint/query chưa khai báo, path encoding, refresh đồng thời, hết phiên, 400 validation, 403 và nội dung không hợp lệ.
- Playwright: trang login desktop/mobile, hiện/ẩn password, 13 route quản lý, form tạo phòng đúng body, menu mobile, chặn MEMBER, error/retry. Test fixtures chỉ tồn tại trong `tests/`, dựa trên ví dụ Swagger; **không có fixture/mock trong runtime**.
- Kiểm tra Render chỉ đọc: GET /sports và GET /membership-plans trả 200; GET /users không token trả 401; CORS trả `Access-Control-Allow-Origin: *`.
- Chưa có tài khoản MANAGER để kiểm thử trực tiếp protected endpoints và mutation trên Render. Không khẳng định tích hợp end-to-end production đã hoàn tất.

## Cập nhật snapshot

Chạy `npm run generate:api -- --local` để xuất Swagger trực tiếp từ source BE hiện tại (cần cài dependencies ở BE), rồi `npm run check:api-contract` và `npm run verify`. Generator giữ các workflow overrides. Review diff schema và implementation trong BE; Swagger có thể thiếu validation/ownership/business rules. Khi chạy FE với BE local, đặt `VITE_API_BASE_URL=http://127.0.0.1:8080/api/v1`; kiểm tra `.env.local` vì Vite ưu tiên nó hơn `.env`.

## Deploy

`npm run build` tạo `dist/`. Cấu hình static host rewrite các đường dẫn về `/index.html` để React Router hoạt động khi refresh/deep link. Chưa triển khai hay push lên remote trong yêu cầu này.
