# Nội dung chuẩn bị thuyết trình — Sports Center Management System

Phân tích mã nguồn trong workspace ngày 26/10/2026. Tên hiển thị trên web: **Pulse Sports Center**. Nội dung dưới đây mô tả code hiện có; không khẳng định các dịch vụ ngoài đang được cấu hình và chạy trên production.

## 1. Introduction — có thể đưa thẳng lên slide

**Sports Center Management System là hệ thống quản lý trung tâm thể thao đa cơ sở, kết nối quản trị viên, quản lý cơ sở, lễ tân, huấn luyện viên và hội viên trên một nền tảng chung. Hệ thống hỗ trợ quản lý gói tập, lớp học, lịch tập, đăng ký, điểm danh, thanh toán và báo cáo; đồng thời cung cấp ứng dụng web và mobile để người dùng theo dõi và thực hiện các hoạt động phù hợp với vai trò.**

### Bốn ý ngắn cho slide Introduction

- **Bài toán:** Đồng bộ thông tin hội viên, lịch học, phòng tập và giao dịch giữa các bộ phận, nhiều cơ sở.
- **Giải pháp:** Nền tảng Web + Mobile, dùng chung backend và dữ liệu nghiệp vụ.
- **Đối tượng:** Admin, Manager, Receptionist, Coach và Member.
- **Giá trị hướng đến:** Giảm thao tác thủ công, hỗ trợ điều phối nguồn lực, minh bạch giao dịch và giúp hội viên chủ động theo dõi việc tập luyện.

### Lời dẫn khoảng 40–50 giây

“Đề tài của nhóm là Sports Center Management System, một hệ thống hỗ trợ vận hành trung tâm thể thao có nhiều cơ sở. Khi số lượng hội viên và lớp học tăng lên, việc phối hợp giữa quản lý, lễ tân và huấn luyện viên cần một nguồn thông tin thống nhất. Hệ thống của nhóm kết nối các nghiệp vụ từ mua gói tập, đăng ký lớp, xem lịch, điểm danh đến thanh toán và báo cáo. Người dùng tương tác qua web hoặc ứng dụng mobile, với chức năng được phân theo năm vai trò. Ngoài các nghiệp vụ chính, hệ thống có chat thời gian thực, thông báo và trợ lý AI để hỗ trợ người dùng.”

Các lợi ích là mục tiêu thiết kế; chưa có số liệu đo lường để tuyên bố mức tiết kiệm thời gian hay cải thiện hiệu suất.

## 2. Tech stack BE, FE và Mobile

Hình sử dụng: **01-tech-stack.png** hoặc bản vector **01-tech-stack.svg**.

| Lớp | Công nghệ có trong code | Vai trò |
| --- | --- | --- |
| Web FE | React 19, TypeScript, Vite 6 | SPA và công cụ build |
| Điều hướng & dữ liệu Web | React Router 7, TanStack Query 5, Fetch API | Điều hướng theo role, tải/cache dữ liệu và gọi REST API |
| Giao diện Web | CSS thuần, Lucide React | Styling và icon; không thấy Tailwind trong dependencies của Web FE |
| Backend | Node.js, Express 5, TypeScript | REST API tại `/api/v1`, xử lý nghiệp vụ |
| Xác thực & validation | JWT, bcryptjs, Zod | Token, hash mật khẩu và kiểm tra request |
| SQL | PostgreSQL, Prisma 5 | Quan hệ và giao dịch nghiệp vụ |
| NoSQL | MongoDB, Mongoose 9 | Định danh, hồ sơ người dùng, refresh token |
| Realtime | Socket.IO 4 và Socket.IO Client | Chat và sự kiện realtime |
| Mobile | React Native 0.86, Expo 57, React 19, TypeScript | Client mobile, luồng chính cho Member và Coach |
| Mobile UI & data | Expo Router, NativeWind, TanStack Query, Axios | Điều hướng, styling và dữ liệu API |
| Mobile device | Expo SecureStore, Camera, QR libraries | Lưu thông tin phiên, quét và hiển thị QR |
| Thanh toán | SePay, VietQR | Checkout, chuyển khoản QR và webhook xác nhận |
| AI | Groq SDK | Trợ lý hỏi đáp với ngữ cảnh gói tập và lịch lớp |
| Media | Cloudinary hoặc local uploads, Multer | Upload avatar; file chat tải qua API có phân quyền |
| Email | Brevo / Resend / SMTP qua Nodemailer | Gửi OTP khôi phục mật khẩu, có cơ chế fallback theo cấu hình |
| CAPTCHA | Cloudflare Turnstile | Kiểm tra CAPTCHA trong luồng đăng nhập theo cấu hình |
| API docs & kiểm thử | Swagger/OpenAPI; Vitest; Playwright; script integration/E2E | Tài liệu API và các bộ kiểm thử có trong repository |

