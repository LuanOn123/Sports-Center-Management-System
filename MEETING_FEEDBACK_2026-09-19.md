# Họp triển khai feedback — 19/09/2026

Tài liệu chuẩn bị họp, **chưa phải các quyết định đã được nhóm thông qua**. Nguồn: `feedback_18.9.2026.txt`, bản phân công 5 member và Swagger production kiểm tra lúc 18:07 ICT ngày 19/09/2026. Buổi họp đề xuất 90 phút tối nay, ví dụ 20:00–21:30 nếu cả nhóm rảnh.

## 1. Kết quả kiểm tra Swagger

- Hiện có **60 paths / 85 operations**. So với bản kiểm tra ngày **18/09**: thêm đúng **7 operations**, không xóa operation nào. `PATCH /auth/me` và `POST /auth/register` thay đổi schema/validation.
- So với snapshot FE `FE/docs/openapi.json` (66 operations): thêm **19 operations**. Cần phân biệt mốc so sánh để không báo nhầm 19 API đều được thêm hôm nay.
- Swagger là mô tả hợp đồng, chưa chứng minh quyền của từng role hay các quy tắc xung đột hoàn chỉnh. Chưa thử các mutation production vì không có tài khoản kiểm thử được cấp.

| API thêm sau 18/09 | Feedback liên quan | Mức hỗ trợ thực tế |
| --- | --- | --- |
| `PATCH /class-schedules/{id}/complete` | Kết thúc buổi học | Có: mô tả chỉ cho hoàn tất sau `endTime`. Chưa có quy trình nghỉ, dạy bù hoặc đổi coach. |
| `GET /reports/subscription-logs` | Lịch sử mua/gia hạn gói | Có log tên, email, gói, giá, trạng thái thanh toán, ngày hiệu lực/mua và phân trang. **Không thấy nguồn đăng ký** member tự làm hay lễ tân làm trong ví dụ response. |
| `GET /notifications`, `GET /notifications/unread-count` | Thông báo lịch học | Có danh sách cá nhân và số chưa đọc; chưa thấy contract payload/example chi tiết. |
| `PATCH /notifications/{id}/read`, `PATCH /notifications/mark-all-read` | Đánh dấu đã đọc | Có. |
| `POST /notifications/trigger-upcoming-reminders` | Nhắc lớp sắp diễn ra | Có nút kích hoạt nhắc trong 24 giờ theo mô tả; cần xác nhận role được gọi và chống kích hoạt lặp. |

**Đã có từ 18/09, không phải API mới hôm nay:** `GET/POST/PATCH /attendance` theo `scheduleId`, Chat, Training Plans. Attendance hiện là **điểm danh theo buổi học**, chưa phải check-in vào trung tâm nói chung. API điểm danh thiếu summary, `required`, security và schema response/error đầy đủ. Backend trả `401` khi gọi không token; quyền STAFF/COACH vẫn cần test có token thật.

**Swagger hiện chưa cho thấy:** lịch lặp/tạo hàng loạt buổi học; nghỉ/dạy bù/đổi coach theo từng buổi; phân công nhân viên vào lớp; điều kiện đổi gói; hoàn tiền/chuyển suất; lưu nguồn đăng ký; dữ liệu sức chứa theo từng buổi/waitlist; QR/Bluetooth/cầu nối extension→web desktop; báo cáo điểm danh/xuất XLSX; Support Request. `POST /class-schedules` hiện chỉ tạo **một buổi** với `classId`, `roomId`, `startTime`, `endTime`; `POST /classes` không có `roomId` hay `staffId`, đúng mô hình lớp có nhiều buổi ở các phòng khác nhau nếu nhóm chốt như vậy. `GET /class-schedules` hiện xem theo bộ lọc ngày/lớp/phòng/trạng thái nhưng chưa phải API calendar định kỳ.

## 2. Những câu cần chốt trong buổi họp

M1 ghi mỗi câu trả lời thành một dòng: **quy tắc, ví dụ, người quyết định, ngày hiệu lực, API/DB ảnh hưởng**. Không chốt ngầm bằng hành vi FE.

