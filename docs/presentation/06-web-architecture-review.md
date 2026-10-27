# Đối chiếu và chỉnh sơ đồ kiến trúc Web

Hình gốc người dùng gửi đúng các công nghệ chính: React, TypeScript, Vite, TanStack Query, Socket.IO, Node.js, Express, Prisma, Mongoose, PostgreSQL, MongoDB, Cloudinary, SePay và Groq.

Các điều chỉnh của bản `06-web-architecture-corrected.png`:

- Nối Socket.IO Client với Socket.IO Server; TanStack Query phục vụ tải/cache dữ liệu HTTP, không phải điểm xuất phát của kênh Socket.IO.
- Ghi giao thức realtime là Socket.IO, sử dụng WebSocket / polling. Frontend hiện khai báo cả hai transport trong `FE/src/shared/Communication.tsx`.
- Thể hiện JWT cho cả REST và Socket.IO. `BE/src/modules/chat/chat.socket.ts` xác minh token tại handshake.
- Tách hướng gọi API/SDK từ backend ra ngoài và webhook SePay từ SePay về backend.
- Giữ Prisma → PostgreSQL và Mongoose → MongoDB.
- Thêm vai trò dữ liệu: MongoDB giữ định danh gốc, hồ sơ, refresh token; PostgreSQL giữ nghiệp vụ và bản chiếu định danh.
- Ghi rõ đồng bộ định danh thông qua backend service (`user-projection.service.ts`), không phải replication trực tiếp giữa hai database.
- Đặt tên là kiến trúc Web; Mobile được ghi chú dùng chung backend. Nhắc Email và Turnstile ở footer để tránh làm hình quá dày.
- Ghi mô hình backend Modular Monolith: các thành phần trong cùng ứng dụng, không phải các dịch vụ triển khai độc lập.

Đây là sơ đồ tổng quan kết hợp tech stack, chưa mô tả đầy đủ các module nghiệp vụ và mọi đường gọi nội bộ. Mũi tên hai chiều ở REST biểu diễn request/response, không phải server tự khởi tạo HTTP request về browser. Prisma và Mongoose nằm trong backend; các module nghiệp vụ gọi chúng để truy cập dữ liệu. Cloudinary tùy cấu hình có thể được thay bằng local uploads.

Phương pháp: chỉnh ảnh bằng công cụ imagegen tích hợp, dựa trên hình người dùng đính kèm; giữ ảnh gốc và lưu ảnh sửa thành file mới. Đã xem kết quả và đối chiếu hướng nối, nhãn giao thức, database và webhook.

Tóm tắt yêu cầu tạo ảnh: Giữ bố cục Frontend / Backend / Dịch vụ ngoài + SQL + NoSQL và phong cách xanh sage, nền trắng, thẻ tối của ảnh gốc; đổi thứ tự thẻ Frontend để Socket.IO Client nằm trên Socket.IO Server; sửa các kết nối và chú thích dữ liệu như danh sách trên; tăng độ tương phản và giữ chữ tiếng Việt rõ để dùng trong slide.