**Câu thuyết trình:** “Frontend web dùng React và TypeScript, backend dùng Node.js với Express. Hệ thống kết hợp PostgreSQL cho nghiệp vụ quan hệ và MongoDB cho định danh. Mobile dùng React Native và Expo, gọi cùng API với web. Các tính năng bổ sung gồm Socket.IO cho chat, SePay cho thanh toán và Groq cho trợ lý AI.”

Phiên bản trên lấy từ `package.json` và là phiên bản khai báo, không phải kết quả kiểm tra runtime/deployment. Không xác định phiên bản Node.js chỉ từ `@types/node`.

## 3. Architecture tổng quan

Hình sử dụng: **02-system-architecture.png** hoặc **02-system-architecture.svg**.

**Cách gọi phù hợp khi thuyết trình: Client–Server, backend Modular Monolith, tổ chức theo lớp trong từng module.** Đây là cách khái quát từ cấu trúc code: nhiều module nghiệp vụ cùng chạy trong một backend Express.

1. **Presentation:** Web React và Mobile Expo hiển thị giao diện theo vai trò.
2. **API & middleware:** Request đi qua xác thực JWT, phân quyền role, kiểm tra phạm vi cơ sở và validation tùy endpoint.
3. **Application/business:** `Routes → Controllers → Services`, chia module như classes, enrollments, attendance, payments và operations.
4. **Data access:** Services truy cập PostgreSQL qua Prisma và MongoDB qua Mongoose. Code không có một Repository layer thống nhất riêng; không cần thêm tầng đó vào sơ đồ.
5. **Integration:** Backend kết nối dịch vụ thanh toán, AI, email, lưu ảnh và CAPTCHA; SePay gọi webhook về backend.
6. **Realtime & jobs:** Socket.IO cùng HTTP server; job notification outbox và subscription lifecycle được khởi tạo trong tiến trình backend.

### Chi tiết quan trọng về hai database

- **MongoDB là nguồn định danh gốc:** User, MemberProfile, CoachProfile, ManagerProfile và RefreshToken có Mongoose models.
- **PostgreSQL lưu nghiệp vụ:** cơ sở, phân công nhân sự, gói tập, subscription, lớp, lịch, đăng ký, điểm danh, thanh toán, hóa đơn, chat, thông báo, yêu cầu hỗ trợ và audit log.
- **PostgreSQL cũng có User và Profile:** đây là bản chiếu định danh phục vụ quan hệ nghiệp vụ, được service `synchronizeUserProjection` đồng bộ từ MongoDB.
- Vì vậy, không nên nói “PostgreSQL chỉ có nghiệp vụ, hoàn toàn không có dữ liệu người dùng”, hoặc “chat được lưu trong MongoDB”.
- Đồng bộ đi qua code backend, không có bằng chứng về replication trực tiếp giữa hai database hay distributed transaction bao trùm cả hai.

**Câu thuyết trình:** “Hệ thống có hai client là web và mobile, cùng sử dụng một backend. Backend được chia theo module nghiệp vụ nhưng triển khai trong cùng một ứng dụng. Mỗi request được kiểm tra quyền và phạm vi cơ sở trước khi xử lý. MongoDB quản lý định danh; PostgreSQL giữ các quan hệ và giao dịch nghiệp vụ. Các tích hợp bên ngoài được gọi từ backend.”

Đây là sơ đồ kiến trúc logic. Không thêm API Gateway, Redis, Kafka, Kubernetes, microservices hay cụm server vì chưa thấy các thành phần đó trong phần code đã đối chiếu. Các kết nối REST đi theo request/response; mũi tên trên hình tổng quan thể hiện hướng gọi chính. Nhánh webhook nét đứt là SePay, không phải mọi dịch vụ ngoài.

## 4. Use case bậc 1 theo actor

Mỗi actor nối trực tiếp đến use case. Không phân rã thành thêm/sửa/xóa; không dùng `include` hoặc `extend` để mô tả CRUD. Các nhóm được chia thành ba hình để dễ đọc trên màn hình thuyết trình. Biên hệ thống được lặp lại cho từng actor để bố cục gọn, vẫn là cùng một hệ thống.

