# Manager audit — 08/10/2026

## Phase 0: trước khi sửa

1. Navigation/router: `FE/src/features/manage/ManagerLayout.tsx` có dashboard, members/coaches/staff, plans/sports/rooms/classes/schedules, planner, membership/payments/bookings/attendance/checkin, reports/roles/audit, requirements/slots/patterns/leave/issues. Users bị lọc khỏi menu; nhiều route vẫn mở độc lập.
2. UI: `ResourcePage`, `Dashboard`, `ActivityPlanner`, `OperationsPage`, các page Reception được dùng lại. Không sửa ReceptionLayout hoặc workflow Reception.
3. API: `/facilities`, `/facilities/:id/staff`, `/staff-candidates`, `/coaches`, `/rooms`, `/classes`, `/class-schedules`, `/leave-requests`, `/issues`, `/reports/revenue`. `/users` chỉ Admin.
4. Quan hệ nhân sự: PostgreSQL `FacilityStaff(userId, facilityId, role, isActive)`; identity gốc MongoDB, projection và quan hệ nghiệp vụ PostgreSQL.
5. Manager lấy cơ sở qua GET /facilities (lọc theo phân công). FE FacilityBoundary giữ lựa chọn sessionStorage, gửi X-Facility-Id. Middleware kiểm tra membership nhưng vẫn yêu cầu client chỉ định context.
6. Tạo Coach: users.service tạo Mongo User/CoachProfile và PostgreSQL projection, không tạo FacilityStaff. API phân công hiện upsert, không chặn duplicate hoặc phân công chéo cơ sở; staff-candidates trả cả người đã phân công.
7. Room có facilityId, capacity, areaType, isActive, capabilities; Class.defaultRoomId và ClassSchedule.roomId trỏ Room. Xóa phòng là deactivate có kiểm tra lịch tương lai; không đổi mô hình xóa.
8. Class thuộc facility, liên kết coaches qua ClassMember; ClassSchedule là session có start/end/room/coach. Bộ kiểm tra tài nguyên lịch đã kiểm tra cơ sở, sức chứa, chuyên môn, nghỉ phép và trùng lịch.
9. Activity Schedule dùng GET /class-schedules qua ResourcePage/ScheduleCalendar. Không cần nguồn dữ liệu mới.
10. LeaveRequest scope trực tiếp facilityId, hiện model chỉ có coachId. Manager/Admin duyệt; Coach gửi. Receptionist chưa có workflow nghỉ phép.
11. Issue scope trực tiếp facilityId; Member gửi; Manager/Receptionist/Admin xử lý. Không mở rộng workflow Receptionist trong task này.
12. Revenue dùng Payment.facilityId, Prisma middleware thêm predicate cho aggregate/count/groupBy/findMany. Membership là global; không suy cơ sở doanh thu từ gói hiện tại của hội viên.
13. JWT chỉ id/role; authenticate kiểm tra role/isActive trong Mongo. auth/me chưa trả assignment; GET /facilities lấy dữ liệu DB mới. Không có stale facility claim trong JWT.
14. File dự kiến: facilityScope; facility-manager service; facilities controller; coaches service; classes service; operations routes; payment permissions; ManagerLayout; Manager-specific Users/Rooms/Revenue; auth/me và Coach assignment display; tests/docs. Giữ shared APIs và không sửa ReceptionLayout.

## Nguyên nhân đã có bằng chứng

- Prisma DAL scope không áp dụng cho truy vấn Mongo `/coaches`, nên danh sách toàn hệ thống xuất hiện trong context một cơ sở. Response thiếu assignment khiến không phân biệt được Coach unassigned. Không thấy default/first-facility assignment trong luồng tạo Coach; không khẳng định dữ liệu production đã bị tự gán.
- `findAssignableCoach` ban đầu chỉ kiểm tra role/active, không kiểm tra FacilityStaff trước phân công lớp.
- Một Facility có thể nhận nhiều Manager vì service khóa theo user, không khóa/kiểm tra facility.
- Assignment staff upsert không kiểm tra phân công active ở cơ sở khác.

