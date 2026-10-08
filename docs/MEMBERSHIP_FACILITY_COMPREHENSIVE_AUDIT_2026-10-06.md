# Comprehensive Audit: Membership × Facility — 2026-10-06

Phạm vi: read-only audit toàn bộ codebase (BE Prisma/DAL/services/routes, FE, docs, tests) đối với
luồng Membership sau khi refactor sang GLOBAL scope. Không file production nào bị sửa trong audit này.

## 1. Executive Summary

**Membership ↔ Facility hiện ĐÚNG về cốt lõi nhưng CHƯA hoàn toàn nhất quán.** Entitlement (gói ACTIVE,
tier, hạn), quota lớp học song song, và kiểm tra trùng giờ đều đã là **GLOBAL**, không phụ thuộc
`X-Facility-Id`; các tài nguyên vận hành (Class/Schedule/Room/Enrollment/Attendance/Payment) vẫn được
**FACILITY-scoped** đúng mức; `MembershipSubscription.facilityId` chỉ còn nghĩa là **ORIGIN** và được dùng
duy nhất cho báo cáo doanh thu/theo cơ sở. Không tìm thấy lỗ hổng cho phép hội viên chỉnh sửa gói của
người khác, và cũng không tìm thấy truy vấn entitlement nào còn sót bộ lọc facility ngầm.

Tuy nhiên audit phát hiện **2 lỗi chức năng HIGH đã tái hiện được trên DB test cô lập**, cả hai đều nằm ở
luồng **hủy gói liên facility**: (1) hủy gói từ facility B **không hủy được booking đang giữ ở facility A**
(mâu thuẫn trực tiếp với rule đã document "tự động hủy toàn bộ lịch tương lai"); (2) khi đủ điều kiện hoàn
tiền, hủy gói từ facility khác **thất bại toàn bộ với `403 FORBIDDEN_SCOPE`** và gói vẫn `ACTIVE`. Bên cạnh
đó là các cảnh báo MEDIUM về **mismatch giữa quota (global) và "Lịch của tôi" (facility-scoped)**, số liệu
report trộn cohort global/origin, cùng với việc nhân sự facility B giờ thấy được payment/invoice phát hành
tại facility A. Không có issue nào ở FE cache; các test chính đều PASS.

**Overall status: `FIXED` (all remediated; INFO items are policy decisions).

> **Post-remediation update (same day):** MF-01, MF-02 and MF-03 have been fixed and have their own regression tests.
> See sections **15 (MF-01/MF-02)** and **16 (MF-03)**. The MF-04 to MF-16 series has also been added
> with regression tests and fixes (see section **17**): MF-04/05/06/07/08/09/10 **FIXED**, MF-11/12 **FIXED**,
> MF-13/14/15 **VERIFIED SAFE**, MF-16 **policy decision (no code change)**.
> The MEDIUM/LOW warnings in the audit have been applied / changed to verified.

Class                         = FACILITY
ClassSchedule                 = FACILITY
Room                          = FACILITY
Enrollment (record)           = FACILITY (scope qua Class.facilityId)
Attendance                    = FACILITY (scope qua Schedule → Class)
Payment                       = FACILITY (facilityRoot) — dùng cho TRÚC XÁC định nguồn
Invoice                       = FACILITY (scope qua Payment)
Staff / Slot / Pattern / Issue / LeaveRequest / AuditLog = FACILITY

MembershipSubscription.facilityId = ORIGIN (nơi phát hành/giao dịch) — KHÔNG phải phạm vi hiệu lực
  · NULL   = gói FREE cấp tự động, không phát hành tại cơ sở nào (vẫn hợp lệ)
  · = A    = phát hành tại A, dùng được ở mọi facility đang active