| Actor | Use case bậc 1 |
| --- | --- |
| **Admin** | Quản lý người dùng; Quản lý cơ sở & phân công; Quản lý danh mục gói tập; Quản lý bộ môn; Quản lý phòng tập & lớp học; Xem lịch hoạt động; Xử lý nghỉ phép & hỗ trợ; Xem tổng quan & nhật ký |
| **Manager** | Quản lý nhân sự cơ sở; Quản lý phòng tập; Quản lý lớp học; Điều phối lịch & huấn luyện viên; Quản lý chuyên cần; Xử lý nghỉ phép; Xử lý yêu cầu hỗ trợ; Xem báo cáo cơ sở |
| **Receptionist** | Quản lý hồ sơ hội viên; Đăng ký & gia hạn gói tập; Bán gói tại quầy; Hỗ trợ đăng ký lớp; Xem lịch lớp học; Theo dõi & hỗ trợ chuyên cần; Xử lý thanh toán & hóa đơn; Xử lý yêu cầu hỗ trợ |
| **Coach** | Xem lịch dạy; Xem lớp & học viên phụ trách; Điểm danh học viên; Tạo QR điểm danh; Gửi yêu cầu nghỉ phép; Xem đánh giá của hội viên |
| **Member** | Quản lý gói tập cá nhân; Đăng ký lớp & danh sách chờ; Xem lịch tập & lớp đã đăng ký; Điểm danh & check-in cơ sở; Thanh toán & xem hóa đơn; Đánh giá huấn luyện viên; Gửi yêu cầu hỗ trợ |
| **Guest** | Xem giới thiệu trung tâm; Đăng ký tài khoản; Đăng nhập / khôi phục mật khẩu; Hỏi trợ lý AI |

Các chức năng dùng chung cho role đã đăng nhập: **đăng nhập/đăng xuất, quản lý hồ sơ cá nhân, chat, nhận thông báo và hỏi trợ lý AI**. Chúng được ghi chú trên hình để tránh lặp nhiều đường nối. “Dùng chung” nói về nhóm tính năng, không có nghĩa mọi role được xem mọi cuộc trò chuyện hay mọi thông báo.

Guest là actor chưa đăng nhập, không phải role thứ sáu trong database. Các nhà cung cấp như SePay là actor hệ thống bên ngoài nếu cần sơ đồ UML đầy đủ; bộ hình này tập trung vào actor con người, còn các dịch vụ được vẽ ở sơ đồ architecture.

### Phạm vi và lưu ý khi bảo vệ

- **Admin:** quản trị toàn hệ thống. Tuy có cơ chế kế thừa một số quyền Manager/Receptionist ở middleware, code có giới hạn riêng theo endpoint và service; không nên kết luận Admin được làm mọi thao tác.
- **Lịch hoạt động:** Admin và Receptionist xem; Manager tạo, sửa, hủy và hoàn thành lịch. Route dùng `authorizeExact("MANAGER")`; FE đặt lịch ở chế độ read-only với Admin/Receptionist.
- **Manager:** vận hành trong phạm vi cơ sở được phân công. `app.ts` chặn role này truy cập nhóm `/members`, `/subscriptions`, `/invoices`; không đưa “quản lý hội viên toàn hệ thống” hay “quản lý danh mục gói tập” vào use case của Manager.
- **Receptionist:** quản lý hồ sơ hội viên và đăng ký/gia hạn gói cho hội viên, khác với quản lý danh mục sản phẩm gói tập của Admin.
- **Coach:** chỉ lớp và buổi dạy thuộc phạm vi được phép; “điểm danh học viên” không phải quản lý chuyên cần toàn hệ thống.
- **Member:** thao tác trên dữ liệu và đăng ký của mình. Điểm danh buổi học và check-in cơ sở là hai nghiệp vụ khác nhau, được gom nhãn để slide gọn.
- **Nghỉ phép Receptionist:** backend có API gửi yêu cầu cho Coach/Receptionist, nhưng navigation Web Receptionist hiện không có màn nghỉ phép riêng. Bộ hình ưu tiên tính năng người dùng tiếp cận trong portal hiện tại, nên chỉ vẽ gửi yêu cầu nghỉ phép cho Coach.
- **Check-in tại quầy:** backend có API facility-visits cho Manager/Receptionist, nhưng route `/receptionist/checkin` hiện chuyển về dashboard. Hình Receptionist chỉ ghi theo dõi/hỗ trợ chuyên cần; hình Member thể hiện check-in cơ sở đang có màn riêng.
- Một số API cũ có thể khai báo quyền rộng hơn portal hiện tại; các hình là tổng hợp use case trình bày, không thay thế ma trận phân quyền endpoint.

## 5. Gợi ý thứ tự đưa vào slide