## Giới hạn đã biết

Không tự sửa dữ liệu production hoặc áp dụng migration vào DB chưa xác minh. Các bài test ghi dữ liệu phải dùng database/schema riêng. Không thay workflow Receptionist. Tại thời điểm audit Leave chỉ hỗ trợ Coach; phần triển khai bên dưới mở rộng model/API để Manager xử lý nghỉ phép nhân sự, giữ nguyên portal Reception.

# Báo cáo triển khai — 09/10/2026

## 1. Nguyên nhân chính

- Context FE và `X-Facility-Id` trước đây quyết định cơ sở được yêu cầu; backend kiểm tra membership nhưng chưa bắt Manager có đúng một phân công.
- Query Mongo Coach không được Prisma middleware lọc. Vì vậy danh sách Coach toàn hệ thống xuất hiện bên trong workspace một cơ sở, trong khi quyền truy cập portal Coach lại đọc FacilityStaff thật.
- Phân công staff dùng upsert, thiếu kiểm tra người đã được phân công và thiếu khóa cạnh tranh theo người.
- Gán Manager khóa theo người nhưng chưa khóa/kiểm tra quản lý đương nhiệm của cơ sở.
- Router Manager còn giữ nhiều màn hình của Reception và các báo cáo dữ liệu toàn hệ thống.

## 2. File/module thay đổi

### Frontend

- `FE/src/features/manage/ManagerLayout.tsx`: menu, route, redirect.
- `ManagerUsers.tsx`: nhân sự cơ sở, pool Coach, xác nhận phân công, hồ sơ và bộ môn giảng dạy.
- `ManagerRooms.tsx`: tái sử dụng CRUD phòng, lịch sử dụng và cấu hình capabilities.
- `ManagerOverview.tsx`: tổng quan và báo cáo doanh thu.
- `manager.css`: bố cục form cấu hình và bộ lọc yêu cầu, chỉ dùng trong Manager.
- `FE/src/features/operations/OperationsPage.tsx`: Manager lọc/hiển thị người gửi và kết quả xử lý; đơn lễ tân không tải danh sách Coach/phòng không cần thiết.
- `config.ts`: cột phân công thật cho danh sách tài khoản Admin; không dùng cơ sở đang chọn làm fallback.
- `FE/src/shared/FacilityBoundary.tsx`: cho tài khoản chưa phân công kiểm tra lại phân công.
- `FE/src/shared/apiErrors.ts`: thông báo dễ hiểu cho lỗi phân công Manager/Coach.

### Backend

- `BE/src/middlewares/facilityScope.ts`: suy cơ sở Manager từ DB.
- `BE/src/modules/facilities/facilities.controller.ts`: phân công atomic, lấy cơ sở đích từ request context; chỉ trả staff active cho Manager.
- `facility-manager.service.ts`: khóa cơ sở và kiểm tra incumbent; giữ workflow thay Manager có chủ đích của Admin.
- `staff-assignment-view.ts`: đọc phân công thật, dùng lại ở Users/Auth.
- `BE/src/modules/coaches/coaches.service.ts`: scope danh sách, chi tiết, sửa Coach.
- `BE/src/modules/classes/classes.service.ts`: chỉ phân công Coach thuộc cơ sở.
- `BE/src/modules/operations/operations.routes.ts`: pool chỉ Coach chưa phân công; guard chuyên môn Coach; tên người gửi trong danh sách nghỉ phép Manager.
- `BE/src/modules/auth/auth.service.ts`, `users/users.service.ts`: trả assignment mới nhất từ DB.
- `BE/src/app.ts`, `payments/payments.routes.ts`, `reports/reports.routes.ts`: chặn Manager quản lý hội viên/gói/hóa đơn/thanh toán và báo cáo ngoài doanh thu.
- `BE/src/config/swagger.ts`, `operations-openapi.ts`, `users/users.routes.ts`: mô tả scope và assignment trong OpenAPI.
- `BE/prisma/migrations/20261008000100_manager_assignment_constraints/migration.sql`: hai unique index có điều kiện.
- `BE/prisma/schema.prisma`, `20261009000100_staff_requesters/migration.sql`: requester staff và backfill dữ liệu cũ, giữ ID Coach/Member tương thích.
- `BE/src/modules/operations/requesters.service.ts`: danh tính người gửi từ server và enrichment chỉ cho các request đã scope.
- `BE/package.json`: lệnh test có database tách riêng.
- Tests: `FE/tests/managerAuthorization.test.ts`, `adminBackend.test.ts`, `tests/browser/manager-scope.spec.ts`; cập nhật kỳ vọng Manager trong các test browser cũ. Backend integration và runner nằm trong `BE/tests/manager-isolation.integration.ts`, `run-manager-isolation.mjs`.

