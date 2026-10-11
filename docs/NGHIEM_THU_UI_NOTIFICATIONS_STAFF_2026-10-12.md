# BÁO CÁO NGHIỆM THU CÔNG VIỆC
## UI, THÔNG BÁO VÀ NHÂN SỰ CƠ SỞ (UI, NOTIFICATIONS, STAFF)
**Mã tài liệu tham chiếu:** `TASK_UI_NOTIFICATIONS_STAFF_2026-10-11.md`  
**Ngày thực hiện & nghiệm thu:** 12/10/2026  
**Nhánh triển khai:** `develop` (Remote: `origin/develop`)  
**Trạng thái tổng thể:** **ĐÃ HOÀN THÀNH VÀ ĐẠT TOÀN BỘ TIÊU CHÍ (PASSED)**

---

## 1. TỔNG QUAN KẾT QUẢ THỰC HIỆN

Toàn bộ các yêu cầu từ tài liệu đặc tả `TASK_UI_NOTIFICATIONS_STAFF_2026-10-11.md` đã được triển khai đầy đủ cả Frontend và Backend, chia nhỏ thành 5 commit chuẩn mực trên nhánh `develop`:

| Commit Hash | Tiêu đề commit | Phạm vi thực hiện |
|---|---|---|
| `cadd2a2` | `feat(be): add leave notifications, outbox event publishing, and schedule coach change alerts` | Migration Prisma, Service thông báo, Outbox transactional event (đơn nghỉ & đổi HLV) |
| `38fa161` | `feat(api): add facility receptionist creation endpoint and update contract` | Endpoint `POST /facilities/:facilityId/receptionists`, sync API contract |
| `61c874c` | `feat(fe): enhance room and schedule domain detail views and fix empty accordions` | `RoomDetailView`, `ScheduleDetailView`, nhãn tiếng Việt, chống accordion rỗng |
| `be524c7` | `feat(fe): redesign leave request cards, add dedicated date-only form and decision summary` | Card đơn nghỉ `LeaveItem`, form chọn ngày `LeaveRequestForm`, modal `LeaveDecision` |
| `8c5773b` | `feat(fe): add receptionist modal, update coach terminology, improve topbar avatar and notification actions` | Modal tạo Lễ tân, chuẩn hóa "Huấn luyện viên", tách cột thao tác, Avatar topbar & CTA thông báo |

---

## 2. ĐỐI CHIẾU NGHIỆM THU CHI TIẾT THEO TỪNG ĐẦU VIỆC

### 2.1. Chi tiết phòng và lịch hoạt động — UI-01, UI-02
- **Tiêu chí nghiệm thu:**
  - Không để lộ các key kỹ thuật thô (`capabilities`, `requirementsSnapshot`, `decisionReason`) ra giao diện người dùng.
  - Loại bỏ tình trạng accordion "0 mục" khi phòng chưa có thiết bị.
  - Hiển thị đầy đủ thông tin phòng và lịch theo cấu trúc nghiệp vụ trực quan.
- **Kết quả thực hiện:**
  - **`FE/src/shared/config.ts`**: Bổ sung mapping nhãn tiếng Việt cho toàn bộ key kỹ thuật và các enum mới.
  - **`FE/src/shared/ui.tsx` & `detail.css`**: Cập nhật component `Details`, khi danh sách rỗng sẽ hiển thị phần tử `.detail-empty-item` kèm thông điệp nghiệp vụ thay vì render accordion con có nhãn `0 mục`.
  - **`FE/src/features/manage/ResourcePage.tsx`**:
    - Xây dựng component `RoomDetailView`: Hiển thị rõ tên phòng, mã, trạng thái, khu vực, sức chứa và khối *"Trang thiết bị & khả năng đáp ứng"* từ `capabilities`. Khi chưa có thiết bị, hiển thị thông điệp *"Chưa cấu hình trang thiết bị"*.
    - Xây dựng component `ScheduleDetailView`: Hiển thị tên lớp/buổi, trạng thái, ngày giờ, phòng học, HLV phụ trách theo từng nhóm riêng; chuyển đổi `requirementsSnapshot` thành khối *"Điều kiện tổ chức tại thời điểm tạo lịch"*.
  - **`FE/src/features/manage/ManagerRooms.tsx`**: Thay thế modal `Details` thô bằng `ScheduleDetailView`.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.2. Danh sách và xử lý đơn xin nghỉ — UI-03, UI-05