1. **Introduction:** mô tả hệ thống, bài toán, đối tượng và mục tiêu.
2. **Tech stack:** dùng hình 01, trình bày Web → BE → Mobile → Data & integrations.
3. **Architecture:** dùng hình 02, giải thích từ client qua backend đến database và dịch vụ ngoài.
4. **Use case quản trị:** dùng hình 03, phân biệt Admin toàn hệ thống và Manager theo cơ sở.
5. **Use case vận hành:** dùng hình 04, phân biệt lễ tân và huấn luyện viên.
6. **Use case người dùng:** dùng hình 05, nói về hành trình Guest → Member.

Các ảnh có kích thước **1600 × 900 (16:9)**, nền sáng. PNG dùng để chèn nhanh; SVG dùng khi cần phóng to. Nội dung hình bằng tiếng Việt, tên actor và công nghệ giữ nguyên để dễ đối chiếu code. `diagrams.md` chứa Mermaid để chỉnh sửa cấu trúc; `generate_visuals.py` chứa dữ liệu và bố cục SVG có thể tái tạo.

## 6. Căn cứ trong code

Các liên kết dưới đây trỏ đến file nguồn của repository, không dựa riêng vào README cũ.

| Nội dung | File đối chiếu |
| --- | --- |
| Tech stack và phiên bản khai báo | [BE/package.json](../../BE/package.json), [FE/package.json](../../FE/package.json), [MOBILE/package.json](../../MOBILE/package.json) |
| Entry point, module API và giới hạn Manager | [BE/src/app.ts](../../BE/src/app.ts) |
| HTTP server, Socket.IO và background jobs | [BE/src/server.ts](../../BE/src/server.ts) |
| MongoDB identity và role | [User.ts](../../BE/src/models/User.ts), các profile trong `BE/src/models/`, [auth.service.ts](../../BE/src/modules/auth/auth.service.ts) |
| PostgreSQL và dữ liệu nghiệp vụ | [schema.prisma](../../BE/prisma/schema.prisma) |
| Đồng bộ định danh MongoDB → PostgreSQL | [user-projection.service.ts](../../BE/src/modules/users/user-projection.service.ts) |
| Quyền role và phạm vi cơ sở | [authorize.ts](../../BE/src/middlewares/authorize.ts), [facilityScope.ts](../../BE/src/middlewares/facilityScope.ts), [prisma.ts](../../BE/src/config/prisma.ts) |
| Điều hướng các role Web | [RoleRouter.tsx](../../FE/src/app/RoleRouter.tsx), [roles.ts](../../FE/src/app/roles.ts) |
| Admin / Manager | [AdminLayout.tsx](../../FE/src/features/manage/AdminLayout.tsx), [ManagerLayout.tsx](../../FE/src/features/manage/ManagerLayout.tsx) |
| Receptionist / Coach / Member | [ReceptionLayout.tsx](../../FE/src/features/reception/ReceptionLayout.tsx), [CoachLayout.tsx](../../FE/src/features/coach/CoachLayout.tsx), [UserLayout.tsx](../../FE/src/features/user/UserLayout.tsx) |
| Quyền thay đổi lịch | [class-schedules.routes.ts](../../BE/src/modules/class-schedules/class-schedules.routes.ts), [ResourcePage.tsx](../../FE/src/features/manage/ResourcePage.tsx) |
| Chat & thông báo dùng chung | [PortalLayout.tsx](../../FE/src/shared/PortalLayout.tsx), [chat.socket.ts](../../BE/src/modules/chat/chat.socket.ts), [notifications.routes.ts](../../BE/src/modules/notifications/notifications.routes.ts) |
| Thanh toán và webhook | [payments.routes.ts](../../BE/src/modules/payments/payments.routes.ts), [sepay-payments.service.ts](../../BE/src/modules/payments/sepay-payments.service.ts) |
| AI, email và media | [ai.service.ts](../../BE/src/modules/ai/ai.service.ts), [mailer.ts](../../BE/src/utils/mailer.ts), [avatarStorage.ts](../../BE/src/utils/avatarStorage.ts) |
| Nghỉ phép, hỗ trợ, bán gói tại quầy | [operations.routes.ts](../../BE/src/modules/operations/operations.routes.ts) |
| Luồng Mobile và giới hạn route | [MOBILE/app/_layout.tsx](../../MOBILE/app/_layout.tsx), [routes.ts](../../MOBILE/navigation/routes.ts) |

Phạm vi kiểm tra: đọc dependency, entry point, schema/model, middleware, route và portal; kiểm tra hiển thị các hình xuất. Không chạy giao dịch, test E2E hay gọi dịch vụ production trong tác vụ chuẩn bị tài liệu này.