## 3. Navigation trước và sau

| Trước | Sau |
|---|---|
| Dashboard kèm báo cáo/global member metrics | Tổng quan cơ sở, shortcut tác vụ và doanh thu thực tế |
| Members / Coaches / Staff riêng | Người dùng: Coach và lễ tân của cơ sở |
| Rooms + Requirements riêng | Phòng tập: quản lý / sử dụng & cấu hình |
| Classes | Lớp học |
| Schedules + Planner / Slots / Patterns riêng | Lịch hoạt động |
| Leave | Nghỉ phép |
| Issues | Yêu cầu hỗ trợ |
| Payments / Membership / Reports | Báo cáo doanh thu, chỉ đọc |

Profile vẫn được giữ ngoài tám chức năng chính.

## 4. Route được chuyển hướng

Tất cả dưới `/manager`, dùng `Navigate replace`, bao gồm URL con `/*`:

| Route cũ | Đích |
|---|---|
| members, coaches, staff, roles | users |
| sports, bookings, attendance-rules | classes |
| checkin, audit-logs | dashboard |
| requirements | rooms |
| slots, patterns, activity-planner | schedules |
| membership-plans, membership, payments | reports |

`/manager`, `/`, `/login` dẫn tới dashboard trong portal Manager. URL lạ có trạng thái không tìm thấy trang. Không xóa module/API chia sẻ với role khác.

## 5. Authorization phía backend

Sau authenticate, middleware tìm `FacilityStaff` có userId hiện tại, role MANAGER, active và facility active. Phải có đúng một dòng; nếu không trả 403 `MANAGER_FACILITY_REQUIRED`.

Manager không cần gửi facility context. Nếu path/query/body/header có facilityId khác phân công, request bị từ chối 403. Context đã xác minh đi vào AsyncLocalStorage và DAL có sẵn: Room/Class/Payment/LeaveRequest/Issue/FacilityStaff scope trực tiếp; ClassSchedule/ClassMember/Enrollment/RoomCapability scope qua quan hệ cha. Không thay thế bảo vệ backend bằng lọc UI.

`/users` tiếp tục Admin-only. Manager bị chặn ở `/members`, `/subscriptions`, `/invoices`, `/payments`; roster lớp vẫn truy cập qua API lớp/enrollment có scope.

## 6. Manager Users

Nguồn nhân sự là GET `/facilities/{facilityId}` với staff đang được phân công. Lọc vai trò và tìm tên/email trong tập dữ liệu này. Pool ngoại lệ chỉ chứa Coach active chưa có bất kỳ FacilityStaff active nào, không chứa Member hoặc staff cơ sở khác.

Chỉnh hồ sơ dùng `User.id` ở `/coaches/{id}`; bộ môn giảng dạy dùng `CoachProfile.id` ở `/coaches/{id}/specializations`. Hai loại ID không bị trộn.

