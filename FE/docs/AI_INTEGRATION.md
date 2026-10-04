# Tích hợp AI — 02/10/2026

Nguồn: `AI_prompt.txt` do BE cung cấp và [Swagger đang triển khai](https://sports-center-management-system.onrender.com/api/v1/docs/).
Snapshot nguyên bản riêng hai endpoint: `ai-openapi-2026-10-02.json`.

## Endpoint đã bổ sung

| API | Quyền | Request | Kết quả |
| --- | --- | --- | --- |
| POST /ai/chat | Public | `{ message, history: [{ role, content }] }` | Envelope `data.reply` |
| POST /ai/generate-training-plan | MEMBER, Bearer | Không gửi body | Envelope `data` chứa TrainingPlan, description Markdown |

Swagger mô tả chat là public nhưng thiếu `security: []`, nên kế thừa Bearer toàn cục. Bản contract FE bổ sung `security: []` đúng theo mô tả và tài liệu BE; snapshot nguyên bản giữ nguyên để đối chiếu. FE không gửi role `system` dù schema cho phép. Swagger chưa mô tả schema response tạo kế hoạch; kiểu dữ liệu dựa trên tài liệu BE, kiểm tra description trước khi hiển thị.

Chỉ cập nhật hai path AI vào `docs/openapi.json`, giữ các contract khác. Chạy `npm run generate:api` để tái tạo operations/types/inventory; không sửa tay generated files.

## Giao diện

- `src/features/ai/AIChatBubble.tsx`: nút robot toàn website, popup bàn phím/Escape và trả focus qua Modal hiện có. Chat gửi lịch sử các lượt thành công, không gửi lời chào mặc định. Giữ hội thoại khi đóng/mở hoặc chuyển trang; reset khi đổi danh tính đăng nhập. Lịch sử chỉ ở React state.
- `src/features/ai/AITrainingPlanGenerator.tsx`: nhúng vào Dashboard MEMBER. Bearer lấy từ transport hiện có; khóa thao tác trong lúc tạo, không tự retry mutation. HTTP 400 dẫn đến `/member/profile` để điền mục tiêu/trình độ. Thành công hiển thị Markdown và làm mới query `training-plans` vì BE tự lưu kế hoạch.
- `src/pages/member/AIAssistantPage.tsx`: tái sử dụng hội thoại thật, bỏ trả lời giả lập theo từ khóa; không thêm route thừa.
- `src/shared/TrainingPlans.tsx`: kế hoạch đã lưu cũng hiển thị Markdown, giữ thao tác và quyền của coach/manager.
- Renderer lazy-load `react-markdown` + `remark-gfm`, không render HTML hoặc tải ảnh từ nội dung AI. Giữ CSS/design tokens hiện tại.

Dependencies đã ghi vào package.json/lock: `npm install react-markdown remark-gfm`. Máy khác dùng `npm ci` trong FE. App đã gắn bubble bên trong BrowserRouter; generator chỉ nằm trong dashboard thuộc route MEMBER.

## Kiểm thử và giới hạn

`npm run typecheck`, `npm test`, `npm run build`; `npm run test:ui -- ai.spec.ts design.spec.ts --workers=2`.
Browser tests dùng response fixtures để kiểm tra public chat, lịch sử/retry, Markdown, lỗi 400, bearer/no-body, điều hướng kế hoạch, chống gửi trùng, responsive 320–1920px và accessibility popup.

Không gọi tạo kế hoạch trên tài khoản production để tránh ghi dữ liệu thật. Khả năng sinh nội dung thực tế còn phụ thuộc cấu hình dịch vụ AI của BE; chat có thể trả 503 khi chưa cấu hình. Sau timeout/lỗi tạo kế hoạch, giao diện dẫn tới danh sách đã lưu để kiểm tra trước khi thử lại vì request có thể đã được BE xử lý.