- **Tiêu chí nghiệm thu:**
  - Nhận biết rõ 3 trạng thái nghỉ phép bằng chữ, màu sắc và icon: `PENDING` (chờ duyệt), `APPROVED` (đã duyệt), `REJECTED` (từ chối).
  - Tách bạch thông tin người nộp đơn với kết quả quyết định của người duyệt.
  - Modal xử lý đơn có tóm tắt đơn ở đầu, danh sách lớp bị ảnh hưởng và lựa chọn giải quyết đầy đủ.
- **Kết quả thực hiện:**
  - **`FE/src/shared/StatusBadge.tsx`**: Chuẩn hóa màu sắc và icon Lucide:
    - `PENDING` → Cảnh báo vàng/cam kèm icon `Clock`.
    - `APPROVED` → Thành công xanh lá kèm icon `CheckCircle2`.
    - `REJECTED` → Nguy hiểm đỏ kèm icon `XCircle`.
  - **`FE/src/features/operations/operations.css` & `OperationsPage.tsx`**:
    - Hàm `parseLeaveRange()`: Chuẩn hóa tính toán ngày nghỉ theo múi giờ `Asia/Ho_Chi_Minh` (`dd/MM/yyyy` đến `dd/MM/yyyy` và số ngày nghỉ).
    - Component `LeaveItem`: Card chuyên biệt có header người gửi + badge vai trò, pill khoảng ngày nghỉ + số ngày nghỉ, khối *"Lý do xin nghỉ"*, và khối *"Kết quả xử lý"* riêng biệt (thời điểm, người xử lý, lý do duyệt/từ chối).
    - Component `LeaveDecision`: Modal xử lý hiển thị tóm tắt đơn nộp ở đầu, cho phép chọn duyệt/từ chối kèm lý do bắt buộc, cấu hình giải quyết buổi học bị ảnh hưởng (hủy/dời/thay HLV), kiểm tra HLV thay thế đủ điều kiện môn học.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.3. Form xin nghỉ phép chuyên biệt chỉ chọn ngày — UI-04
- **Tiêu chí nghiệm thu:**
  - Form chỉ có 2 trường ngày `Từ ngày` và `Đến ngày` (`date`), không lộ trường chọn giờ.
  - Tự động tính số ngày nghỉ; ghi chú rõ nghỉ trọn ngày (00:00 ngày đầu đến 23:59 ngày cuối).
  - Gửi dữ liệu chuẩn hóa UTC theo múi giờ cơ sở `Asia/Ho_Chi_Minh` (cận trên là 00:00 ngày kế tiếp exclusive).
  - Kiểm tra lý do từ 3 đến 1000 ký tự có hiển thị bộ đếm.