## 7. Kết luận bug Coach

Không tìm thấy code tự gán Coach mới vào cơ sở đầu tiên trong create service hoặc payload Admin. Các đoạn chọn cơ sở đầu tiên ở FacilityBoundary chỉ chọn workspace từ danh sách mà API đã cho phép, không ghi FacilityStaff.

Nguyên nhân xác nhận trong source: `/coaches` dùng Mongo query toàn hệ thống, response không nói rõ assignment, nên việc hiển thị trong workspace dễ bị hiểu là đã phân công. Sau sửa Manager list/detail/update đều kiểm tra FacilityStaff. Không khẳng định hoặc tự sửa dữ liệu lịch sử trên production.

## 8. Tạo Coach sau sửa

Admin vẫn POST `/users` với role COACH, tạo identity/profile/projection theo kiến trúc cũ. Không tạo FacilityStaff. Response staff có `assignmentStatus: UNASSIGNED`, `facilityAssignments: []`, `facilityName: Chưa phân công`. Không thêm facilityId vào JWT hay yêu cầu chọn cơ sở lúc tạo.

## 9. Phân công Coach sau sửa

UI gọi endpoint hiện hữu POST `/facilities/{facilityId}/staff`, chỉ gửi userId/role; không có picker cơ sở đích. Backend kiểm tra path theo Manager, lấy đích từ context DB, kiểm tra active account/role, khóa advisory theo userId, kiểm tra phân công active trên toàn hệ thống trong transaction rồi mới upsert.

Phân công trùng hoặc Coach đã thuộc cơ sở khác trả 409. Hai Manager gửi đồng thời chỉ một request thành công. Sau thành công, cache danh sách/pool được invalidated. Không thêm workflow chuyển Coach.

## 10. JWT và current-user

JWT hiện hữu chỉ mang id/role, không có stale facility claim cần migrate. `/auth/me` bổ sung phân công đang có trong DB cho các role staff. `/facilities` tiếp tục phản ánh DB. Màn hình chưa phân công có nút kiểm tra lại; không bắt đăng xuất để thấy phân công mới.

## 11. CRUD phòng

Giữ ResourcePage và API phòng hiện hữu; Manager không chọn facility tùy ý. DAL gán facilityId khi tạo và chặn entity ID khác cơ sở. Cập nhật, trạng thái và soft delete dùng quy tắc cũ; không hard-delete quan hệ.

## 12. Cấu hình và sử dụng phòng

Tab mới lấy các phòng có scope. Khi chọn phòng, tải `/class-schedules?roomId=...&from=...&to=...` qua allPages và ScheduleCalendar. Modal capabilities tải cấu hình đang lưu trước khi cho sửa; không cho lưu khi tải thất bại. Kiểm tra mã trùng, số lượng không âm và trạng thái đang lưu. Chuyên môn Coach được chuyển vào Users để không mất cấu hình thiết yếu khi bỏ menu Requirements.

## 13. Xung đột phòng

Tái sử dụng validator và transaction/lock của scheduling hiện có. Room overlap bị backend trả 409. Phòng có lịch tương lai không được deactivate. Thay capabilities không phù hợp lịch sắp tới vẫn bị validator backend từ chối.

## 14. Lớp học

Giữ ClassForm và ResourcePage. Room lookup đã có DAL scope, Coach lookup nay được scope cả Mongo list. `findAssignableCoach` kiểm tra phân công active trong cơ sở trước khi gán lớp. Backend không chấp nhận Coach/Room từ cơ sở khác dù tự sửa payload.

## 15. Class → Activity Schedule

Không tạo bảng hoặc nguồn calendar thứ hai. Form lịch, Activity Schedule, chi tiết lớp và lịch sử dụng phòng đều đọc/ghi ClassSchedule. Sau mutation sử dụng query invalidation hiện có.

## 16. Nghỉ phép