| Chủ đề | Câu hỏi cần trả lời và tình huống mẫu | Quyết định đề xuất để thảo luận |
| --- | --- | --- |
| Môn–lớp–phòng | Lớp A đổi phòng ở buổi thứ ba? Hai môn dùng chung phòng nhưng khác giờ? | Phòng gắn vào **buổi học**, không gắn cứng với môn. Backend kiểm tra trùng phòng theo khoảng thời gian. |
| Lớp và lịch | “Lớp học” là khóa kéo dài nhiều buổi; “lịch hoạt động” là từng buổi hay mẫu lặp? Ai tạo số buổi, ngày kết thúc, ngoại lệ ngày lễ? | Chốt mô hình Class, Schedule, recurring series/exception trước khi thiết kế calendar. |
| Coach/staff | Coach nghỉ một buổi hoặc đổi người dạy: thay assignment lớp hay chỉ buổi? Nhân viên ở lớp có quyền gì? | Tách người dạy mặc định của lớp khỏi người thực dạy từng buổi; staff assignment cần quyền rõ. |
| Trùng lịch & sức chứa | Một member đăng ký hai buổi giao nhau; buổi đang diễn ra có nhận thêm người? Giảm capacity dưới số đã đăng ký? | Backend là nguồn quyết định, trả lỗi xung đột có mã lý do; FE chỉ giải thích và chặn thao tác rõ ràng. |
| Membership | Một user giữ 2 gói ACTIVE? Gói hết hạn trong lúc đã book? Upgrade/downgrade tính tiền và ngày hiệu lực thế nào? Tắt/xóa plan cũ ảnh hưởng subscription đã mua ra sao? | Chốt ma trận `FREE/MEMBERSHIP/PREMIUM`, quyền lớp, gia hạn, chuyển hạng, chồng gói và hiệu lực lịch sử. |
| Hủy/hoàn/chuyển suất | Hủy trước bao lâu, hoàn bao nhiêu, hoàn vào đâu; đã điểm danh có hủy được không; chuyển cho ai và có cần đồng ý? | Viết policy bằng số cụ thể và ví dụ trước khi FE hiển thị nút hoặc BE xử lý tiền. |
| Nguồn đăng ký | Member tự đăng ký web/mobile hay STAFF làm hộ; đo marketing theo nguồn nào? | Lưu `source/channel` và `createdBy` trên sự kiện booking/subscription, không suy từ role người xem log. |
| Điểm danh QR/Bluetooth | Quét gì (mã member, mã buổi, thiết bị BLE), ai quét, ở đâu, mỗi mã sống bao lâu, offline/trùng quét xử lý thế nào? | Quét chỉ tạo trạng thái **chờ xác nhận**, không tự ghi `PRESENT`; sau xác nhận backend mới lưu điểm danh. |
| Báo cáo Excel | Member04 đã làm file nào, sheet/cột/ID tương ứng với API nào, ai được xuất? | Demo file thật và chốt mẫu XLSX; phân biệt báo cáo subscription mới có API với báo cáo attendance chưa có API. |

## 3. Agenda đề xuất — 90 phút

| Phút | Người dẫn | Kết quả phải có |
| --- | --- | --- |
| 0–10 | M1 | Nhắc phạm vi, đọc 3 flow bắt buộc, ghi vấn đề chưa rõ thành decision log. |
| 10–25 | M1 + M2 + M5 | Chốt quan hệ Sport→Class→Schedule→Room; coach/staff theo lớp/buổi; “Lớp học” khác “Lịch hoạt động”; calendar và lịch lặp. |
| 25–45 | M1 + M2 + M3 + M4 | Chốt membership: hạng/quyền, hết hạn, chồng gói, đổi hạng, tắt plan, nguồn đăng ký. |
| 45–60 | M2 + M3 + M4 + M5 | Chốt booking: trùng lịch, sức chứa, late join, hủy/hoàn/chuyển suất; đưa ra ít nhất 5 case cụ thể. |
| 60–75 | M2 + M3 + M4 + M5 | Mở `attendance.html` và file Excel Member04; xác định QR/BLE chỉ prototype hay yêu cầu sprint, data path extension→desktop→API→report. |
| 75–85 | M2 + M3 | Walkthrough Swagger gap: 7 API mới, thiếu contract/permission, thứ tự API trước UI. |
| 85–90 | M1 | Đọc lại quyết định, owner, deadline, blocker; giao action mở PR/tài liệu; đặt lịch review ngắn tiếp theo. |

**Quy tắc giữ đúng giờ:** không tranh luận thiết kế chi tiết hơn 5 phút khi thiếu dữ kiện; ghi `OPEN` + owner + thời hạn, tiếp tục agenda. Sau họp M1 gửi bản decision log cho cả nhóm qua kênh nhóm của họ.

## 4. Phân công theo ownership gốc