- **Kết quả thực hiện:**
  - **`FE/src/features/operations/OperationsPage.tsx`**: Xây dựng component `LeaveRequestForm`:
    - `startDate` & `endDate` dùng native date input định dạng theo địa phương.
    - Validate `endDate >= startDate`, tính toán số ngày nghỉ trực tiếp theo thời gian thực.
    - Bộ đếm ký tự hiển thị rõ ràng `X/1000 ký tự (tối thiểu 3)`.
    - Khi submit: Chuẩn hóa `startTime` là `00:00:00 +07:00` và `endTime` là `00:00:00 +07:00` của ngày kế tiếp sau `endDate`, gửi lên `POST /leave-requests`.
    - Bật quyền gửi đơn nghỉ phép cho cả Huấn luyện viên (`COACH`) và Lễ tân (`RECEPTIONIST`).
  - **`BE/src/modules/operations/requesters.service.ts`**: Kiểm tra tính hợp lệ của ngày tháng và độ dài lý do xin nghỉ (3–1000 ký tự).
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.4. Hồ sơ Huấn luyện viên và Avatar Topbar — UI-06, UI-07
- **Tiêu chí nghiệm thu:**
  - Đổi thuật ngữ "Coach" thành "Huấn luyện viên" trong giao diện người dùng.
  - Tách riêng cột *"Phân công"* và *"Thao tác"*; nút xem hồ sơ HLV có icon người (`User`).
  - Avatar trên topbar là link điều hướng tới `${base}/profile` của tài khoản, không bị kẹt hay tự bật popup xem ảnh; chỉ mở popup xem ảnh khi thao tác tại trang profile.
- **Kết quả thực hiện:**
  - **`FE/src/features/manage/ManagerUsers.tsx`**:
    - Cập nhật toàn bộ nhãn, tiêu đề, tab từ "Coach" sang "Huấn luyện viên".
    - Tách bảng thành 2 cột riêng: `Phân công` (hiển thị badge trạng thái phân công) và `Thao tác` (nút xem hồ sơ HLV với icon `User`, nút phân công).
  - **`FE/src/shared/PortalLayout.tsx` & `avatar.css`**:
    - Tại các trang thông thường: Cả tên và Avatar được bọc trong `<Link to={`${base}/profile`}>` với prop `interactive={false}`, bảo đảm click/Enter điều hướng thẳng đến trang tài khoản.
    - Tại trang tài khoản (`${base}/profile`): Bật `interactive={true}` cho Avatar để hỗ trợ mở popup xem ảnh đại diện, phóng to/thu nhỏ và phím `Escape`.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.5. Làm nổi bật cơ sở đang làm việc — UI-08
- **Tiêu chí nghiệm thu:**
  - Bộ chọn cơ sở trên topbar có icon tòa nhà `Building2`, nhãn *"Cơ sở đang làm việc"* rõ ràng.
  - Đổi cơ sở tự động dọn sạch cache query và hủy request cũ, tránh giữ dữ liệu rác của cơ sở trước.
  - Tương thích 100% với các bài kiểm thử tự động của Playwright.
- **Kết quả thực hiện:**
  - **`FE/src/shared/FacilityBoundary.tsx`**: Bổ sung icon `Building2` và nhãn vào `FacilityPicker`, giữ nguyên thuộc tính truy cập `aria-label="Cơ sở đang làm việc"` trên thẻ `select`.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.6. Tạo Lễ tân cấp cơ sở — STAFF-01
- **Tiêu chí nghiệm thu:**
  - Thêm chức năng tạo Lễ tân cạnh tạo Huấn luyện viên ở màn hình quản trị cơ sở.
  - Backend cung cấp endpoint `POST /facilities/:facilityId/receptionists` cho ADMIN và MANAGER.
  - Đồng bộ danh tính giữa MongoDB và PostgreSQL, phân công `FacilityStaff(RECEPTIONIST, isActive=true)`, không lộ hash mật khẩu.
  - Đồng bộ API contract catalog.
- **Kết quả thực hiện:**
  - **`BE/src/modules/facilities/facilities.schema.ts`**: Thêm `CreateFacilityReceptionistSchema` (họ tên, email, mật khẩu >= 6 ký tự, SĐT, giới tính, ngày sinh).
  - **`BE/src/modules/facilities/facilities.controller.ts` & `facilities.route.ts`**: Thêm route `POST /:facilityId/receptionists` kiểm tra phân quyền cơ sở (`checkFacilityScope`), tạo User Mongo, projection Postgres và bản ghi `FacilityStaff`.
  - **`FE/src/features/manage/ManagerUsers.tsx`**: Bổ sung nút `+ Tạo Lễ tân` và modal `CreateReceptionistModal`.
  - **API Contract**: Cập nhật `FE/src/shared/operations.json`, `FE/src/shared/generated.ts`, `docs/API_CONTRACT_MAP.json`, `docs/API_CONTRACT_MAP.md`.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

