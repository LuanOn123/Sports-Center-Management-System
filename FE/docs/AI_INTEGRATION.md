# Tích hợp AI — cập nhật 04/10/2026

BE chỉ giữ `POST /ai/chat`, public, body `{ message, history: [{ role, content }] }`, trả `data.reply`. FE tiếp tục dùng AIChatBubble, AIAssistantPage và Markdown renderer. Hội thoại chỉ lưu trong React state và reset khi đổi danh tính.

Module tạo kế hoạch tập luyện đã được xóa cùng trang, menu, nút dashboard, service và contract liên quan. Snapshot `ai-openapi-2026-10-02.json` là tài liệu lịch sử trước thay đổi, không phải contract đang dùng.

Contract hiện hành: `docs/openapi.json`, đối chiếu Swagger của BE local. `/ai/chat` được đánh dấu `security: []` theo route public của BE (Swagger local thiếu khai báo này). Dependencies Markdown vẫn cần cho AI chat; chạy `npm ci` để đồng bộ thư viện.

Kiểm tra: `npm run typecheck`, `npm test`, `npm run build`, Playwright `ai.spec.ts` và `backend-sync.spec.ts`. Dữ liệu kiểm thử được mock; dịch vụ AI thật phụ thuộc cấu hình BE.
