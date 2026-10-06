# ADMIN 403 trên BE deploy — 06/10/2026

## Kết luận

Đã đăng nhập trực tiếp BE Render bằng tài khoản seed ADMIN được người dùng cung cấp. Login 200; access token có role ADMIN; GET `/auth/me` trả role ADMIN, isActive true. Các request tiếp theo dùng chính Bearer token vừa nhận.

403 xuất phát từ authorization của BE deploy, không phải FE gửi thiếu token, nhận sai role, hoặc tài khoản bị khóa. Gửi thêm `X-Facility-Id` lấy từ `/facilities` không thay đổi kết quả 403.

Runtime Render có hành vi không khớp source BE hiện tại. Điều này phù hợp với deployment còn dùng authorization/routes cũ. Không có quyền đọc Render build settings/logs nên chưa xác định được chính xác commit hoặc nguyên nhân cấu hình deploy.

## Kết quả trực tiếp

| API (prefix `/api/v1`) | ADMIN trên Render |
|---|---|
| POST `/auth/login` | 200, tokenRole ADMIN |
| GET `/auth/me` | 200, role ADMIN, active true |
| GET `/facilities` | 200, 4 cơ sở |
| GET `/users` | 403, `Forbidden: insufficient permissions` |
| GET `/members` | 403, `Forbidden: insufficient permissions` |
| GET `/reports/revenue`, `/reports/members`, `/reports/enrollments` | 403, cùng thông báo authorization |
| GET `/coaches`, `/sports`, `/membership-plans` | 200 |
| GET `/rooms`, `/classes`, `/class-schedules` | 200; quyền đọc thành công không chứng minh mutation được cho phép |
| GET `/audit-logs`, `/issues`, `/slots`, `/staff-candidates`, `/schedule-patterns`, `/leave-requests`, `/counter-orders` | 404, `Route not found` |

Đã so sánh `/users`, `/members`, `/reports/revenue` cả khi không có cơ sở và khi có cơ sở: đều 403. Đây khác lỗi `FORBIDDEN_SCOPE` hoặc `FACILITY_CONTEXT_REQUIRED` trong implementation facility hiện tại.

Bằng chứng không chứa password/token hay dữ liệu cá nhân của danh sách: [JSON](deployed-admin-permissions-audit.json), [log](deployed-admin-permissions-audit.log). Không thử tạo/sửa/xóa resource production. Refresh token do probe tạo được logout khi hoàn tất.

## Đối chiếu source và git history

- `BE/src/middlewares/authorize.ts`: ADMIN được chấp nhận nếu annotation có ADMIN, hoặc kế thừa MANAGER/RECEPTIONIST. Không cho ADMIN tự động vượt qua route chỉ dành MEMBER/COACH.
- `BE/src/modules/users/users.routes.ts`: `router.use(authenticate, authorize("ADMIN"))`. Vì vậy ADMIN active, token hợp lệ phải vượt qua guard `/users` trong source hiện tại.
- `BE/src/modules/members/members.routes.ts`: MANAGER/RECEPTIONIST; ADMIN được hưởng quyền kế thừa từ middleware.
- `BE/src/modules/reports/reports.routes.ts`: MANAGER; ADMIN được hưởng quyền kế thừa.
- `BE/src/middlewares/facilityScope.ts`: ADMIN không cần assignment staff, nhưng cơ sở phải tồn tại, active và context không mâu thuẫn.

Commit `9e6db53` đã thay `/users` từ MANAGER-only sang ADMIN-only và thêm quyền kế thừa ADMIN trong `authorize.ts`. Middleware cũ chỉ kiểm tra `roles.includes(req.user.role)`, nên ADMIN bị từ chối ở các route MANAGER/STAFF cũ. Kết quả Render đang phù hợp với kiểu mismatch này; các operations mới 404 cũng là bằng chứng deployment chưa đầy đủ.

Core authorization fix trên đã có trong HEAD checkout, không cần nới guard FE hoặc đổi tài khoản ADMIN thành MANAGER. Các sửa local ở audit trước chưa được commit/push/deploy; chúng không thay đổi runtime Render.

## Cách khắc phục deployment

1. Trong Render, kiểm tra repository, branch và commit thực tế đã deploy. Đối chiếu với source cần phát hành, bao gồm thay đổi role/operations và các integration fixes.
2. Kiểm tra Root Directory `BE`; Build Command phải cài dependencies và build source (`npm ci && npm run build`); Start Command `npm start` chạy `dist/server.js`. Nếu Root Directory đặt ở repo root, các lệnh phải chuyển vào BE tương ứng.
3. Chạy deployment/migrations theo schema hiện tại, gồm facility operations, Mongo role/identity projection migration nếu dữ liệu cũ còn STAFF. Không chạy reset/seed phá dữ liệu production.
4. Nếu commit đúng nhưng runtime vẫn cũ, kiểm tra build logs/artifact và thực hiện clear build cache + redeploy sau khi xác nhận cấu hình. Chưa có bằng chứng để kết luận cache là nguyên nhân cụ thể.
5. Sau deploy, đăng nhập lại; chạy probe để xác nhận `/users`, `/members`, `/reports/*` hết 403 và operations mới hết 404. Kiểm tra mutation bằng dữ liệu thử được phép ở môi trường thích hợp.

Không sửa FE để giả role hoặc bỏ authorization. Các trang đọc được không có nghĩa toàn bộ ADMIN permission đã đúng trên deployment.

## Probe tái sử dụng

`scripts/probe-deployed-admin.mjs` nhận `ADMIN_AUDIT_EMAIL`, `ADMIN_AUDIT_PASSWORD`, optional `ADMIN_AUDIT_API_URL` và `ADMIN_AUDIT_OUTPUT` qua environment. Script chỉ login, GET các module và logout token của chính nó; output chỉ có status, role, message và số bản ghi. Không lưu credentials trong repo.

**Trạng thái:** đã xác định lỗi quyền ở runtime deploy và mismatch với source; chưa thay đổi hay redeploy Render trong yêu cầu kiểm tra này.