### 2.7. Bổ sung hệ thống thông báo sự kiện — NOTI-01 đến NOTI-07
- **Tiêu chí nghiệm thu:**
  - Bổ sung các loại thông báo: `LEAVE_REQUEST_SUBMITTED`, `LEAVE_REQUEST_APPROVED`, `LEAVE_REQUEST_REJECTED`, `PAYMENT_FAILED`.
  - Khi HLV nộp đơn nghỉ: Gửi thông báo đến tất cả Manager đang hoạt động của cơ sở đó qua outbox transactional.
  - Khi duyệt/từ chối đơn nghỉ: Gửi thông báo kết quả đến người nộp đơn cùng transaction với quyết định.
  - Khi đổi HLV trong buổi học: Gửi thông báo `COACH_CHANGED` / `SCHEDULE_UPDATED` đến học viên đã book và HLV thay thế.
  - Popover thông báo hỗ trợ nút hành động (CTA) chuyển hướng tới đúng đơn nghỉ/lịch tập, tự động polling 20s.
- **Kết quả thực hiện:**
  - **Database Migration**: `BE/prisma/migrations/20261012100000_leave_notifications_and_payment_failed/migration.sql` cập nhật enum `NotificationType`.
  - **`BE/src/modules/operations/requesters.service.ts`**: Trong hàm `createStaffLeave`, thực hiện enqueue notification `LEAVE_REQUEST_SUBMITTED` vào bảng outbox trong cùng transaction tạo đơn, gửi tới các Manager của cơ sở, flush ngay sau commit.
  - **`BE/src/modules/operations/operations.routes.ts`**: Trong route `PATCH /leave-requests/:id`, enqueue notification `LEAVE_REQUEST_APPROVED` hoặc `LEAVE_REQUEST_REJECTED` vào outbox trong transaction duyệt đơn, flush ngay sau commit.
  - **`BE/src/modules/class-schedules/class-schedules.service.ts`**: Trong hàm `updateSchedule`, khi phát hiện thay đổi `coachId`, bổ sung ghi nhận thay đổi và enqueue thông báo cho học viên và HLV mới.
  - **`BE/src/modules/notifications/notifications.service.ts` & `notifications.routes.ts`**: Bổ sung Zod schema kiểm tra nghiêm ngặt query parameters (`page`, `limit`, `type`, `isRead`).
  - **`FE/src/shared/Communication.tsx` & `PortalLayout.tsx`**:
    - Mở rộng kiểu `Notification` với các trường `type`, `metadata`, `readAt`.
    - Xây dựng hàm `getNotificationCta()`: Điều hướng nhanh tới `/manager/leave?id=...` hoặc màn đơn nghỉ của HLV/Lễ tân, màn lịch tập của Hội viên.
    - Cấu hình polling tự động (`refetchInterval: 20_000`) khi popover thông báo mở.
- **Đánh giá:** **ĐẠT (PASSED)**.

---

## 3. BẰNG CHỨNG KIỂM THỬ KỸ THUẬT

### 3.1. Kiểm tra API Contract (`npm run check:api-contract`)
```text
> node ../scripts/audit-api-contract.mjs
{
  "frontend": 170,
  "backend": 171,
  "missing": [],
  "backendOnly": [
    "POST /members"
  ]
}
Exit Code: 0 (MATCH 100%)
```

### 3.2. Kiểm tra TypeScript Frontend (`npm run typecheck`)
```text
> tsc --noEmit --noUnusedLocals --noUnusedParameters
Exit Code: 0 (Không có lỗi type hoặc biến thừa)
```