Giữ OperationsPage và quy trình duyệt/từ chối/xử lý lịch bị ảnh hưởng. Facility scope được suy từ Manager; ID của đơn cơ sở khác bị chặn. Danh sách Manager bổ sung tên Coach từ projection để tránh các thẻ chỉ ghi “Bản ghi”.

**Bổ sung ngày 09/10:** model thêm requesterId/requesterRole, coachId nullable. Migration backfill người gửi của đơn Coach cũ. POST giữ contract Coach và nhận thêm Receptionist, danh tính lấy từ tài khoản đăng nhập và phân công cơ sở đang hoạt động. Receptionist chỉ đọc đơn mình gửi. Manager duyệt/từ chối trong cơ sở; đơn không có Coach trả affected=[] và từ chối resolutions để không thay đổi nhầm lịch lớp. Manager có bộ lọc trạng thái/vai trò, tên người gửi và lý do quyết định. Không thêm form hoặc thay workflow trong portal Reception.

## 17. Hỗ trợ

Issue.facilityId là nguồn scope thật; chỉ thấy/xử lý issue thuộc cơ sở. Model thêm requesterId/requesterRole, giữ memberId cho Member và dữ liệu cũ. POST hỗ trợ Member/Coach/Receptionist/Manager với danh tính do server xác định; Member/Coach chỉ đọc yêu cầu của chính mình. Quyền xử lý Manager/Receptionist hiện hữu giữ nguyên theo cơ sở. Manager hiển thị người gửi và lọc vai trò/trạng thái; không thêm màn hình gửi yêu cầu vào các portal ngoài phạm vi.

## 18. Báo cáo doanh thu

ManagerOverview ở chế độ reports chỉ gọi GET `/reports/revenue`, chọn ngày hợp lệ, hiển thị thực thu/đã hoàn/thực nhận/số giao dịch thu được và giao dịch gần đây. Có loading, retry, empty, cảnh báo `netRevenueVerified=false`; không cho refund, tạo/hủy payment hoặc mua/gia hạn gói.

## 19. Cơ sở của doanh thu

Quan hệ thật là **Payment.facilityId**. Giữ nguyên phép tính có sẵn: thu theo paidAt, hoàn theo refundedAt, phạm vi ngày Việt Nam +07:00. DAL scope aggregate/count/groupBy/list theo cơ sở Manager. Không suy doanh thu từ membership toàn hệ thống hoặc cơ sở đang chọn trong FE.

## 20. Chủ động giữ nguyên

Không sửa `ReceptionLayout.tsx`, registration/chat/check-in Reception, business rules 20%/30%, branding hoặc kiến trúc. Không xóa API/component chia sẻ. Không sửa dữ liệu ứng dụng production, không deploy, không push Git. API kỳ vọng mới cần được deploy cùng frontend để có enforcement trên server đang chạy.

## 21. Kiểm tra

- FE: `npm run verify` (conflict marker, TypeScript, unit tests, production build).
- BE: `npm run build` (Prisma generate + TypeScript).
- HTTP/DB: `npm run test:manager:isolation` trong BE. Runner tạo schema PostgreSQL và database MongoDB mới có tên ngẫu nhiên `scms_verify_manager_*`, dựng schema trước mở rộng requester rồi chạy cả hai migration thật trong namespace này, rồi tự xóa chúng sau test. Không chạy test ghi dữ liệu trên namespace ứng dụng.
- Integration: tạo Coach qua Admin API; current-user trước/sau phân công; Coach assignment/race; từ chối Manager thứ hai; IDOR phòng/lớp/lịch/chuyên môn/leave/issues; phòng CRUD/soft delete và xung đột; revenue A không có khoản thu B; chặn workflow tài chính/hội viên cũ.
- API bổ sung: danh tính Receptionist không thể giả mạo, không thể gửi sang cơ sở khác; đơn nghỉ riêng tư theo người gửi, Manager đúng cơ sở xử lý; đơn lễ tân không sửa lịch; issue Coach chỉ đọc của mình, hỗ trợ Member cũ còn hoạt động.
- Browser: tám menu, redirect các URL cũ, phân công và làm mới pool, hồ sơ/chuyên môn Coach, lịch phòng/Activity cùng session, config phòng, report chỉ đọc, refresh Coach chưa phân công, duyệt nghỉ lễ tân trên mobile, lọc vai trò/trạng thái yêu cầu và empty state.
- Responsive: 320, 375, 430, 768, 1024, 1280, 1440, 1920px; axe cho các trang mới ở 375/1440px. Browser dùng fixture API trong test; không có mock data đưa vào production.

