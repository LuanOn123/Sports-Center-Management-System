# Reception audit — 09/10/2026

## Audit trước sửa

1. Menu hiện tại: Tổng quan, Hội viên, Gói thành viên, Bán gói tại quầy, Đăng ký lớp, Lịch lớp học, Thanh toán, Hỗ trợ.
2. Base route thực tế là `/receptionist`; một số route cũ redirect về dashboard/classes. Chưa có attendance route.
3. Reception dùng MemberPicker, SchemaForm, Table, Modal và các page riêng trong features/reception.
4. Public `/auth/register` chỉ tạo Member; source hiện có thêm POST `/members` dành cho lễ tân nhưng FE chưa dùng.
5. Subscription là quyền lợi toàn hệ thống, facilityId là cơ sở phát hành; không được dùng origin để tính quyền lợi học ở cơ sở khác.
6. Counter order dùng Payment và activateSubscriptionForPayment, xác nhận trong transaction; không cần payment system mới.
7. Attendance liên kết MemberProfile và ClassSchedule; Enrollment liên kết từng member/session, có BOOKED/COMPLETED/CANCELLED.
8. Legacy analytics dùng FIXED allowance hoặc rolling 10. Source có API Reception mới theo 20%/30% nhưng tính sai các buổi không đăng ký và buổi chưa chốt.
9. Một lớp có nhiều session; phải lấy các session member thực sự đăng ký, không suy toàn bộ lịch lớp thành lịch của member.
10. Notification có metadata, hỗ trợ ATTENDANCE_WARNING; cần khóa để chống duplicate cùng member/class/facility.
11. Chat có contact, conversation, private messages, attachment, socket; FE dùng shared Communication.
12. Chat hiện kiểm tra role, chưa ràng buộc đầy đủ contact theo facility.
13. Staff dùng FacilityStaff; Reception middleware hiện chấp nhận context client nếu có assignment; helper fallback findFirst chưa phát hiện ambiguous assignment.
14. Member có enrollment/visit/payment và subscription origin; list Mongo hiện trả global nên cần giới hạn dữ liệu vận hành, giữ tìm kiếm đăng ký hợp lệ.
15. Issue có requesterId/requesterRole và JSON description, phù hợp báo cáo chuyên cần khi validate chặt loại báo cáo và payload.
16. Manager `/manager/issues` là nơi duyệt phù hợp; chỉ thêm hành động báo cáo chuyên cần.
17. Dự kiến sửa: Reception attendance/member actions, attendance service/controller/routes, facility scope, Manager issue review, contract/docs/tests; tái sử dụng UI/API hiện hữu.

Theo yêu cầu bổ sung mới nhất, giữ tab Hội viên và bổ sung chức năng xem điểm danh theo từng hội viên/lớp.

## Báo cáo triển khai theo yêu cầu bổ sung

### 1. Kiến trúc

Frontend React/TypeScript, React Query, React Router, feature-based. Base Reception là `/receptionist`; dùng lại PortalLayout, MemberPicker, Modal, ErrorState, Loading và API client.

### 2. File thay đổi cho chuyên cần

- FE: `features/reception/attendance/AttendancePage.tsx`, `attendance.css`, `members/MembersPage.tsx`, `ReceptionLayout.tsx`.
- Manager: `features/operations/AttendanceReportReview.tsx`, `OperationsPage.tsx`.
- BE: `modules/attendance/reception-attendance.service.ts`, re-export trong attendance.service, controller/routes; facilityScope, operations.routes, enrollments.service.
- Contract: operations-openapi.ts, FE generated operations/types/OpenAPI inventory.
- Tests: receptionAttendance.test.ts, browser/reception-attendance.spec.ts, BE/tests/reception-isolation.integration.ts; runner cô lập được mở rộng nhận tên suite.

### 3. Navigation trước và sau

Thêm Chuyên cần sau Hội viên. Giữ các mục đang hoạt động. Trong Hội viên: chọn hội viên → Xem điểm danh → danh sách lớp → Xem chi tiết.

### 4. Route

Thêm `/receptionist/attendance`. Không xóa route hiện có trong đợt bổ sung này.

### 5. Phân quyền cơ sở

Reception và Manager phải có đúng một phân công đang hoạt động tại cơ sở đang hoạt động. Server lấy cơ sở từ DB; context/header/query/body khác cơ sở bị từ chối. Monitoring/detail kiểm tra Enrollment và Class trong cơ sở, không chỉ kiểm tra classId tồn tại. Các endpoint mới dùng authorizeExact.

### 6. Tạo tài khoản