| Member | Việc sau họp | Bàn giao có thể kiểm tra | Phụ thuộc |
| --- | --- | --- | --- |
| **M1 — Leader / Manager Web** | Chốt requirement, permission matrix, ERD/API với M2; UI lớp/lịch/gói/báo cáo manager; điều phối tích hợp và demo. | Decision log, use cases, backlog ưu tiên, màn manager theo API được duyệt. | M2 policy + API; M5 wireframe. |
| **M2 — Backend** | Thiết kế quy tắc room/coach/member conflict, capacity, membership overlap/expiry/upgrade, booking/cancel/refund; Swagger/DB/validation/quyền; idempotency scan và attendance/report nếu được ưu tiên. | Bảng rule và mã lỗi, migration, OpenAPI có request/response/error/security/example, integration tests. | Quyết định nghiệp vụ từ M1/cả nhóm. |
| **M3 — Web / Reception** | Cập nhật form/UI chung theo review M5; flow reception đặt/hủy lớp và gói; thiết kế danh sách điểm danh buổi học với mục vừa quét nổi đầu sau khi backend xác nhận; phân biệt trạng thái chờ/quét thành công/thất bại. | Figma/reviewed UI, route reception có loading/error/confirm, test role STAFF, không tạo trạng thái điểm danh giả. | M2 attendance và bridge contract; M5 flow/quy tắc UI. |
| **M4 — Mobile Member** | UX xem lịch công khai/đăng ký/hủy theo policy, gói và nguồn MEMBER, lịch sử điểm danh; mang file Excel đã làm tới họp và đối chiếu cột với API. | Demo member flow + file XLSX mẫu + mapping cột/dữ liệu; API gaps ghi rõ. | M2 booking/membership/attendance/report. |
| **M5 — UI/UX / Coach / QA** | Wireframe calendar, lớp vs buổi, thay coach, nghỉ/dạy bù, điểm danh; review form toàn web/mobile; test edge cases và hỗ trợ quyết định QR/BLE về UX. | Prototype/Figma, test matrix conflict/expiry/capacity/role/mobile, QA checklist. | M1 rule, M2 API. |

Không chuyển nhiệm vụ viết Excel sang M3 chỉ vì màn desktop nằm ở Reception; M4 bàn giao artifact/mapping đã làm, M2 cung cấp dữ liệu server, M3 nối UI xuất theo phân công cuối cuộc họp.

## 5. Thứ tự triển khai sau khi chốt

1. **P0 — Contract/rules (M1+M2, M5 review):** đóng 9 dòng policy trên, đặc biệt tiền/hoàn và xung đột. Cập nhật Swagger, seed test users từng role, error codes, examples. Không code UI mutation mới khi hợp đồng chưa chốt.
2. **P0 — Flow bắt buộc:** M2 xử lý room/schedule/booking/membership trên server; M1/M3/M4 triển khai theo platform; M5 test. Demo hai hội viên tranh suất cuối, một member book hai buổi trùng, gói hết hạn, coach nghỉ, hủy có/không hoàn.
3. **P1 — Điểm danh buổi học:** M2 hoàn thiện API `GET/POST/PATCH /attendance` và quyền; M5 thiết kế; M3 reception + M5 coach, M4 member history. `PATCH /class-schedules/{id}/complete` chỉ sau `endTime` theo Swagger.
4. **P1 — Scan & đồng bộ:** chốt QR hay BLE hay cả hai sau prototype, rồi M2+M3 làm proof-of-concept với ID chuẩn, xác thực, chống quét trùng, ACK và đồng bộ sau mất mạng; M4 mapping/export Excel; M5 kiểm thử tại quầy. Đây là tích hợp riêng, **chưa có API/extension hiện hành**.
5. **P2 — Marketing/report/notifications:** M2 thêm nguồn đăng ký vào server và log/report nếu được phê duyệt; M1/M3/M4 hiển thị phù hợp. Dùng `GET /reports/subscription-logs` cho log mua gói; không gọi đó là báo cáo nguồn khi chưa có `source`.

### Chốt buổi họp bằng 5 dòng bắt buộc

```text
Quyết định số: …  Chủ đề: …  Rule và ví dụ: …
Owner: M…  API/DB/UI ảnh hưởng: …  Deadline: …
Trạng thái: DECIDED / OPEN / BLOCKED
Người review: …  Test chấp nhận: …
Link issue/PR/Figma/Swagger: …
```

## 6. Demo hiện có: `Desktop/New Folder/attendance.html`

File này dùng danh sách 4 sinh viên hard-code, mặc định tất cả là `present`; nút “Lưu Điểm Danh” chỉ `console.log` và `alert`, không gửi API. Không có mã QR, Bluetooth, browser extension, real-time socket hoặc cầu nối với FE. File trong `New Folder` hiện có một số bảng tính mẫu, nhưng repository chưa có artifact Excel báo cáo attendance của Member04 để xác minh. Trong họp cần M4 trình diễn đúng file và đường đi dữ liệu thay vì xem prototype HTML là đã tích hợp.