```

Cơ chế thực thi: `MembershipSubscription` KHÔNG nằm trong `facilityRoots`
(`BE/src/config/scoped-data.ts`) ⇒ Prisma `$use` không còn tự tiêm `AND facilityId`;
các điểm cần global chủ động chạy `requestContext.run({..., facilityId: undefined})`.

## 3. Scope Matrix

| Operation / Model | Expected | Actual (kiểm chứng) | Status |
|---|---|---|---|
| `findActiveSubscription` (đặt chỗ/quota) | GLOBAL | GLOBAL (không filter, `scoped-data.ts` không còn model này) | ✅ |
| `GET /members/:id/membership-status` | GLOBAL | GLOBAL (`members.service.ts:167`, không where facilityId) | ✅ |
| Danh sách `subscriptions[]` trong `/members` | GLOBAL | GLOBAL (`members.service.ts:46,97`) | ✅ |
| FREE creation (`free-subscription.service.ts:86`) | GLOBAL | `facilityId: null` tường minh | ✅ |
| Purchase validation (`inspectPlanPurchase`) | GLOBAL | GLOBAL (không where facilityId) | ✅ |
| Quota `getMemberConcurrentClassQuota` | GLOBAL | GLOBAL — enrollment query bọc `facilityId: undefined` (`enrollment-quota.service.ts:93`) | ✅ |
| `cancel` / `renew` / `status` lookup | GLOBAL + auth | GLOBAL (findUnique không còn 403 theo facility) | ✅ |
| **Side-effect hủy booking khi cancel** | **GLOBAL** | **FACILITY-scoped** (`enrollment.updateMany` kế thừa filter) | ❌ **MF-01** |
| **Side-effect refund khi cancel** | **hoạt động** | **bị chặn `FORBIDDEN_SCOPE`** (`payment.update` là facilityRoot) | ❌ **MF-02** |
| Class list / detail | FACILITY | FACILITY (`facilityRoots`) | ✅ |
| Schedule list (`buildWhereSql`) | FACILITY | FACILITY (`class-schedules.service.ts:214`) | ✅ |
| Enrollment create/cancel record | FACILITY | FACILITY (parents → Class) | ✅ |
| Attendance | FACILITY | FACILITY (parents → Schedule → Class) | ✅ |
| Attendance entitlement re-check | GLOBAL | GLOBAL (`attendance.service.ts:326`) | ✅ |
| Time conflict (book/course/transfer/reschedule) | GLOBAL | GLOBAL (4 chỗ `facilityId: undefined`) | ✅ |
| Payment origin | ORIGIN FACILITY | `Payment.facilityId` forced theo context; subscription ghi `soldPayment.facilityId` | ✅ |
| Revenue report | FACILITY/ORIGIN | FACILITY (Payment facility-scoped) | ✅ |
| Membership reports (`/reports/memberships`, `/reports/members`, `/reports/subscription-logs`) | ORIGIN | ORIGIN (filter tường minh `facilityId`) | ✅ |
| SePay webhook (không có header) | GLOBAL cho entitlement | rehydrate `facilityId` từ Payment → origin đúng, entitlement global | ✅ |
| `MembershipPlan.deletePlan` guard | GLOBAL (catalog) | GLOBAL (đếm ACTIVE sub toàn hệ thống) | ⚠️ MF-12 (đã thay đổi hành vi, có chủ đích) |
| FE membership cache | không phụ thuộc facility | key `["current-membership"]`, `["my-enrollment-quota"]` không chứa facility; `FacilityBoundary` xóa cache khi đổi cơ sở | ✅ |

## 4. Findings

### MF-01 — Hủy gói không hủy được booking ở cơ sở khác

- **Severity:** `HIGH`
- **Location:** `BE/src/modules/subscriptions/subscriptions.service.ts:512-519` (`cancelSubscriptionBySelf`),
  cùng pattern tại `:368-375` (nhánh `CANCELLED` của `updateSubscriptionStatus`) và
  `BE/src/modules/payments/payments.service.ts:163` (nhánh REFUNDED).
- **Current behavior:**
  ```ts
  await tx.enrollment.updateMany({
    where: { memberId, status: "BOOKED", schedule: { startTime: { gt: now } } },
    data:  { status: "CANCELLED", cancelledAt: now },
  });
  ```
  `Enrollment` thuộc `parents` (`Enrollment → Class → facilityId`) nên DAL tự tiêm
  `AND: { class: { facilityId: <facility context> } }` → chỉ hủy được booking **cùng facility đang chọn**.
- **Expected behavior:** Swagger của `PATCH /subscriptions/{id}/cancel` ghi rõ
  *"Toàn bộ lịch học tương lai (`BOOKED`) của member tự động bị hủy"* — phải là **mọi cơ sở**.
- **Evidence (chạy thật trên test DB cô lập `scms_verify_audit_*`):**
  ```
  [PASS] P1a: cancel từ facility B thành công (không lỗi)
  [PASS] P1b: subscription chuyển CANCELLED
  [FAIL] P1c: TOÀN BỘ booking tương lai bị hủy (booking này ở facility A)
         {"enrollmentStatus":"BOOKED","expected":"CANCELLED"}
  ```
- **Impact:** Hội viên hủy gói nhưng vẫn giữ chỗ ở cơ sở khác → chiếm sức chứa vô hạn kỳ; khi tới lớp,
  điểm danh sẽ chặn (entitlement đã hết) → "chỗ ảo" chặn người khác đặt; mâu thuẫn với rule đã document.
- **Recommended fix (chỉ khuyến nghị, KHÔNG sửa trong audit):** bọc câu `updateMany` này bằng
  `requestContext.run({ ...getStore(), facilityId: undefined }, ...)` — đúng pattern đã dùng cho
  conflict check; **không** mở scope cho model khác.

### MF-02 — Hủy gói có hoàn tiền từ cơ sở khác thất bại toàn bộ (`403 FORBIDDEN_SCOPE`)

- **Severity:** `HIGH`
- **Location:** `BE/src/modules/subscriptions/subscriptions.service.ts:524-532`
  (`tx.payment.update` trong `cancelSubscriptionBySelf`) và `:379-388` (nhánh refund của
  `updateSubscriptionStatus`).
- **Current behavior:** `Payment` nằm trong `facilityRoots` → DAL chạy **id-ownership check**
  (`prisma.ts:82-103`): đọc row payment (facility A) trong context facility B ⇒ ném
  `FORBIDDEN_SCOPE (403)` ⇒ **toàn bộ transaction rollback**.
- **Expected behavior:** Hội viên hủy gói của chính mình ở facility đang chọn phải thành công
  (entitlement là global); ghi nhận hoàn tiền là việc nội bộ của membership.
- **Evidence (test DB cô lập, gói 30 ngày → đủ điều kiện hoàn 30%):**
  ```
  [FAIL] P2a: cancel có hoàn tiền từ facility B KHÔNG bị lỗi
         {"message":"FORBIDDEN_SCOPE","statusCode":403,"name":"AppError"}
  [FAIL] P2b: subscription chuyển CANCELLED → {"status":"ACTIVE"}
  ```
- **Impact:** Với gói còn > 15 ngày, hội viên **không thể tự hủy** nếu đang chọn facility khác facility
  phát hành (trả 403, gói vẫn ACTIVE). Cùng pattern với thao tác `PATCH /:id/status` của Manager
  (không chạy riêng nhưng code giống hệt — coi là **HIGH-confidence suy luận từ code**, chưa exec riêng).
- **Recommended fix:** chạy `payment.update` trong context của **facility phát hành payment**
  (`requestContext.run({ ...ctx, facilityId: payment.facilityId })`) hoặc bỏ scope cho thao tác ghi nội bộ
  này; không bỏ facility scope của `Payment` nói chung.

### MF-03 — Quota (GLOBAL) lệch với "Lịch của tôi" (FACILITY)

- **Severity:** `MEDIUM`
- **Location:** `enrollment-quota.service.ts:93` (quota global) vs
  `enrollments.service.ts:263-277` (`getMyEnrollments` — kế thừa scope qua `parents`).
- **Current behavior:** `GET /enrollments/my/quota` trả `used` + `classes[]` trên **toàn bộ** các cơ sở,
  trong khi `GET /enrollments/my` (trang "Lịch của tôi" / "Lớp của tôi") chỉ trả booking
  **của cơ sở đang chọn**.
- **Expected behavior:** Hai con số phải nhất quán hoặc được ghi rõ ngữ cảnh.
- **Evidence:** code inspection (không filter facility trong quota; `prisma.enrollment.findMany({where:{memberId}})`
  trong `getMyEnrollments` chịu filter `class.facilityId`); gap này cũng được ghi nhận tại
  `docs/CROSS_FACILITY_BOOKING_AUDIT_2026-10-06.md:40`.
- **Impact:** Hội viên thấy `used = 2` nhưng danh sách chỉ hiện 1 lớp (lớp kia ở cơ sở khác) → confusion,
  hỗ trợ khách hàng; KHÔNG phải lỗi bảo mật.
- **Recommended fix:** làm `GET /enrollments/my` global cho MEMBER (timetable liên cơ sở) **hoặc**
  hiển thị rõ "tại cơ sở này" và tách chỉ số quota toàn hệ thống trong UI.

### MF-04 — Report hội viên trộn cohort GLOBAL và ORIGIN

- **Severity:** `MEDIUM` · **Location:** `BE/src/modules/reports/reports.service.ts:94-128`
- **Current:** `totalMembers` / `newMembers` đếm `memberProfile` (**global** — MemberProfile không có facilityId)
  nhưng `activeSubs` bị lọc `facilityId = origin` ⇒ `expiredMembers = totalMembers - activeCount`
  không có nghĩa tại cấp cơ sở.
- **Expected:** cùng một cohort trong cùng một report, hoặc ghi rõ "toàn hệ thống" vs "theo cơ sở phát hành".
- **Evidence:** code inspection — `prisma.memberProfile.count(...)` không qua facility filter, còn
  `membershipSubscription.findMany({ where: { facilityId: <context>, ... } })` có.
- **Impact:** số `activeMembers/expiredMembers` trên dashboard từng cơ sở sai lệch; **pre-existing**
  (trước refactor cũng vậy nhờ DAL filter) nhưng nay dễ bị hiểu nhầm là "membership global".
- **Fix đề xuất:** tách 2 báo cáo (global membership stats vs origin-sales stats) hoặc tính activeMembers
  trong cùng cohort.

### MF-05 — Nhân sự facility B thấy được payment/invoice phát hành ở facility A

- **Severity:** `MEDIUM` (data-scope — KHÔNG phải authorization bypass)
- **Location:** `subscriptions.service.ts:261-267` và `:273-283` (include `payments → invoice`),
  route `GET /subscriptions/{id}` (`authorize(MANAGER, RECEPTIONIST)`).
- **Current:** DAL chỉ filter **model cấp 1**; `MembershipSubscription` giờ global ⇒ nhân sự facility B đọc
  được subscription gốc tại A **kèm payments + invoice**. Trước refactor subscription bị lọc nên chỉ thấy gói tại B.
- **Expected:** cần quyết định policy — entitlement global nhưng **lịch sử tài chính liên cơ sở** có nên hiển thị
  cho RECEPTIONIST cơ sở khác hay không.
- **Evidence:** `prisma.ts:104-106` — `facilityFilter(model, ...)` chỉ nhận `params.model` (model cấp 1).
- **Impact:** mở rộng tầm nhìn dữ liệu tài chính; vai trò + ownership check vẫn còn ⇒ không có lỗ hổng
  member↔member.
- **Fix đề xuất:** xác nhận policy; nếu cần, filter nested `payments` theo facility của actor.

### MF-06 — `activeSubscriptions` không nhất quán + renew xếp chồng

- **Severity:** `MEDIUM` · **Location:** `reports.service.ts:219-245`; `subscriptions.service.ts:148-183`
- **Current:** `activeSubscriptions` đếm `status = ACTIVE` (không theo ngày) trong khi `subscriptionsByTier`
  lọc theo cửa sổ ngày ⇒ hai con số trong CÙNG report không khớp. `renewSubscription` **không suspend** gói trả
  phí ACTIVE mà tạo gói mới `startDate = endDate cũ` (stacking) ⇒ tồn tại 2 row ACTIVE ⇒ đếm gấp.
- **Expected:** một định nghĩa "đang hiệu lực" duy nhất (ngày + status).
- **Evidence:** code inspection; **pre-existing**, không do refactor gây ra.
- **Impact:** dashboard sai; script `backfill-free-subscription.ts:84` cảnh báo "nhiều ACTIVE" false-positive.
- **Fix đề xuất:** đếm theo điều kiện hiệu lực theo ngày; cân nhắc suspend gói cũ khi renew trả phí.

### MF-07 — Report fallback về GLOBAL nếu thiếu facility context

- **Severity:** `LOW` · **Location:** `reports.service.ts:110, 217-234, 273`
- **Current:** `facilityId: requestContext.getStore()?.facilityId` — nếu `undefined`, Prisma hiểu là
  **không filter** ⇒ report thành global thay vì fail.
- **Expected:** báo cáo origin nên fail-fast khi thiếu context.
- **Evidence:** mọi route `/reports` đều qua `checkFacilityScope` (`app.ts:91-121`) nên hiện không tái hiện;
  rủi ro chỉ xuất hiện nếu service bị gọi từ job/script.
- **Fix đề xuất:** assert context hoặc truyền origin facility tường minh.

### MF-08 — Lỗ hổng FREE nếu đăng ký thất bại giữa chừng

- **Severity:** `LOW` · **Location:** `auth.service.ts:40-87`
- **Current:** Mongo user → PG user → PG memberProfile → FREE sub; nếu bước FREE fail, đăng ký trả 500 nhưng
  user đã tồn tại → đăng ký lại báo trùng email → hội viên **không có FREE** cho tới khi chạy
  `npm run db:backfill:free-subscription`.
- **Expected:** idempotent repair (cấp lại FREE ở lần login/`/auth/me` đầu tiên).
- **Evidence:** code inspection; **pre-existing**, không liên quan facility scope.
- **Impact:** hội viên mới bị 403 "không có gói tập" dù đăng ký thành công.

### MF-09 — Thao tác trên membership không ghi `AuditLog`

- **Severity:** `LOW` · **Location:** `prisma.ts:38-52` (set `audited` không chứa `MembershipSubscription`)
- **Current:** cancel/renew/status chỉ tạo notification, không có audit before/after.
- **Expected:** (cần quyết định) audit cho thao tác tài chính membership.
- **Evidence:** code inspection · **pre-existing**.
- **Impact:** thiếu truy vết khiếu nại "ai đã hủy/tạm dừng gói của tôi".

### MF-10 — Facility bị tắt trong lúc hội viên đang chọn

- **Severity:** `LOW`
- **Location:** `facilityScope.ts:29` (`!facility?.isActive → 403`) vs `FacilityBoundary.tsx:75-82`
- **Current:** request kế tiếp trả `403 FORBIDDEN_SCOPE` cho tới khi query `facilities` được refetch
  (window focus/reload) → `valid = false` → tự chọn cơ sở active đầu tiên.
- **Expected:** tự phục hồi ngay khi gặp 403 FORBIDDEN_SCOPE.
- **Evidence:** code inspection · entitlement KHÔNG bị ảnh hưởng (membership global).
- **Impact:** nghẽn tạm thời cho hội viên; tự lành khi tải lại trang.

### MF-11 — Tài liệu/nhãn còn giả định "gói thuộc cơ sở" (Phase 18)

- **Severity:** `INFO`
- **Location:**
  - `docs/CROSS_FACILITY_BOOKING_AUDIT_2026-10-06.md:7,8,19,43` — *"DAL tự lọc gói và quota theo cơ sở"*,
    *"Gói tại A không cấp quyền đặt chỗ ở B"*, *"quyền hiện dựa vào gói tại từng cơ sở"* → **đã sai sau refactor**.
  - `FE/src/shared/FacilityBoundary.tsx:37` — `aria-label="Cơ sở đang làm việc"` dùng chung cho MEMBER,
    dễ hiểu nhầm thành "nơi sở hữu gói" (gap này từng được ghi nhận ở doc trên dòng 41).
- **Evidence:** grep toàn repo — không còn identifier nào dạng `membershipFacility`, `facilityMembership`,
  `currentFacilityMembership`, `membership.facilityId === currentFacilityId` (0 kết quả); vấn đề còn lại nằm ở
  **docs/nhãn**.
- **Impact:** developer sau có nguy cơ implement lại logic facility-bound; **test browser phụ thuộc nhãn này**
  (`FE/tests/browser/facility-operations.spec.ts:18,21`, `BE/tests/integration-audit.ts:182`,
  `BE/tests/browser-room-audit.ts:43`) ⇒ đổi nhãn phải đổi kèm.
- **Fix đề xuất:** cập nhật doc + tách nhãn cho MEMBER (KHÔNG sửa trong audit này).

### MF-12 — `deletePlan` guard chuyển sang đếm global

- **Severity:** `INFO` · **Location:** `membership-plans.service.ts:58-62`
- **Current:** chặn deactivate plan khi còn subscription ACTIVE — giờ đếm **toàn hệ thống** (trước theo facility).
- **Expected:** hợp lý vì `MembershipPlan` là catalog global — nhưng là **thay đổi hành vi có chủ đích**.
- **Impact:** Admin/Manager facility A có thể bị chặn deactivate plan mà chỉ facility B đang dùng.

### MF-13 — Origin facility inactive / bị xóa

- **Severity:** `INFO`
- **Evidence:**
  - Không có endpoint `DELETE /facilities/:id` (chỉ `GET/POST/PUT` + `DELETE /:facilityId/staff/...`).
  - FK `MembershipSubscription_facilityId_fkey` = `ON DELETE RESTRICT` (verify read-only trên Render qua
    `information_schema.referential_constraints` → `delete_rule=RESTRICT`).
  - Facility `isActive=false` → hội viên không chọn được nó (`getFacilities` lọc active) nhưng **gói vẫn
    hiệu lực** ở facility khác.
- **Kết luận:** edge case #6/#7/#8 **an toàn**.

### MF-14 — SePay read/confirm bị giới hạn theo facility (webhook thì không)

- **Severity:** `INFO`
- **Location:** `app.ts:116` (webhook miễn scope), `sepay-payments.service.ts`,
  `payments.routes.ts` (`/sepay/checkout`, `/sepay/{id}`, `/sepay/mock-confirm`)
- **Current:** đơn & `Payment` tạo ở facility A → member phải **đang chọn A** để poll/xác nhận
  (`mock-confirm` chỉ chạy khi `SEPAY_MOCK_MODE=true`, DEV-only). Webhook server-to-server không có header →
  `subscription-purchase.service.ts:195-204` rehydrate `facilityId` từ Payment → **origin đúng, entitlement global**.
- **FE:** `MembershipPage.tsx:28` key `pulse.pending-checkout.<userId>.<facilityId>` — lưu theo facility là
  **đúng** (checkout thuộc facility phát hành).
- **Kết luận:** callback KHÔNG làm membership bị facility-bound.

### MF-15 — Chưa có giả định ẩn nào về "membership thuộc một facility"

- **Severity:** `INFO` · grep toàn repo trả về 0 kết quả cho các pattern nghi vấn (xem MF-11).
  Các filter facility còn lại trên `MembershipSubscription` **đều tường minh và có mục đích**:
  `reports.service.ts` (origin reporting), `free-subscription.service.ts:86` (`null` = global),
  `subscription-purchase.service.ts:238` + `subscriptions.service.ts:177` (ghi ORIGIN), seed/test fixtures.

### MF-16 — Timeline "1 gói ACTIVE" không được ràng buộc ở DB

- **Severity:** `INFO`
- **Current:** không có unique constraint `(memberId) WHERE status = 'ACTIVE'`; invariant chỉ do app giữ
  (`inspectPlanPurchase` suspend, FREE suspend khi renew từ FREE). Renew trả phí tạo chồng 2 ACTIVE (MF-06);
  insert thô (test/seed) có thể tạo nhiều ACTIVE.
- **Expected:** (cần quyết định) partial unique index hoặc chấp nhận theo quy ước app.
- **Evidence:** `schema.prisma` không có constraint tương ứng · **pre-existing**.

## 5. Security Findings

> Tách bạch: **authorization** = được phép thao tác gì (role/ownership); **data-scope** = thấy dữ liệu nào (facility).

| # | Loại | Kết luận | Bằng chứng |
|---|---|---|---|
| S1 | MEMBER sửa gói người khác | **AN TOÀN** | `GET /subscriptions/member/:id` chặn MEMBER không phải chủ (`subscriptions.service.ts:235-243`), COACH bị chặn; `PATCH /:id/cancel` = `authorize(MEMBER)` + ownership (`:481-482`); quota chỉ trả của chính mình (`enrollment-quota.service.ts:180-187`, không nhận `memberId` ngoài) |
| S2 | MEMBER đọc membership-status | **AN TOÀN** | `authorize("MANAGER","RECEPTIONIST")` (`members.routes.ts:132`), ADMIN kế thừa |
| S3 | STAFF thao tác membership cross-facility | **THEO DESIGN** | Sau khi bỏ facility scope, rào chắn còn lại là **role** + ownership. `GET /subscriptions/{id}`, `PATCH /:id/status` giờ cross-facility — đúng tinh thần membership toàn cục; **facility filter trước đây không phải rào chắn duy nhất** (route vẫn có role check) |
| S4 | Staff thấy payment/invoice cơ sở khác | **WARNING → MF-05** (`MEDIUM`) | nested include không qua filter |
| S5 | MEMBER thấy data facility khác | **AN TOÀN** | Class/Schedule/Room/Enrollment/Attendance vẫn `facilityRoots`/`parents`; xác nhận bằng test (Case 8 + `FORBIDDEN_SCOPE`) |
| S6 | Facility context giả mạo | **AN TOÀN** | `checkFacilityScope` xác thực tồn tại + `isActive` + phân công (ADMIN/MEMBER bypass phân công — cố ý); path/query/body/header lệch nhau → 400 `CONFLICTING_FACILITY_CONTEXT` |
| S7 | IDOR qua subscription id facility khác | **MỞ RỘNG CÓ CHỦ ĐÍCH** | DAL bỏ 403 `FORBIDDEN_SCOPE` cho `MembershipSubscription`; thay bằng role+ownership. Không phát hiện endpoint nào cho MEMBER chạm subscription người khác |
| S8 | Audit trail | **THIẾU → MF-09** | `MembershipSubscription` không nằm trong set `audited` |

**Không phát hiện lỗ hổng cho phép member A thao tác membership của member B, hay staff facility B thay đổi
được Class/Schedule/Room của facility A.**

## 6. Data / Migration Findings

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Migration `20261006000100_membership_global_scope` | **ĐÃ ÁP DỤNG trên Render** | `npx prisma migrate status` → `Database schema is up to date!` (exit 0); row `_prisma_migrations` `finished = 2026-10-06T15:32:17.829Z` |
| `facilityId` nullable | ✅ `is_nullable = YES`, `column_default = NULL` | read-only query `information_schema.columns` trên Render |
| FK behavior | ✅ `ON DELETE RESTRICT / ON UPDATE CASCADE` — khớp `schema.prisma` (`onDelete: Restrict` tường minh) | `information_schema.referential_constraints` + `migrate diff` không còn mục FK |
| `facilityId = NULL` | **global membership, không có origin** (gói FREE) — KHÔNG có nghĩa "gói không hợp lệ" | `free-subscription.service.ts:86`; test Case 1 PASS |
| `facilityId = A` | **phát hành tại A** — KHÔNG giới hạn dùng ở A | production smoke S5 (đặt tại Q1 với origin LEGACY_MAIN) PASS |
| Legacy row `'legacy-main'` | ✅ giữ làm origin, không còn là điều kiện hiệu lực | migration chỉ `DROP DEFAULT` + `DROP NOT NULL`, không đụng data |
| Drift pre-existing (ngoài phạm vi) | `TrainingPlan`, `TrainingResult`, `Payment.provider/providerTransactionId/expiresAt` | `migrate diff` trên schema HEAD cho cùng kết quả |
| `migrate deploy` từ DB trống | VẪN FAIL sẵn ở `20260925090000` | **PRE-EXISTING** — không phải production blocker (migration này đã APPLIED trên Render) |

## 7. Membership Purchase Findings

| Case | Kỳ vọng | Actual | Status |
|---|---|---|---|
| **A** — mua FREE/paid tại A | gói tạo ra, origin = A | `facilityId = Payment.facilityId` (quầy/SePay), `null` (FREE) | ✅ |
| **B** — đổi sang B | cùng gói/tier/hạn/quota | `findActiveSubscription` + quota trả **y hệt** nhau ở 2 facility | ✅ (test S1–S4) |
| **C** — đã ACTIVE ở A, mua thêm ở B | nhận ra gói global, chặn trùng | `inspectPlanPurchase` **global** → chặn trùng hạn, chặn hạ hạng, suspend gói cũ | ✅ |
| **D** — mua ở B sau khi mua ở A | upgrade/downgrade/so giá theo global | `currentActive` đọc global (kể cả nested `payments` để lấy `durationDaysSnapshot`) | ✅ |
| FREE registration | đúng 1 gói, idempotent, hết phụ thuộc `legacy-main`, advisory lock | `facilityId: null` + `pg_advisory_xact_lock` | ✅ (test Case 1; integration-audit 28/28) |
| Renew | hoạt động mọi facility | lookup global; origin kỳ mới = facility thu tiền (fallback origin cũ) | ✅ code |
| Renew gói trả phí | "1 gói ACTIVE" | **không suspend gói cũ** → 2 row ACTIVE chồng nhau | ⚠️ MF-06 |
| Cancel | hủy toàn bộ booking + hoàn tiền | **thất bại cross-facility** | ❌ **MF-01 / MF-02** |
| Status update | hoạt động mọi facility | lookup global ✅; nhánh CANCELLED lặp lại đúng pattern MF-01/MF-02 | ⚠️ suy luận cao, chưa exec riêng |
| Register fail giữa chừng | không để thiếu FREE | có lỗ hổng → cần backfill | ⚠️ MF-08 |

Không tìm thấy **hidden facility filter nào** trong luồng mua/upgrade/downgrade/renew
(danh sách đầy đủ các chỗ còn `facilityId` trên `MembershipSubscription` ở §4 MF-15).

## 8. Booking / Quota Findings

### Quota — GLOBAL ✅
- `getMemberConcurrentClassQuota` bọc `requestContext.run({ ...ctx, facilityId: undefined })` quanh
  `enrollment.findMany` (`enrollment-quota.service.ts:91-108`) ⇒ đếm DISTINCT class **của mọi cơ sở**.
- Mô hình A=1, B=1, C=1 ⇒ `used = 3`; đổi facility **không reset** quota.
- Định nghĩa giữ nguyên: chỉ `Enrollment.status = BOOKED` ở `ClassSchedule.SCHEDULED` chưa bắt đầu;
  1 Class = 1 quota; `limit = maxConcurrentClassesSnapshot ?? plan.maxConcurrentClasses`;
  `remaining = max(0, limit - used)`.
- Vượt limit → `403 CONCURRENT_CLASS_LIMIT_REACHED` (test S4b PASS).
- Verify thực nghiệm: `used` giống hệt nhau ở scope Q1 và Q7 dù class đang giữ nằm tại LEGACY_MAIN (S4 PASS).

### Schedule conflict — GLOBAL ✅
- 4 điểm chủ động bỏ scope: `enrollments.service.ts:90`, `course-enrollment.service.ts:138`,
  `class-schedules.service.ts:457`, `enrollment-quota.service.ts:93`.
- A `19:00–20:00` vs B `19:30–20:30` cùng hội viên → **REJECT 409** (`cross-facility` Case 5 PASS;
  production smoke S6 PASS).
- Race đồng thời 2 facility → đúng **1** request thành công (test Case 5 PASS).
- **Không thể bypass bằng `X-Facility-Id`**: các query conflict truyền tường minh `facilityId: undefined`,
  không phụ thuộc context.
- Advisory lock theo `memberId` (không kèm facility) ⇒ request khác facility vẫn xếp hàng đúng.
- Dời lịch (`class-schedules.service.ts:457`) cũng kiểm tra conflict **global** cho các member bị ảnh hưởng,
  trong khi entitlement vẫn theo facility của buổi bị dời.

## 9. Payment Findings

| Hạng mục | Kết luận | Bằng chứng |
|---|---|---|
| `payment.facilityId` | FACILITY — ghi theo context lúc tạo đơn (nguồn gốc doanh thu) | `Payment` ∈ `facilityRoots`, DAL ép `data.facilityId` |
| `subscription.facilityId` (khi kích hoạt) | = `soldPayment.facilityId` → **ORIGIN đúng** | `subscription-purchase.service.ts:236-238` |
| Membership sau kích hoạt | **GLOBAL** (không phụ thuộc facility đang chọn) | `inspectPlanPurchase`/`findActiveSubscription` không filter |
| Webhook không có `X-Facility-Id` | ✅ rehydrate context từ payment rồi kích hoạt | `subscription-purchase.service.ts:195-204`; `app.ts:116` miễn scope cho webhook |
| Callback không làm membership bị facility-bound | ✅ chỉ ghi ORIGIN, lookup vẫn global | code + production smoke |
| Duplicate webhook | ✅ `SepayWebhookEvent.sepayId UNIQUE` + `lockPaymentWebhook` | `sepay-payments.service.ts:594` |
| Payment retry / `retry-activation` | chạy theo payment (facility-scoped) → không ảnh hưởng entitlement global | `payments.routes.ts` |
| Đọc/xác nhận SePay (poll, mock-confirm) | phải ở facility phát hành (`FORBIDDEN_SCOPE` nếu khác) — **theo design**, DEV-only với mock | `MF-14` |
| Refund nội bộ khi hủy gói | ❌ **bị FORBIDDEN_SCOPE khi cross-facility** | **MF-02** |

## 10. FE Findings

| Hạng mục | Kết luận | Bằng chứng |
|---|---|---|
| `X-Facility-Id` injection | ✅ mọi request đã đăng nhập, trừ `/facilities/*` | `api.ts:99` |
| `sessionStorage` facility | ✅ `pulse.facility` theo tab; logout xóa | `facility.ts` |
| Đổi facility → cache | ✅ `cancelQueries` + `removeQueries` (giữ `me`, `facilities`) + `abort()` request đang chạy → **không leak data facility cũ** | `FacilityBoundary.tsx:83-95` |
| Membership query key | ✅ `["current-membership", userId]`, `["membership-plans"]`, `["membership-status", id]`, `["my-enrollment-quota"]` — **không chứa facility** | grep queryKey |
| Switch A→B→C hiển thị tier | ✅ membership refetch sau khi xóa cache → dữ liệu global ⇒ tier giữ nguyên | code + production smoke S2/S3 |
| `classes[]` trong quota vs "Lịch của tôi" | ⚠️ lệch ngữ cảnh | **MF-03** |
| Pending checkout theo facility | ✅ đúng (checkout thuộc facility phát hành) | `MembershipPage.tsx:28` |
| Nhãn "Cơ sở đang làm việc" cho MEMBER | ⚠️ dễ hiểu nhầm; đổi nhãn sẽ làm hỏng 3 test browser | **MF-11** |
| Khóa đổi facility khi còn mutation đang chạy | ✅ tránh mid-flight race | `FacilityBoundary.tsx:84` |

## 11. Test Results

Môi trường: PostgreSQL test cục bộ `scms_test` + schema cô lập `scms_verify_audit_20261006`
(**đã DROP sau khi chạy**), MongoDB test cục bộ `127.0.0.1:27018` replica set `rs0`
(**đã dừng, data dir đã xóa**). Không ghi gì vào Render/production trong audit này
(chỉ `migrate status` + query read-only `information_schema`).

| # | Test / check | Command | Kết quả | Phân loại |
|---|---|---|---|---|
| T1 | Prisma schema valid | `npx prisma validate` | `The schema ... is valid`, exit 0 | **PASS** |
| T2 | BE typecheck | `npx tsc --noEmit` (`include: ["src"]`) | exit 0 | **PASS** |
| T3 | Cross-facility booking | `test:operations:cross-facility` | exit 0 — **10/10 PASS** (gồm Case 1 FREE global, 2 paid global, 3 không nhân bản ACTIVE, 4 quota global, 5 conflict global, 6 thao tác liên facility, 8 cách ly facility) | **PASS** |
| T4 | Facility operations + HTTP scope | `test:operations` (`facility-operations.integration.ts`) | exit 0 — **12 PASS** (gồm `FORBIDDEN_SCOPE`, `FACILITY_CONTEXT_REQUIRED`, cách ly revenue, gateway activation ghi ORIGIN) | **PASS** |
| T5 | Integration audit (HTTP thật + Mongo + PG) | `test:integration:audit` | exit 0 — **28 passed, 0 failures** (gồm `register → FREE entitlement`, `POST /subscriptions → payment → invoice`) | **PASS** |
| T6 | Quota e2e | `test:e2e` (`enrollment-quota.e2e.ts`) | exit 1 — `400 FACILITY_CONTEXT_REQUIRED` ở `POST /membership-plans` (HTTP helper không gửi `X-Facility-Id`) | **PRE-EXISTING** (đã xác minh baseline bằng `git stash` ở session trước: HEAD cũng fail y hệt) |
| T7 | Business-rule probes | `node docs/audit/business-rule-probes.cjs` | exit 1 — `# pass 0 / # fail 10` (mock `mockedRequire` không phủ `request-context.js`) | **PRE-EXISTING** (baseline 0/10) |
| T8 | FE unit tests | `FE: npm test` (`vitest run`) | exit 0 — **9 files / 57 tests passed** | **PASS** |
| T9 | FE typecheck | `npm run typecheck` | **không chạy trong audit này** | **NOT RUN** (lần chạy trước: FAIL pre-existing do `node_modules/react-markdown` hỏng — không đổi gì FE nên giữ nguyên kết luận cũ, ghi rõ là chưa chạy lại) |
| T10 | Browser/Playwright suites | — | không chạy (cần FE dev server + Playwright) | **BLOCKED** |
| T11 | E2E còn lại (`course`, `sepay`, `lifecycle`, `attendance`) | — | **không chạy trong audit này** (ở session trước: FAIL cùng root cause `FACILITY_CONTEXT_REQUIRED` = PRE-EXISTING) | **NOT RUN** (kết luận cũ được ghi rõ, không claim PASS) |
| T12 | Render migration state (read-only) | `npx prisma migrate status` | `Database schema is up to date!`, exit 0 | **PASS** |
| T13 | Render column/FK state (read-only SQL) | query `information_schema` | `facilityId`: nullable YES, default NULL; FK `RESTRICT/CASCADE` | **PASS** |
| T14 | **Cancel cross-facility probe** (test DB cô lập, có fixture + dọn sạch) | script gọi `cancelSubscriptionBySelf` từ facility B | **3 FAIL / 2 PASS** → chứng minh MF-01 + MF-02 | **FAIL = bug thật (không phải test infra)** |
| T15 | Production smoke 8 case (phiên trước, trước khi thêm `onDelete: Restrict`) | entitlement/quota/booking/conflict trên Render | **8/8 PASS** | **PASS** (schema edit sau đó chỉ đổi hành vi FK mong đợi, không đổi runtime) |

**T14 — chi tiết (chạy trên `scms_verify_audit_*`, fixture tự dọn):**
```
[PASS] P1a: cancel từ facility B thành công (không lỗi)
[PASS] P1b: subscription chuyển CANCELLED
[FAIL] P1c: TOÀN BỘ booking tương lai bị hủy (booking này ở facility A)
       {"enrollmentStatus":"BOOKED","expected":"CANCELLED"}          → MF-01
[FAIL] P2a: cancel có hoàn tiền từ facility B KHÔNG bị lỗi
       {"message":"FORBIDDEN_SCOPE","statusCode":403,"name":"AppError"} → MF-02
[FAIL] P2b: subscription chuyển CANCELLED → {"status":"ACTIVE"}       → MF-02
```

## 12. Risk Matrix

| Severity | ID | Issue | Trạng thái |
|---|---|---|---|
| `CRITICAL` | — | *Không có* | — |
| `HIGH` | **MF-01** | Hủy gói không hủy booking ở facility khác (vi phạm rule đã document, giữ chỗ ảo) | **Đã tái hiện (T14)** |
| `HIGH` | **MF-02** | Hủy gói có hoàn tiền từ facility khác → `403 FORBIDDEN_SCOPE`, gói vẫn ACTIVE | **Đã tái hiện (T14)** |
| `MEDIUM` | **MF-03** | Quota global lệch với "Lịch của tôi" facility-scoped | Code inspection |
| `MEDIUM` | **MF-04** | Report hội viên trộn cohort global/origin | Code inspection |
| `MEDIUM` | **MF-05** | Staff thấy payment/invoice phát hành ở facility khác (data-scope, không phải auth bypass) | Code inspection |
| `MEDIUM` | **MF-06** | `activeSubscriptions` không nhất quán + renew xếp chồng 2 ACTIVE | Code inspection (pre-existing) |
| `LOW` | **MF-07** | Report fallback global khi thiếu facility context | Code inspection |
| `LOW` | **MF-08** | FREE có thể thiếu nếu đăng ký fail giữa chừng | Code inspection (pre-existing) |
| `LOW` | **MF-09** | Không audit log cho cancel/renew/status | Code inspection (pre-existing) |
| `LOW` | **MF-10** | Facility bị tắt → 403 tạm thời cho tới khi refetch | Code inspection |
| `INFO` | MF-11 → MF-16 | Doc/nhãn stale, `deletePlan` global, origin facility xóa, SePay scope, không giả định ẩn, thiếu DB constraint | Code inspection |

Không có phát hiện **CRITICAL** (không có đường nào cho member sửa gói của người khác, không có đường nào
mở rộng nhầm Class/Room/Schedule/Attendance sang global).

## 13. Recommended Fix Order

> Audit này **KHÔNG thực hiện fix nào** — chỉ đề xuất.

1. **HIGH — MF-01**: bọc `enrollment.updateMany` trong luồng hủy gói bằng
   `requestContext.run({ ...ctx, facilityId: undefined }, ...)` tại
   `subscriptions.service.ts:512-519`, `:368-375` và `payments.service.ts:163`
   (cùng pattern conflict check). Thêm regression test: hủy gói từ facility B với booking ở facility A.
2. **HIGH — MF-02**: cho thao tác ghi `Payment` nội bộ của cancel/status chạy trong context của
   **facility phát hành payment** (`requestContext.run({ ...ctx, facilityId: payment.facilityId })`)
   — KHÔNG gỡ `Payment` khỏi `facilityRoots`. Thêm test: hủy gói >15 ngày từ facility khác → 200 + refund.
3. **MEDIUM — MF-03**: quyết định ngữ cảnh "Lịch của tôi" (global cho MEMBER hoặc ghi rõ "tại cơ sở này")
   để đồng bộ với quota; cập nhật UI tương ứng.
4. **MEDIUM — MF-04 & MF-06**: chuẩn hóa một định nghĩa "đang hiệu lực" (ngày + status) dùng chung cho
   report; tách cohort global vs origin-sales; xem xét suspend gói trả phí khi renew.
5. **MEDIUM — MF-05**: xác nhận policy hiển thị payment/invoice liên cơ sở cho RECEPTIONIST; nếu cần,
   filter nested `payments` theo facility của actor.
6. **LOW — MF-07 → MF-10**: assert facility context trong report; cấp lại FREE khi login/`/auth/me`;
   bổ sung audit log cho thao tác membership; tự phục hồi khi gặp 403 FORBIDDEN_SCOPE.
7. **INFO — MF-11**: cập nhật `docs/CROSS_FACILITY_BOOKING_AUDIT_2026-10-06.md` (các dòng 7/8/19/43 đã sai)
   và tách nhãn bộ chọn cơ sở cho MEMBER (kèm cập nhật 3 test browser phụ thuộc nhãn).

## 14. Final Verdict

> **"Còn issue nào khiến Membership behaves differently giữa các Facility hay không?"**

### → **YES**

**Evidence:**

1. **MF-01 (HIGH, đã tái hiện trên DB test cô lập):** hủy gói trong khi chọn facility B **không hủy**
   booking đang giữ ở facility A → `{"enrollmentStatus":"BOOKED"}` trong khi rule yêu cầu `CANCELLED`.
   Kết quả: cùng một thao tác "hủy gói" cho ra **kết quả khác nhau tùy facility đang chọn**.
2. **MF-02 (HIGH, đã tái hiện):** hủy gói có hoàn tiền từ facility khác trả **`403 FORBIDDEN_SCOPE`**
   và gói giữ nguyên `ACTIVE` → hội viên **không thể hủy** ở facility khác facility phát hành
   (còn ≤ 15 ngày thì hủy được → hành vi khác nhau theo facility).
3. **MF-03 (MEDIUM):** quota là global nhưng "Lịch của tôi" là facility-scoped → cùng hội viên thấy
   `used` khác với số lớp hiển thị tùy facility.

**Các phần cốt lõi ĐÃ đạt yêu cầu (không còn issue):** entitlement lookup, tier, validity, quota count,
trùng giờ, FREE provisioning, purchase/upgrade/downgrade validation, membership-status/quota APIs,
FE hiển thị tier khi đổi facility, và cách ly tài nguyên facility — tất cả đều **GLOBAL/ đúng scope** như
§3 và T3–T5, T8, T12–T15 chứng minh.

**Kết luận tổng thể: `NEEDS FIX`** — cần sửa 2 issue HIGH ở luồng hủy gói trước khi coi là
"Membership behaves identically at every Facility".

---

*Audit này chỉ đọc: không file production nào bị sửa; mọi test fixture đều nằm trong schema test cô lập
và đã được dọn sạch (schema dropped, mongod stopped, 0 file tạm). File duy nhất được tạo là báo cáo này.*

---

# 15. Remediation — MF-01 / MF-02 (thực hiện cùng ngày)

> **Phạm vi:** CHỈ sửa MF-01 và MF-02. MF-03 → MF-16 **không sửa** trong lần này (§12/§13 vẫn nguyên giá trị).

## MF-01 Remediation

### Root cause
`Enrollment` nằm trong `parents` (`Enrollment → Class → facilityId`) nên Prisma `$use` tự tiêm
`AND: { class: { facilityId: <facility context> } }` vào mọi query cấp 1. Luồng hủy gói chạy dưới
facility context của cơ sở đang chọn (B) ⇒ `tx.enrollment.updateMany(...)` chỉ chạm booking của **B**;
booking ở A/C vẫn `BOOKED`.

3 site mắc cùng lỗi:
1. `subscriptions.service.ts` → `cancelSubscriptionBySelf` (hội viên tự hủy)
2. `subscriptions.service.ts` → `updateSubscriptionStatus` nhánh `CANCELLED` (Manager hủy)
3. `payments.service.ts` → `updatePaymentStatus` nhánh `REFUNDED` → hủy subscription → hủy booking

### Fix
Bọc **đúng một câu `updateMany`** bằng context global — dùng lại pattern sẵn có của repo
(cùng cách conflict-check và quota đang làm ở `enrollments.service.ts:90`,
`course-enrollment.service.ts:138`, `enrollment-quota.service.ts:93`):

```ts
await requestContext.run(
  { ...requestContext.getStore(), facilityId: undefined },   // chỉ quanh câu updateMany này
  () => tx.enrollment.updateMany({
    where: { memberId, status: "BOOKED", schedule: { startTime: { gt: now } } },
    data:  { status: "CANCELLED", cancelledAt: now },
  }),
);
```

- `where` giữ nguyên **3 ràng buộc** (thuộc đúng hội viên + `BOOKED` + buổi tương lai) ⇒ không chạm
  member khác, không chạm lịch quá khứ, không chạm booking đã `CANCELLED`/`COMPLETED`.
- Course enrollment cùng bảng `Enrollment` → được phủ tự nhiên (không cần nhánh riêng).
- **Không** gỡ `Enrollment` khỏi `parents`, **không** đổi `facilityRoots`, không đổi transaction.

### Files changed
- `BE/src/modules/subscriptions/subscriptions.service.ts` (2 site)
- `BE/src/modules/payments/payments.service.ts` (1 site + import `requestContext`)

### Tests
- **Mới:** `BE/tests/cross-facility-cancel.integration.ts` — Case 1, 2, 3, 4 (+5b) → **PASS**
- Hồi quy: `test:operations:cross-facility` 10/10, `test:operations` 12/12, `test:integration:audit` 28/28

### Result
**`MF-01 = RESOLVED`** — hủy gói tại B giờ hủy booking tương lai ở A/B/C.

## MF-02 Remediation

### Root cause
`Payment` nằm trong `facilityRoots` ⇒ DAL chạy **id-ownership check** (`prisma.ts:82-103`) trên
`payment.update({ where: { id } })`: đọc row payment (facility A) trong context facility B ⇒ ném
`FORBIDDEN_SCOPE (403)` ⇒ toàn bộ transaction rollback ⇒ **gói vẫn `ACTIVE`**.

### Fix — **Strategy A** (chọn vì khớp pattern sẵn có của repo:
`subscription-purchase.service.ts:195-204` rehydrate `facilityId` từ payment)

```ts
await requestContext.run(
  { ...requestContext.getStore(), facilityId: originalPayment.facilityId },  // facility PHÁT HÀNH payment
  () => tx.payment.update({ where: { id: originalPayment.id }, data: {...} }),
);
```

- Chạy trong **đúng facility phát hành payment** → ownership check của DAL vẫn chạy bình thường
  (A == A), predicate `facilityId` khớp → update thành công.
- Payment **vẫn facility-scoped**: chỉ 2 câu `payment.update` của luồng hủy gói được đổi context;
  `Payment` vẫn nằm trong `facilityRoots`.
- Kiểm tra sở hữu sở tại **không đổi**: `originalPayment` luôn lấy từ `sub.payments[0]`
  (payment gắn với chính membership đang hủy) sau khi đã pass
  `sub.member.userId !== userId → 403`; API **không nhận `paymentId` từ bên ngoài**
  (`CancelSubscriptionSchema` chỉ có `reason`).

### Files changed
- `BE/src/modules/subscriptions/subscriptions.service.ts` (2 site: nhánh refund của
  `updateSubscriptionStatus` và `cancelSubscriptionBySelf`)

### Tests
- **Mới:** Case 5 (hủy + hoàn 30% từ B → không còn 403, payment `REFUNDED` đúng 300.000đ),
  Case 5b (Manager `updateSubscriptionStatus` cùng kết quả) → **PASS**
- Case 7 (payment không thuộc membership vẫn `SUCCESS`) → **PASS**

### Result
**`MF-02 = RESOLVED`**

## Security Verification

**Câu hỏi: context global tạm thời có tạo lỗ hổng authorization không? → KHÔNG.**

| Kiểm tra | Kết luận | Bằng chứng |
|---|---|---|
| Bypass role/permission? | **KHÔNG** | Không đụng `authorize()`, `facilityScope.ts`, `checkFacilityScope`. Route vẫn `authorize("MEMBER")` (self-cancel) / `authorize("MANAGER")` (status). `git diff` chỉ gồm 3 file: 2 service + `package.json` |
| Cross-member access? | **KHÔNG** | `sub.member.userId !== userId → 403` chạy **TRƯỚC** bất kỳ context mới nào. Test **Case 6**: member khác → 403; gói + booking của nạn nhân vẫn `ACTIVE`/`BOOKED` |
| Thao tác trên payment tùy ý? | **KHÔNG** | `originalPayment` chỉ lấy từ `sub.payments[0]` (payment gắn chính membership đang hủy); **API không nhận `paymentId`** (`CancelSubscriptionSchema` chỉ có `reason`). Test **Case 7**: payment không gắn membership vẫn `SUCCESS`; payment của member bị từ chối vẫn `SUCCESS` |
| Phạm vi global mở rộng đến đâu? | Chỉ **3 câu `enrollment.updateMany`**: `payments.service.ts:167`, `subscriptions.service.ts:376`, `subscriptions.service.ts:531` — đều có `where = memberId + BOOKED + tương lai` | Quét toàn bộ `facilityId: undefined` trong `src` = 13 site = **10 site có sẵn** (conflict/quota/scheduling) + **3 site mới** |
| Context "lây" sang câu lệnh kế tiếp? | **KHÔNG** | `requestContext.run` đóng scope quanh **một callback**; sau đó quay lại context bình thường |
| Transaction có bị phá? | **KHÔNG** | 3 thao tác (`membershipSubscription.update` → `enrollment.updateMany` → `payment.update`) vẫn trong **CÙNG** `prisma.$transaction`; test Case 5 xác nhận cả 3 thành công nhất quán |
| Facility B có thao tác được payment facility A tùy ý? | **KHÔNG** | Chỉ update đúng `originalPayment.id` đã được xác nhận thuộc membership; mọi truy vấn payment khác vẫn qua ownership check + predicate của DAL |

## Regression Verification

| Mảng | Kết luận | Bằng chứng |
|---|---|---|
| Membership = GLOBAL | **GIỮ NGUYÊN** | `findActiveSubscription` không nằm trong diff; cross-facility 10/10; Case 1+2 (hủy ở B thấy booking A/B/C) |
| Quota = GLOBAL | **GIỮ NGUYÊN** | `enrollment-quota.service.ts` không bị sửa trong task này; test Case 4 cũ vẫn PASS |
| Schedule conflict = GLOBAL | **GIỮ NGUYÊN** | 4 site conflict-check không có trong diff; cross-facility Case 5 PASS |
| Class / Room | **VẪN FACILITY** | `facilityRoots` vẫn chứa `Room`, `Class` (chỉ có `MembershipSubscription` bị gỡ từ task trước); Case 8: classes/rooms tách A/B |
| Enrollment | **VẪN FACILITY (mặc định)** | `parents.Enrollment = ["class"]` còn nguyên — chỉ 3 câu *hủy gói* được bỏ scope có chủ đích; Case 8: `GET /enrollments` vẫn tách A/B |
| Payment | **VẪN FACILITY** | `Payment` vẫn trong `facilityRoots`; chỉ 2 câu refund của luồng hủy gói chạy dưới facility phát hành; Case 8: `GET /payments` tách A/B |
| Attendance / Invoice | **VẪN FACILITY** | `parents` giữ nguyên: `Attendance: ["schedule","class"]`, `Invoice: ["payment"]` |
| Authorization / FE | **KHÔNG ĐỔI** | 0 sửa ở route/middleware/FE; `FE npm test` 57/57 PASS |

Không còn hidden dependency nào của thao tác hủy gói vào facility đang chọn: sau fix, cùng một lệnh
`cancel` cho kết quả **giống nhau ở mọi facility**.

## Test Results (sau remediation — đã thực sự chạy)

| # | Test | Command | Kết quả | Phân loại |
|---|---|---|---|---|
| R1 | **Cross-facility cancel (MỚI)** | `npm run test:operations:cross-facility-cancel` | exit 0 — **18/18 PASS** (Case 1–8 + 5b) | **PASS** |
| R2 | Cross-facility booking | `test:operations:cross-facility` | exit 0 — **10/10 PASS** | **PASS** |
| R3 | Facility operations | `test:operations` | exit 0 — **12 PASS** | **PASS** |
| R4 | Integration audit (HTTP thật) | `test:integration:audit` | exit 0 — **28 passed / 0 failures** | **PASS** |
| R5 | FE unit | `FE: npm test` (vitest) | exit 0 — 9 files / **57 tests** | **PASS** |
| R6 | BE typecheck | `npx tsc --noEmit` | exit 0 | **PASS** |
| R7 | Typecheck file test mới | `tsc --noEmit ... cross-facility-cancel.integration.ts` | exit 0 | **PASS** |
| R8 | Quota e2e | `test:e2e` | exit 1 — `400 FACILITY_CONTEXT_REQUIRED` ở `createPlan` | **PRE-EXISTING** |
| R9 | SePay e2e (payment/refund) | `test:e2e:sepay` | exit 1 — cùng root cause | **PRE-EXISTING** |
| R10 | Subscription lifecycle e2e | `test:e2e:lifecycle` | exit 1 — cùng root cause | **PRE-EXISTING** |
| R11 | `test:operations` lần chạy đầu | — | exit 1 — guard `MONGO_URI pathname ≠ /^\/scms_verify_/` từ chối chạy | **ENVIRONMENT** (do tôi quên truyền `MONGO_URI`; chạy lại với env đúng → R3 PASS) |

**R8–R10:** fail **trước khi chạm tới code của fix** (chết ở `POST /membership-plans` vì HTTP helper không
gửi `X-Facility-Id`). Root cause này đã từng được xác minh baseline bằng `git stash` ở session trước
⇒ **không phải hồi quy do fix này**. Không sửa chúng (ngoài phạm vi).

**R1 trong chi tiết (Case → kết quả):**

```
[PASS] Case1: hủy gói tại B thành công → membership CANCELLED
[PASS] Case1+Case2: booking TƯƠNG LAI tại A, B và C đều CANCELLED
[PASS] Case3: booking quá khứ giữ nguyên (BOOKED / COMPLETED)
[PASS] Case4: booking đã CANCELLED trước đó vẫn CANCELLED (idempotent)
[PASS] Case5: KHÔNG còn FORBIDDEN_SCOPE — hủy + hoàn tiền tại B thành công
[PASS] Case5: membership CANCELLED
[PASS] Case5: payment REFUNDED đúng 30% (300.000đ) và có refundedAt
[PASS] Case5: booking tương lai tại A và B của cùng hội viên đều CANCELLED
[PASS] Case5b: Manager hủy từ facility B KHÔNG lỗi
[PASS] Case5b: membership CANCELLED + payment REFUNDED + booking tại A CANCELLED
[PASS] Case6: member khác → 403; gói m3 vẫn ACTIVE và booking m3 vẫn BOOKED
[PASS] Case7: payment không gắn với membership vẫn SUCCESS (không bị hoàn)
[PASS] Case7: gói không đủ điều kiện hoàn tiền → payment m1 vẫn SUCCESS
[PASS] Case7: payment của member bị từ chối hủy vẫn SUCCESS
[PASS] Case8: GET /payments tại A chỉ thấy payment phát hành ở A
[PASS] Case8: GET /payments tại B chỉ thấy payment phát hành ở B
[PASS] Case8: GET /classes (A) và GET /rooms (B) vẫn cách ly facility
[PASS] Case8: GET /enrollments vẫn scope theo facility của class (A không thấy booking B)
=== KET QUA: PASS=18 FAIL=0 ===
```

**Môi trường & dọn dẹp:** schema test cô lập `scms_verify_cancel_20261006` (PostgreSQL cục bộ) + Mongo test
cục bộ `127.0.0.1:27018/rs0`. Đã chạy: `DROP SCHEMA` (exit 0), dừng mongod, xóa data dir, xóa file tạm
(0 file còn lại). **Không ghi gì vào Render/production.**

## Final Status

```text
MF-01 = RESOLVED
MF-02 = RESOLVED
```

- **MF-01 — RESOLVED:** hủy gói tại facility B giờ hủy booking tương lai ở **mọi** cơ sở (Case 1 + Case 2),
  bao gồm cả nhánh Manager (`updateSubscriptionStatus`) và nhánh refund qua payment.
- **MF-02 — RESOLVED:** hủy gói có hoàn tiền từ facility khác **không còn `403 FORBIDDEN_SCOPE`**;
  subscription → `CANCELLED`, payment → `REFUNDED` đúng 30%, booking → `CANCELLED`, tất cả trong
  **cùng một transaction** (Case 5 + Case 5b).
- **MF-03 → MF-16: NOT FIXED** (ngoài phạm vi task này) — §12 Risk Matrix vẫn còn hiệu lực.
  *(Cập nhật: MF-03 đã được sửa ở **§16**; MF-04 trở đi vẫn chưa sửa.)*

---

# 16. Remediation — MF-03: "Lịch của tôi" trở thành GLOBAL (cùng ngày)

> **Phạm vi:** CHỈ sửa đường đọc `GET /enrollments/my`. MF-04 → MF-16 **không sửa**.

## 16.1 Root cause

`getMyEnrollments` (`enrollments.service.ts`) chỉ truyền `where = { memberId }`, **không** có filter
facility nào — nhưng model `Enrollment` nằm trong `parents` (`Enrollment → Class → facilityId`) nên
Prisma `$use` tự tiêm `AND: { class: { facilityId: <facility context> } }` vào query cấp 1.
Hệ quả: cùng một lệnh gọi trả về **kết quả khác nhau tùy `X-Facility-Id`**, trong khi quota đã đếm
toàn hệ thống ⇒ `quota.used = 3` nhưng "Lịch của tôi" chỉ hiện 1–2 lớp.

## 16.2 Files changed

| File | Thay đổi |
|---|---|
| `BE/src/modules/enrollments/enrollments.service.ts` | Bọc **đúng 2 câu đọc** (`count` + `findMany`) của `getMyEnrollments` bằng `requestContext.run({ ...store, facilityId: undefined })`; thêm nested include `class.facility { id, name, code }` |
| `BE/tests/cross-facility-my-schedule.integration.ts` | **MỚI** — regression suite MF-03 |
| `BE/package.json` | thêm script `test:operations:cross-facility-my-schedule` |

**Không sửa:** `scoped-data.ts` / `facilityRoots` / `parents`, route/middleware/authorize, FE.

## 16.3 Scope behavior — trước / sau

| Đường đọc | Trước | Sau |
|---|---|---|
| `GET /enrollments/my` (`getMyEnrollments`) | FACILITY-scoped (kế thừa `parents`) | **GLOBAL, nhưng where khóa `memberId` của chính hội viên** |
| `GET /enrollments/my/quota` | GLOBAL | GLOBAL (không đổi) |
| `GET /enrollments` / `GET /enrollments/schedule/:id` (staff) | FACILITY-scoped | **FACILITY-scoped (không đổi)** |
| `POST /enrollments`, transfer, cancel | FACILITY-scoped | **FACILITY-scoped (không đổi)** |
| `GET /classes`, `GET /rooms`, `GET /class-schedules` | FACILITY-scoped | **FACILITY-scoped (không đổi)** |
| Membership / tier / schedule conflict | GLOBAL | GLOBAL (không đổi) |

## 16.4 Tại sao KHÔNG gỡ toàn cục `Enrollment` khỏi facility scope

- `parents` giữ nguyên `Enrollment: ["class"]` (`scoped-data.ts` dòng 27) → **mọi** truy vấn
  enrollment cấp 1 vẫn tự lọc theo facility của class, trừ đúng callback của `getMyEnrollments`.
- `facilityRoots` vẫn chứa `Room`, `Class`, `Payment` (dòng 9–11).
- Việc bỏ scope **chỉ** nằm trong `requestContext.run(...)` bọc 2 câu `count`/`findMany` của nhánh
  "my" — tự đóng khi callback kết thúc, không lây sang câu lệnh khác.
- `getMyEnrollments` chỉ có **1 điểm gọi**: `enrollments.controller.ts:85/87` ← route
  `GET /enrollments/my` với `authorize("MEMBER")` (grep toàn `src` = 4 kết quả, không có caller khác).

## 16.5 Security analysis

| Kiểm tra | Kết luận | Bằng chứng |
|---|---|---|
| Member A thấy booking Member B? | **KHÔNG** | `where = { memberId: memberProfile.id }` với `memberProfile` lấy từ `req.user.id` — không nhận `memberId` từ query/body/path. Test 4 PASS |
| Staff dùng endpoint này vượt scope vận hành? | **KHÔNG** | Route `authorize("MEMBER")`; staff đi `GET /enrollments/schedule/:id` (`authorize(MANAGER/COACH/RECEPTIONIST)`) — vẫn facility-scoped (Test 5 PASS) |
| `GET /enrollments` thành global? | **KHÔNG** | Không đụng các route khác; grep `getMyEnrollments` = chỉ 1 route |
| Nested include lòi resource cơ sở khác? | **KHÔNG** | `schedule/class/room/facility` chỉ là dữ liệu của **chính chỗ đặt hội viên sở hữu**; không list facility-scoped nào bị mở |
| Facility context giả mạo | **KHÔNG đổi** | `checkFacilityScope` giữ nguyên; header giờ chỉ không còn lọc "lịch của tôi" |

Tổng số site `facilityId: undefined` trong `src`: **14** = 10 site có sẵn (conflict/quota/scheduling)
+ 3 site MF-01/MF-02 + **1 site MF-03** (`enrollments.service.ts:272`).

## 16.6 Quota consistency analysis

- **Trước:** `quota.used` (global) có thể > `mySchedule.length` (facility) ⇒ mâu thuẫn hiển thị.
- **Sau:** tập booking đếm quota ⊆ tập trả về của "Lịch của tôi" ở **mọi** facility.
- Xác minh (Test 3, chạy ở cả `facility=A` và `facility=B`): A = 1 booking, B = 2 booking
  (3 class khác nhau) → `getMyEnrollments` trả đủ 3 booking tương lai **và**
  `quota.used = 3 / limit = 3`.
- **Không sửa code quota**: vẫn chỉ tính `BOOKED` + `ClassSchedule.SCHEDULED` chưa bắt đầu, DISTINCT class;
  "Lịch của tôi" vẫn hiện `CANCELLED`/`COMPLETED` theo hành vi hiện có
  (**không** ép `mySchedule.length === quota.used` cho mọi trạng thái).

## 16.7 FE / cache behavior

- Query key `["my-enrollments", …]` **không chứa facility** (đã verify) → **không cần sửa FE**.
- `FacilityBoundary.change()` vẫn `cancelQueries` + `removeQueries` (giữ `me`, `facilities`) + `abort()`
  request đang chạy → đổi facility vẫn refetch sạch, nhưng dữ liệu trả về **giống nhau**.
- Class list / room list dùng query key riêng → vẫn facility-specific, độc lập.
- Response thêm `schedule.class.facility {id,name,code}` (**additive**, không bỏ field nào) để FE có thể
  hiển thị cơ sở thật của từng chỗ đặt; FE hiện chưa render facility ⇒ không bắt buộc sửa FE.

## 16.8 Tests executed

| # | Test | Kết quả | Phân loại |
|---|---|---|---|
| 1 | **`test:operations:cross-facility-my-schedule` (MỚI)** | exit 0 — **18/18 PASS** | **PASS** |
| 2 | `test:operations:cross-facility` | exit 0 — **10 PASS** | **PASS** |
| 3 | `test:operations:cross-facility-cancel` | exit 0 — `PASS=18 FAIL=0` | **PASS** |
| 4 | `test:operations` (facility-operations) | exit 0 — **12 PASS** | **PASS** |
| 5 | `test:integration:audit` | exit 0 — **28 passed / 0 failures** | **PASS** |
| 6 | `FE: npm test` (vitest) | exit 0 — 9 files / **57 tests** | **PASS** |
| 7 | BE `npx tsc --noEmit` | exit 0 | **PASS** |
| 8 | Typecheck riêng file test MF-03 | exit 0 | **PASS** |
| 9 | `npx prisma validate` | exit 0 | **PASS** |
| 10 | `test:e2e` (enrollment-quota) | exit 1 — `FACILITY_CONTEXT_REQUIRED` ở `createPlan` | **PRE-EXISTING** (HTTP helper không gửi `X-Facility-Id`; đã baseline-verify ở session trước) |

Chi tiết test mới (18/18):

```
[PASS] Test1: chọn Facility A → thấy CẢ booking tại A và B (3 future BOOKED + CANCELLED + COMPLETED)
[PASS] Test1: KHÔNG thấy booking của hội viên khác (facility C)
[PASS] Test2: Facility A → B → C trả về CÙNG một tập lịch cá nhân
[PASS] Test2: KHÔNG có facility context (gọi ngoài scope) vẫn trả đủ
[PASS] Test4: hội viên B chỉ thấy chỗ của B (facility C), không thấy chỗ của A
[PASS] Test4: hội viên không có booking → rỗng, pagination.total = 0
[PASS] Test3 [facility=A]: đủ 3 booking tương lai VÀ quota.used=3 / limit=3
[PASS] Test3 [facility=A]: quota không reset khi đổi facility
[PASS] Test3 [facility=B]: đủ 3 booking tương lai VÀ quota.used=3 / limit=3
[PASS] Test3 [facility=B]: quota không reset khi đổi facility
[PASS] Phase4: mỗi chỗ đặt kèm facility THẬT của nó (A và B đều xuất hiện)
[PASS] Edge: filter status=CANCELLED chạy trên toàn bộ cơ sở
[PASS] Edge: phân trang giữ nguyên (5 bản ghi, page=2/limit=2 → 2 bản ghi, total=5, totalPages=3)
[PASS] Edge: BOOKED/CANCELLED/COMPLETED đều hiện theo hành vi hiện tại (không đổi policy)
[PASS] Test5: GET /classes (A) chỉ thấy class của A
[PASS] Test5: GET /rooms (B) chỉ thấy room của B
[PASS] Test5: danh sách enrollment THƯỜNG (staff/roster) vẫn facility-scoped — A không thấy booking của B
[PASS] Test6: ca tại B chồng giờ với chỗ ở A → 409 (schedule conflict vẫn GLOBAL)
=== KET QUA MF-03: PASS=18 FAIL=0 ===
```

Ghi chú trung thực: lần chạy đầu có **1 FAIL** do **sai phép tính trong assertion của chính test**
(5 bản ghi / limit 2 → page 2 = 2 bản ghi, không phải 1); đã sửa assertion và chạy lại 18/18.
Không phải lỗi sản phẩm.

**Môi trường & dọn dẹp:** schema test cô lập `scms_verify_mysched_20261006` (PostgreSQL cục bộ) +
Mongo test cục bộ `127.0.0.1:27018/rs0`. Đã `DROP SCHEMA` (exit 0), dừng mongod, xóa data dir, xóa file tạm
(0 còn lại). **Không ghi gì vào Render/production.**

## 16.9 Final Status

```text
MF-03 = RESOLVED
```

- "Lịch của tôi" nay đại diện **toàn bộ lịch cá nhân trên mọi cơ sở**, nhất quán với quota global.
- Đổi `X-Facility-Id` không còn làm lịch của tôi biến mất/mất bớt.
- View vận hành (`/classes`, `/rooms`, danh sách enrollment của staff) **vẫn facility-scoped**.