Không viết lại luồng tạo tài khoản trong đợt chuyên cần. FE hiện vẫn dùng `/auth/register`. POST `/members` có sẵn trong working tree cần review riêng trước khi chuyển FE sang dùng.

### 7. Role đặc quyền

Chuyên cần không có API cấp role. Chỉ Reception gửi báo cáo, chỉ Manager quyết định; không có quyền Admin kế thừa ngầm trên các endpoint mới.

### 8. Đăng ký

Giữ MemberPicker và luồng đăng ký lớp hiện hữu. Luồng gộp Find/Create → gói → thanh toán chưa được tái tổ chức trong đợt này.

### 9. Subscription

Tái sử dụng getMembershipCoverageIntervals/isCoveredAt. Gói GLOBAL: cơ sở phát hành gói khác cơ sở học vẫn hợp lệ. Gói SUSPENDED/CANCELLED giữ quyền lợi lịch sử tới suspendedAt/cancelledAt.

### 10. Thanh toán

Không thay đổi payment/activateSubscriptionForPayment. Không tạo payment system mới, không thực hiện giao dịch thật để kiểm thử.

### 11. Logic chuyên cần cũ

Analytics cũ dùng FIXED allowance/RECURRING rolling. Các API Reception mới trong working tree trước sửa đã dùng 20/30 nhưng đếm cả lịch không đăng ký, làm tròn trước phân loại và suy buổi chưa ghi nhận thành vắng. Đã thay phần Reception bằng module riêng; chưa thay toàn bộ analytics/scanner dùng bởi role khác.

### 12. Công thức

absenceRate = absentCount / totalRelevantClassSessions × 100; tổng bằng 0 thì tỷ lệ 0, NORMAL. So sánh ngưỡng bằng số nguyên trước khi làm tròn hiển thị để không đẩy 29,997% lên VIOLATION chỉ vì UI hiển thị 30%.

### 13. Buổi đủ điều kiện

Enrollment của đúng member/class, status BOOKED hoặc COMPLETED, schedule không CANCELLED; bookedAt không sau thời điểm bắt đầu, nằm trong lịch sử quyền lợi gói. EXCUSED hiển thị riêng và loại khỏi mẫu số. Mẫu số gồm các đăng ký đủ điều kiện tương lai và chưa có kết quả. ABSENT mới tính vắng; thiếu bản ghi là NOT_RECORDED. PRESENT/LATE tính đã tham gia. Không lấy toàn bộ schedule của lớp làm lịch học của mọi hội viên.

### 14. Cảnh báo 20%

NORMAL dưới 20%; WARNING từ 20% tới dưới 30%. Lễ tân xác nhận gửi thông báo; server tính lại. Khóa advisory trên transaction thực, khóa theo facility/member/class; yêu cầu lặp trả alreadySent. UI vô hiệu hóa gửi lại sau thành công.

### 15. Vi phạm 30%

Từ 30%: VIOLATION. Yêu cầu lý do 5–1000 ký tự, không tự hủy lớp. Chặn báo cáo trùng khi đang chờ hoặc đã duyệt hủy.

### 16. Báo cáo

Tái sử dụng Issue với requesterId/requesterRole từ phiên đăng nhập và payload ATTENDANCE_VIOLATION được validate. Snapshot chứa đúng hội viên/lớp và số liệu lúc gửi. Generic support POST/PUT/PATCH/DELETE không được dùng để giả mạo hoặc xử lý báo cáo chuyên cần hợp lệ.

### 17. Manager review

Trong màn hình Yêu cầu của Manager, hiển thị snapshot đọc được và lựa chọn giữ hội viên/hủy đăng ký, yêu cầu lý do. Dedicated endpoint kiểm tra cơ sở, loại báo cáo, member/user tương ứng, trạng thái chờ; kiểm tra lại ngưỡng khi duyệt hủy để chống quyết định theo số liệu đã thay đổi.

### 18. Hủy đăng ký

Chỉ Manager duyệt: hủy BOOKED tương lai ở đúng lớp, giữ Attendance và Enrollment quá khứ. Khóa member quota/class dùng chung với booking. Booking/transfer qua assertCanBook bị chặn đăng ký lại lớp đã có báo cáo được duyệt. Từ chối báo cáo giữ nguyên đăng ký.

### 19. Chat authorization

Đã audit: hiện chủ yếu kiểm tra role, cần tiếp tục rà soát facility/contact/message/attachment/socket. Không tuyên bố đã hoàn tất bảo mật chat trong đợt xem điểm danh này.