### Kết quả cuối

| Kiểm tra | Kết quả |
|---|---|
| FE `npm run verify` | PASS: TypeScript, kiểm tra conflict, 79/79 unit tests, Vite production build |
| BE `npm run build` | PASS: Prisma generate và TypeScript |
| BE `npm run test:manager:isolation` | PASS: migration/backfill đơn cũ và HTTP trên PostgreSQL/MongoDB thật; namespace đã xóa sau test |
| Toàn bộ browser suite | PASS: 193/193 ở lượt cuối ngày 09/10, gồm mọi role |
| Manager nghỉ phép/hỗ trợ | PASS: duyệt nghỉ lễ tân, lọc vai trò/trạng thái, empty state và axe trên mobile |
| Responsive / accessibility | 8 viewport PASS; axe trang Manager và modal chuyên môn Coach PASS; đã xem ảnh desktop/mobile |
| `git diff --check` | PASS |

Sau lượt 193/193, Việt hóa trạng thái hỗ trợ trong Manager; chạy lại build FE và test mobile duyệt/lọc/axe đều PASS.

Kiểm thử HTTP cuối có đăng nhập Coach thật bằng email/password trước phân công, tái sử dụng chính access token đó để đọc `/auth/me` sau phân công; race hai Manager trả đúng một 201 và một 409. Hai lần ghi trực tiếp phân công vi phạm trong DB test đều bị unique index trả P2002 như mong đợi. Không có script lint độc lập trong package.json; không báo cáo lint như một bước đã chạy.

Ảnh kiểm tra (fixture chỉ trong tests): `FE/artifacts/manager-audit-375.png`, `FE/artifacts/manager-audit-1440.png`, `FE/artifacts/manager-staff-leave-375.png`, `FE/artifacts/manager-staff-support-375.png`.

## 22. Triển khai và rủi ro còn lại

1. Hai migration mới **chưa chạy trên production**. Trước `npm run db:deploy`, kiểm tra phân công active trùng; migration cố ý fail khi có dữ liệu vi phạm thay vì tự chọn/transfer nhân sự.
2. Cần deploy BE trước hoặc cùng FE. Chỉ build FE không làm server Render tự có quyền hạn mới.
3. API/model đã hỗ trợ đơn nghỉ Receptionist và issue nhân sự; portal Reception/Coach không được thêm workflow mới trong task này. Các client gọi API mới cần được triển khai riêng nếu muốn bổ sung form gửi cho nhân sự.
4. Không xác minh/sửa dữ liệu legacy của từng tài khoản thật. Nếu production đang có nhiều Manager active hoặc Coach đa cơ sở, Admin cần xử lý phân công có chủ đích trước migration.

SQL kiểm tra read-only trước triển khai:

```sql
SELECT "facilityId", COUNT(*) FROM "FacilityStaff"
WHERE "role" = 'MANAGER' AND "isActive" = true
GROUP BY "facilityId" HAVING COUNT(*) > 1;

SELECT "userId", COUNT(*) FROM "FacilityStaff"
WHERE "role" IN ('MANAGER', 'COACH') AND "isActive" = true
GROUP BY "userId" HAVING COUNT(*) > 1;
```