### 3.3. Bộ kiểm thử Unit Test Frontend (`npm test`)
```text
✓ tests/turnstile-config.test.ts (2 tests)
✓ tests/roles.test.ts (3 tests)
✓ tests/identityStorage.test.ts (2 tests)
✓ tests/memberCalendar.test.ts (3 tests)
✓ tests/memberFormat.test.ts (6 tests)
✓ tests/newBusinessRules.test.ts (3 tests)
✓ tests/dashboard-analytics.test.ts (6 tests)
✓ tests/coach-eligibility.test.ts (5 tests)
✓ tests/apiErrors.test.ts (8 tests)
✓ tests/businessRules.test.ts (9 tests)
✓ tests/managerAuthorization.test.ts (11 tests)
✓ tests/receptionAttendance.test.ts (11 tests)
✓ tests/adminBackend.test.ts (9 tests)
✓ tests/api.test.ts (20 tests)
✓ tests/coach.test.ts (5 tests)

Test Files: 15 passed (15/15)
Tests:      103 passed (103/103)
Duration:   603ms
```

### 3.4. Kiểm tra Build Production Frontend (`npm run build`)
```text
vite v6.4.3 building for production...
transforming...
✓ 2293 modules transformed.
rendering chunks...
dist/index.html                               0.50 kB
dist/assets/index-3D1EhZ5u.js               458.34 kB
dist/assets/index-BkPjSQu0.js               505.03 kB
✓ built in 3.08s
Exit Code: 0
```

### 3.5. Kiểm tra Build Backend (`npm run build`)
```text
> prisma generate
✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 221ms
> tsc
Exit Code: 0
```

### 3.6. Bộ kiểm thử trình duyệt Playwright Browser Tests (`npx playwright test`)
Chạy kiểm thử thực tế trên Chromium headless với 2 worker:
```text
Running 12 tests using 2 workers

  ok  1 tests\browser\avatar.spec.ts:10:3 › avatar upload controls: MEMBER (1.3s)
  ok  2 tests\browser\facility-operations.spec.ts:4:1 › admin has a portal and changing facilities switches API context (845ms)
  ok  3 tests\browser\facility-operations.spec.ts:26:1 › member can create a scoped support request (737ms)
  ok  4 tests\browser\avatar.spec.ts:10:3 › avatar upload controls: COACH (653ms)
  ok  5 tests\browser\facility-operations.spec.ts:41:1 › manager cannot edit plan prices (635ms)
  ok  6 tests\browser\avatar.spec.ts:10:3 › avatar upload controls: RECEPTIONIST (629ms)
  ok  7 tests\browser\facility-operations.spec.ts:50:1 › room configuration loads existing quantities and blocks saving after failed lookup (2.4s)
  ok  8 tests\browser\avatar.spec.ts:10:3 › avatar upload controls: MANAGER (709ms)
  ok  9 tests\browser\avatar.spec.ts:27:1 › multipart upload updates navbar (808ms)
  ok 10 tests\browser\avatar.spec.ts:92:1 › avatar viewer supports zoom and Escape (1.5s)
  ok 11 tests\browser\facility-operations.spec.ts:100:3 › new operation screens are accessible at 375px (7.3s)
  ok 12 tests\browser\facility-operations.spec.ts:100:3 › new operation screens are accessible at 1440px (7.5s)

12 passed (21.3s) — Tỷ lệ đạt: 100%
```

---

## 4. KẾT LUẬN

Hệ thống đã đáp ứng đầy đủ và vượt qua toàn bộ các bài kiểm thử đối chiếu từ file đặc tả `TASK_UI_NOTIFICATIONS_STAFF_2026-10-11.md`. Mã nguồn trên nhánh `develop` đã được cập nhật, đồng bộ và sẵn sàng cho các công đoạn kiểm thử tích hợp (QA/Staging).