**Luồng cần nhóm chốt trước khi code:** scanner/extension nhận mã → xác thực dữ liệu + `scheduleId/memberId` → desktop nhận event chờ → người có quyền xác nhận → backend lưu điểm danh một lần → UI hiển thị trạng thái mới, đưa mục hiện tại lên đầu → báo cáo đọc dữ liệu server → xuất XLSX. Không gửi token đăng nhập qua QR/BLE. Cần thống nhất TTL mã, origin/permission extension, chống replay/trùng, offline và audit trước demo tích hợp.

## 7. Cập nhật từ `BE Mission.txt` — cần xác nhận hợp đồng triển khai

BE thông báo đã làm các phần dưới đây. Đây là **báo cáo từ BE**, chưa phải kết quả kiểm thử tích hợp FE. Lúc đối chiếu tài liệu, snapshot Swagger production lấy lúc 18:07 vẫn **chưa có** `generate-qr`, `scan-qr` hoặc `sportIds`; lần thử tải lại Swagger sau khi nhận tài liệu bị timeout, nên yêu cầu BE cung cấp URL môi trường/commit và mẫu response mới trước khi đổi FE.

| BE thông báo | Ảnh hưởng và việc cần chốt |
| --- | --- |
| `POST /attendance/generate-qr` cho Coach: `{scheduleId}` → token 1 phút; `POST /attendance/scan-qr` cho Member: `{qrToken}` → `PRESENT` nếu token hợp lệ và đã BOOKED. | Đây là **member tự quét QR của Coach**, khác luồng extension quét tại quầy Reception trong feedback. Chốt có cần cả hai không. Lấy schema response, auth/role, thời điểm được mở QR, chống quét lặp và thông báo lỗi. FE dùng thời hạn trả về từ server để làm mới QR trước khi hết hạn; xác nhận khi app nền/mất mạng. |
| Class–Sport đổi thành many-to-many; `POST/PATCH /classes` nhận `sportIds[]`, response trả `sports[]`; `GET /classes?sportId=...` giữ nguyên filter. | Đây là **breaking change**. M1/M3/M4 phải sửa form, type và mọi nơi hiển thị `class.sport`; dữ liệu cũ/migration/response shape cần kiểm thử. Không nhầm với yêu cầu **một phòng dùng cho nhiều môn**: quan hệ Class–Sport là câu hỏi nghiệp vụ khác. |
| BE nói booking trùng cả 5 phút trả `409` và nêu lớp bị trùng. | M2 cung cấp mã lỗi/payload ổn định; M3/M4 hiển thị lý do và giữ form. Xác nhận ranh giới thời gian `end == start`, `COMPLETED` có còn chặn đặt lịch tương lai không, timezone và race condition. |
| Gán/gỡ Coach ở Class tạo notification `COACH_CHANGED` cho member BOOKED ở các schedule SCHEDULED. | FE notification cần render type mới. Xác nhận đây là thay đổi **theo cả Class**, chưa phải thay coach một buổi hoặc dạy bù; tránh gửi nhiều thông báo khi gán rồi gỡ liên tiếp. |
| Mua gói chặn tier thấp hơn hoặc cùng tier thời hạn ngắn hơn; upgrade cộng nguyên ngày còn lại vào gói mới, gói cũ `SUSPENDED`, gửi notification. | M2 xác nhận tính ngày lẻ/múi giờ, giá tiền của ngày quy đổi, hiệu lực booking cũ, thanh toán thất bại/rollback, nhiều gói ACTIVE và quyền STAFF mua hộ. M3/M4 hiển thị lỗi BE và ngày hết hạn do BE trả, không tự tính ở FE. |

**Ảnh hưởng FE đã thấy trong repo:** `FE/src/types/member.ts` đang khai báo `ClassItem.sportId` và `sport`; các trang member Attendance, Browse, Class Detail, My Classes đang đọc `class.sport`; `FE/src/shared/generated.ts` và `FE/src/shared/operations.json` vẫn dùng `sportId` cho tạo/sửa Class; `SchemaForm` hiện render field đơn, chưa có chọn nhiều `sportIds`. Vì vậy đổi Class–Sport có thể làm form tạo/sửa lớp thất bại và mất nhãn môn trên màn member. Không cập nhật contract tự động dựa trên văn bản BE khi Swagger live chưa xác nhận.

**Điều chỉnh agenda:** dành 10 phút đầu phần walkthrough API (phút 75–85) cho BE demo 2 QR endpoints và response Class mới; nếu contract chưa sẵn, ghi blocker + owner M2 + thời hạn. Sửa lại quyết định điểm danh ở mục 2: luồng Coach QR→Member scan tự ghi `PRESENT` là một lựa chọn đã được BE triển khai theo lời BE; luồng Reception scanner→chờ xác nhận vẫn là yêu cầu riêng cần nhóm quyết định.
