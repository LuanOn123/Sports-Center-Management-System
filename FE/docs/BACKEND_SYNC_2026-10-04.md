# Đồng bộ FE sau thay đổi BE — 04/10/2026

Nhánh: `develop`. BE local tại commit `eedf78c`. Chỉ cập nhật FE.

## Identity MongoDB

User, MemberProfile, CoachProfile, ManagerProfile ID dùng chuỗi ObjectId. FE giữ `id`/`userId`/`memberId`/`coachId` dưới dạng string và không ép định dạng UUID. ID lớp, lịch, subscription, payment của PostgreSQL vẫn là chuỗi UUID. Request/response và Bearer auth giữ cấu trúc hiện có; không đổi sang `_id`.

`src/shared/identityStorage.ts` chạy trước khi transport đọc token. Mỗi tab xóa một lần các key `pulse.access`, `pulse.refresh`, `pulse.user`, `pulse.pending-checkout.*` trong sessionStorage/localStorage và ghi phiên bản `mongo-identities-v1` trong sessionStorage. Người dùng có phiên cũ cần đăng nhập lại. Các key ngoài danh tính/checkout của Pulse được giữ; phiên mới không bị xóa khi reload.

## Module đã xóa

Đã gỡ trang, sidebar, shortcut dashboard, widget AI tạo lịch, component kế hoạch trong hồ sơ member/coach/manager, service/type/error mapping và validation dành riêng cho kế hoạch. Hồ sơ mục tiêu, trình độ, sở thích vẫn được BE hỗ trợ và giữ nguyên. AI chat public vẫn hoạt động.

Đã đồng bộ `docs/openapi.json`, `workflow-contract-overrides.json`, generated types, operations và inventory. Đã xóa endpoint cũ trong cả nguồn Swagger snapshot và overrides để generator không sinh lại. Swagger local vẫn có phần chú thích cũ và route JS biên dịch cũ, nên snapshot FE loại các path của module đã bị xóa, loại tag/notification filter cũ; `/ai/chat` dùng security public đúng với middleware thực tế. Các snapshot có ngày trước đây là tài liệu lịch sử.

## Membership và kiểm thử

FE tiếp tục dùng startDate/endDate do API trả về, không bổ sung logic cộng ngày. Kiểm thử bao gồm migration storage, token refresh, ObjectId member login/profile, UUID entity paths, chặn gọi endpoint đã xóa trước network, OTP, AI chat, hồ sơ/roster HLV, chat, notifications và SePay. Browser tests dùng API fixtures; không thực hiện giao dịch hoặc gửi OTP trên production.

Kết quả: typecheck/build đạt, 54 unit tests và 50 browser tests đạt. Kiểm tra đăng ký/login mọi vai trò, OTP và responsive/accessibility trên public pages cũng đạt.