### 20. Thông tin hội viên

Thông tin lớp/chuyên cần được thêm vào tab Hội viên theo yêu cầu mới nhất. Chưa tích hợp panel thông tin vào cửa sổ chat.

### 21. Backend dùng chung

Siết Reception facility scope, bảo vệ Issue chuyên cần khỏi luồng hỗ trợ thường, bổ sung booking guard sau quyết định Manager. Không đổi API ghi nhận điểm danh của Coach, không thêm quyền ghi điểm danh cho Reception.

### 22. Giữ nguyên có chủ đích

Branding/theme, business thanh toán, public registration, history, routes chức năng hiện hữu. Không migrate/deploy database ứng dụng, không push code.

### 23. Kiểm thử

FE: typecheck, 90 unit tests, build đạt; BE build và kiểm tra TypeScript đạt. Bộ UI chuyên cần: 11 tests đạt, gồm Manager review; 8 viewport 320/375/430/768/1024/1280/1440/1920, axe trong modal, lọc, đọc chi tiết, xác nhận gửi cảnh báo, Escape và khôi phục focus. Đã kiểm tra ảnh render và mở rộng modal desktop lên 1100px; table cuộn ngang trên mobile. API contract audit: không thiếu endpoint FE; POST /members là BE-only.

Full browser suite lần đầu: 190/203 đạt, 11 test dùng nhãn/luồng Reception cũ và 2 test timeout. Đã cập nhật selector/luồng xác nhận cho đúng ClassesPage hiện có, chạy lại 12/13 đạt; test booking còn lại được sửa selector xác nhận/hủy và đã đạt trong lượt 19/19 tests Reception + chuyên cần. Hai timeout cũng đạt khi chạy lại tuần tự. Thêm một test Manager review mới; không tuyên bố có một lượt chạy toàn bộ 204 test sạch từ đầu. Sau chỉnh CSS modal, chạy lại riêng 11/11 test chuyên cần đạt.

### 24. Security/IDOR

Suite HTTP thật dùng PostgreSQL schema và Mongo database có tên ngẫu nhiên riêng; runner tự dọn. Kiểm tra khác cơ sở, member không đăng ký trong lớp, role Member/Reception trái quyền, metadata cơ sở giả, concurrent warnings/reports, bypass Issue, quyết định lặp, stale attendance và bảo toàn lịch sử. Lần chạy đầu phát hiện advisory lock chạy ngoài transaction nên gửi trùng; đã sửa dùng tx.$executeRaw. Lượt tiếp theo xác nhận hai yêu cầu đồng thời chỉ tạo một warning và một report. Một lượt bị đóng kết nối DB từ xa; một assertion đã được sửa để chấp nhận cả 403/404 cho IDOR vì DAL chủ động trả 403.

Lượt cuối `node tests/run-manager-isolation.mjs reception` đạt, exit 0: Reception không ghi Attendance; cross-facility bị chặn; global entitlement đọc đúng; warning/report chống trùng; không giả mạo/xóa/duyệt qua Issue thường; chỉ Manager duyệt; REJECT giữ 2 đăng ký tương lai; sửa chuyên cần xuống dưới 30% làm APPROVE_REMOVAL trả 409; phục hồi số liệu rồi duyệt hủy 2 buổi tương lai, giữ 7 Attendance quá khứ; booking lại bị chặn đúng lý do chuyên cần; quyết định lần hai trả 409. PostgreSQL schema/Mongo database thử đều được dọn. Có thể chạy lại bằng `npm run test:reception:isolation --prefix BE`.

### 25. Việc còn lại và triển khai

- Cần triển khai BE cùng FE để có đủ 5 endpoint và validation mới; báo cáo này không xác nhận API production đã cập nhật. Requester schema cần các migration đã có trong working tree từ đợt Manager.
- Legacy analytics/scanner/penalty của các role khác vẫn dùng policy cũ. Cần một đợt thống nhất chính sách toàn hệ thống; không tự đổi quyền/luồng của các role đó trong chức năng xem điểm danh này.
- Chat facility authorization/info panel, gộp registration workflow và global Member search cần xử lý tiếp theo yêu cầu audit rộng.
- Monitoring hiện lọc/phân trang sau khi dựng aggregation từ Enrollment; với quy mô lớn cần aggregation DB hoặc cache/incremental summary. Không dùng memo hóa frontend để che chi phí API.
- Kiểm thử UI dùng API fixtures; kiểm thử HTTP cô lập là bằng chứng logic backend riêng, không thay cho nghiệm thu dữ liệu thật và triển khai production.
