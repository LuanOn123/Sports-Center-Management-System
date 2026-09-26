# BE Remediation Status — đối chiếu review A–N

Ngày: 27/09/2026 · Branch: `feature/BE-core-flow-1-2-3` · Đối chiếu với báo cáo review A–N ngày 26/09/2026 (commit `bc52a4d`).

> Tài liệu này liệt kê **những gì BE đã sửa** so với từng phát hiện trong review, kèm bằng chứng code + test. Những mục **chưa sửa** được liệt kê riêng ở §6 để không hiểu nhầm là đã xử lý hết.

**Trạng thái nhanh:** toàn bộ P0 về FREE/refund/data-leak/settlement/snapshot đã sửa hoặc sửa một phần có kiểm soát; kèm 4 migration mới, 6 bộ e2e xanh (~725 check) và BE `tsc --noEmit` **exit 0** (review ghi nhận trước đây thất bại).

---

## 1. Tóm tắt điều hành

| Hạng mục | Đã làm |
|---|---|
| **P0 trả dữ liệu** (CRITICAL-03/04, D01) | Training plans scoped theo actor; mọi nested `User` dùng select tối thiểu — **không còn `password` trong bất kỳ response nào** |
| **P0 tiền/entitlement** (CRITICAL-01/02/05/06/07/08) | FREE không còn carry-over; refund cap ≤ tiền đã thu; chặn đổi trạng thái thủ công với đơn online; tách **trạng thái tiền ↔ trạng thái cấp gói** (`REQUIRES_REVIEW` + retry-activation); snapshot offer trên Payment; renew từ FREE bắt đầu ngay |
| **P0 deploy/ledger** (CRITICAL-13/14) | Một implementation SePay duy nhất; typecheck BE đạt; ledger `SepayBankTransaction` với định danh unique + phân bổ một lần xuyên webhook/reconcile |
| **P0 cấu hình** (D06) | `SEPAY_MOCK_MODE` bị chặn cứng ở production (fail-fast ở `server.ts` + 403 ở service) |
| **File/phiên/socket** (D03/D04/D05/D07) | File chat riêng tư có auth + magic bytes; avatar bắt buộc chữ ký ảnh; đổi mật khẩu thu hồi toàn bộ refresh token + ngắt socket; webhook HMAC kiểm tra độ tươi timestamp |
| **Vòng đời/lịch/điểm danh** (B07, CRITICAL-09/10/11/12) | Job vòng đời gói (hết hạn + nhắc + đóng SePay PENDING quá TTL); cửa sổ điểm danh + không ghi đè kết quả đã chốt; entitlement lịch sử theo khoảng coverage; guard sức chứa; shared lock + CAS cho booking/lịch |
| **Notification/report** (F01, C08, C10, C11) | Notification qua **outbox** trong transaction; feedback ẩn danh thật + `isOwn`; report member chính xác; report doanh thu gross/refunded/net tách cohort |

---

## 2. Đối chiếu CRITICAL-01 → CRITICAL-14

| ID | Kết luận | Đã làm gì | Bằng chứng |
|---|---|---|---|
| **CRITICAL-01** FREE 10 năm cộng vào gói trả phí | ✅ **Đã sửa** | `inspectPlanPurchase` chỉ cộng ngày dư của gói **trả phí**; FREE (3650 ngày) luôn trả `remainingDays = 0`; renew từ FREE bắt đầu **ngay** và chuyển FREE cũ → `SUSPENDED` | `subscription-purchase.service.ts:72–76`, `subscriptions.service.ts:133–137`, `free-subscription.service.ts:52–54` · test: `enrollment-quota.e2e.ts` (nhóm A01), `sepay-payment.e2e.ts` (kênh renew FREE) |
| **CRITICAL-02** Refund vượt tiền đã thu | 🟡 **Sửa một phần (A02-lite)** | Công thức manager-hủy cap bằng chính tiền đã thu: `refundAmount = Math.min(Math.round(dailyRate × daysLeft), Math.round(payment.amount))`; self-cancel là 30% giá gốc (luôn ≤ đã thu); huỷ gói ghi `cancelledAt` + payment `REFUNDED` + note lý do trong cùng transaction | `subscriptions.service.ts:299–308` (cap), `:403–441` (self cancel) · **Còn lại**: chưa có Refund entity/ledger và trạng thái chi tiền (B06) |
| **CRITICAL-03** Đọc training plan người khác + lộ password | ✅ **Đã sửa** | Scope theo actor ở tầng service (MEMBER chỉ plan của mình — đổi `memberId` ⇒ 403; COACH chỉ plan mình phụ trách); mọi include đều select tối thiểu (`coach.user: {id, fullName}`) | `training-plans.service.ts:11–14, 54, 88, 96`, `training-plans.controller.ts` · test: check A03 trong bộ e2e |
| **CRITICAL-04** Attendance trả password hash | ✅ **Đã sửa** | Roster và mọi nested member dùng `user: { select: { id, fullName } }`; kiểm tra toàn repo **không còn `password: true`** trong bất kỳ include nào (`user: true` còn lại chỉ ở `feedbacks.service.ts:27` — dùng nội bộ check `isActive`, không trả ra response) | `attendance.service.ts:79, 88`, `subscriptions.service.ts:244–256` |
| **CRITICAL-05** Đổi payment status không đồng bộ subscription | ✅ **Đã sửa (A05)** | `PATCH /payments/{id}/status` trả **400** với mọi payment có `gateway` (đơn SePay chỉ được chốt qua webhook/đối soát): `"Không thể đổi trạng thái thanh toán online thủ công…"` | `payments.service.ts:128–139` · test: `sepay-payment.e2e.ts` (A05 check 400) |
| **CRITICAL-06** Đã nhận tiền nhưng PENDING / SUCCESS thiếu gói | ✅ **Đã sửa (A06)** | Thêm `PaymentActivationStatus { ACTIVATED, REQUIRES_REVIEW }` + `reviewReason/reviewedAt/reviewedById`; settlement thất bại ⇒ payment vẫn `SUCCESS` (tiền đã thu) nhưng `REQUIRES_REVIEW`; endpoint mới `POST /payments/{id}/retry-activation` (MANAGER) cấp gói theo **đúng snapshot của đơn**, giữ review + cập nhật lý do mới nhất nếu vẫn bị chặn | migration `20260927000000_…`, `sepay-payments.service.ts:140–180, 555–643`, `payments.routes.ts:148–175` · test: scenario K `sepay-payment.e2e.ts` (REQUIRES_REVIEW → retry → ACTIVATED + có người duyệt) |
| **CRITICAL-07** Không snapshot offer khi checkout | ✅ **Đã sửa (A07)** | Payment lưu snapshot `planNameSnapshot / planTierSnapshot / durationDaysSnapshot / maxConcurrentClassesSnapshot`; kích hoạt gói + invoice + quota dùng snapshot (không đọc plan live); mọi kênh (SePay, quầy, renew) đều ghi snapshot; đơn còn dùng `planId` để tra plan nhưng điều khoản áp theo snapshot | migration `20260927000000_…`, `subscription-purchase.service.ts:188–193`, `subscriptions.service.ts:172–176` · test: scenario K (plan live đổi khi QR pending vẫn cấp đúng offer cũ) |
| **CRITICAL-08** Nhiều gói ACTIVE / renew bypass luật mua | 🟡 **Sửa một phần (A08-lite)** | Renew từ FREE: bắt đầu **ngay** + FREE cũ → `SUSPENDED` (không còn “ACTIVE tương lai sau 10 năm”); carry-over chỉ từ gói trả phí; activation luôn tạo subscription cùng transaction với payment | `subscriptions.service.ts:133–137` · **Còn lại**: member-level lock trong settlement (E05/E08) và trạng thái QUEUED cho gói tương lai |
| **CRITICAL-09** Điểm danh trước/sau buổi + ghi đè kết quả đã chốt | ✅ **Đã sửa (A09)** | Server quyết định cửa sổ điểm danh `[start−30′, end+30′]` + schedule phải `SCHEDULED`; generate QR ngoài cửa sổ cũng bị chặn; quét lại **không ghi đè** kết quả đã chốt (ABSENT/LATE/EXCUSED ⇒ 409, PRESENT giữ nguyên chỉ cập nhật nguồn QR/mã) | `attendance.service.ts:179–204, 336–356`, `attendance.routes.ts:131, 183` · test: `attendance-manual-code.e2e.ts` scenario 8 (QR ngoài cửa sổ 409, overwrite 409, không tạo attendance) |
| **CRITICAL-10** Phạt dùng trạng thái gói hiện tại cho quá khứ | ✅ **Đã sửa (A10)** | Thêm cột `MembershipSubscription.cancelledAt`; analytics dựng **khoảng quyền lợi lịch sử** `[startDate, min(endDate, cancelledAt)]` (SUSPENDED dừng ở `suspendedAt`) — đổi status hôm nay không làm đổi tỷ lệ chuyên cần đã qua; coverage dùng lại ở guard dời lịch (A11) | migration `20260927020000_…`, `attendance-analytics.service.ts:15–64, 92–96`, `subscriptions.service.ts:273, 437–450` · test: `attendance-manual-code.e2e.ts` (A10 checks) |
| **CRITICAL-11** Sửa lịch/sức chứa phá booking hợp lệ | ✅ **Đã sửa (A11)** | Guard sức chứa lớp `CLASS_CAPACITY_BELOW_BOOKED` (400); guard phòng `ROOM_CAPACITY_TOO_SMALL` (400); dời lịch kiểm tra member bị ảnh hưởng (trùng giờ / mất coverage) ⇒ 409 `SCHEDULE_MOVE_IMPACT` kèm `conflicts`/`uncovered` = tên hội viên | `classes.service.ts:131–134`, `rooms.service.ts:61–64`, `class-schedules.service.ts:452–480` · test: `attendance-manual-code.e2e.ts` (A11: shrink class/room, move conflict + coverage) |
| **CRITICAL-12** Booking vs hủy/đổi lịch không cùng khóa | ✅ **Đã sửa (A12)** | Lock dùng chung theo thứ tự `lockMemberQuota → lockMemberClass → lockSchedule` cho book/transfer/course/penalty; lịch mutate bằng `lockSchedule` + **CAS** (`SCHEDULE_STATE_CHANGED`) và **đọc lại sau lock** (`SCHEDULE_NOT_AVAILABLE` nếu không còn `SCHEDULED`) | `dbLocks.ts:7–38`, `enrollments.service.ts:142–144, 153–156, 378–386`, `course-enrollment.service.ts:382–386`, `class-schedules.service.ts:419–421, 516, 539, 546, 571, 688, 730` · test: `course-enrollment.e2e.ts` + `attendance-manual-code.e2e.ts` |
| **CRITICAL-13** Hai implementation/migration SePay không nhất quán | ✅ **Xử lý trên branch hiện tại** | File `sepay-payment.service.ts` cũ **không còn tồn tại** (module chỉ có `sepay-payments.service.ts`); **BE `npx tsc --noEmit` exit 0** (review ghi nhận fail do Prisma client cũ); chain migration hiện tại chỉ còn `20260924220000_add_momo_online_payment` → `20260925100000_replace_momo_with_sepay` → 4 migration 09/27, không còn migration trùng cột `planId/FK` | `BE/src/modules/payments` (đã kiểm danh sách file), `npx tsc --noEmit` = 0, `prisma/migrations` (đã kiểm tên) · ⚠️ **chưa replay fresh-DB** trên máy trắng — xem §6 |
| **CRITICAL-14** Một bank transaction dùng cho nhiều payment | ✅ **Đã sửa (A14)** | Ledger `SepayBankTransaction`: định danh chuẩn hoá `externalId` UNIQUE + `sepayId` UNIQUE + `apiTransactionId` UNIQUE + `paymentId` UNIQUE ⇒ **một movement chỉ phân bổ một payment, dùng chung webhook + reconcile API**; nội dung chứa nhiều mã đơn ⇒ từ chối (`CONTENT_AMBIGUOUS`); tiền về muộn/movement đã dùng cho đơn khác ⇒ không cấp gói, ghi nhận để đối soát | migration `20260927010000_…`, `sepay-payments.service.ts:756–765+` · test: `sepay-payment.e2e.ts` (A14: reference dùng lại ⇒ đơn B không được cấp gói; content chứa 2 mã ⇒ bị từ chối) |

---

## 3. Đối chiếu các nhóm B / C / D / E / F / G / H

### 3.1. Nhóm B — Missing Business Rules

| ID | Kết luận | Đã làm gì |
|---|---|---|
| **B07** Job hết hạn/reminder/reconciliation | ✅ **Đã sửa** | `subscription-lifecycle.service.ts`: (1) gói `ACTIVE/SUSPENDED` quá `endDate` → `EXPIRED` + notification qua outbox, CAS `endDate < now`; (2) nhắc trước 3 ngày (`SUBSCRIPTION_EXPIRING`, dedupe 24h); (3) tự đóng SePay `PENDING` quá TTL → `FAILED` + note (CAS theo `status = PENDING`). Chạy ngay sau boot + mỗi **15 phút** trong `server.ts` (unref, lỗi không chết server). |
| **B10** Giới hạn/gắn chủ sở hữu file, retention, virus scan | 🟡 **Sửa một phần** | **Đã làm**: file chat có chủ sở hữu (`ChatAttachment.ownerId/receiverId`), tải qua API auth + phân quyền; upload allowlist + **magic bytes**; avatar bắt buộc chữ ký ảnh; dọn file khi request bị từ chối; static chỉ còn `/uploads/avatars`. **Còn lại**: retention/TTL file, quota storage, virus scan. |
| **B13** Audit actor/reason/before-after | 🟡 **Sửa một phần** | Notification đã tách khỏi business tx (F01 outbox). Các trường actor có mặt ở luồng tiền/lịch: `Payment.reviewReason/reviewedAt/reviewedById`, `AttendancePenalty.revokedBy/revokedReason/revokedAt`, `MembershipSubscription.cancelledAt`, reason của schedule cancel. **Còn lại**: `AuditEvent` tổng quát cho sửa attendance/finance/schedule/role (before/after). |

### 3.2. Nhóm C — Inconsistent Logic

| ID | Kết luận | Đã làm gì |
|---|---|---|
| **C01** Effective subscription không nhất quán | 🟡 **Sửa một phần** | Analytics/entitlement lịch sử đã có resolver khoảng coverage dùng chung (`buildCoverageIntervals` + `getMembershipCoverageIntervals` — dùng ở A10 và guard dời lịch A11); quota resolve theo thời điểm hiện tại. **Còn lại**: một resolver duy nhất cho purchase/members-list/booking. |
| **C02** Renew vs purchase | 🟡 **Sửa một phần** | Renew từ FREE đã đúng thời điểm (bắt đầu ngay, FREE → SUSPENDED); carry-over chỉ từ gói trả phí ở cả 2 luồng. **Còn lại**: hợp nhất engine purchase/renew (E08). |
| **C04** Self/admin refund | 🟡 **Sửa một phần** | Manager-hủy: cap ≤ tiền đã thu; self-hủy 30%; cả 2 ghi `cancelledAt` + payment `REFUNDED` + note số ngày/số tiền trong transaction; report doanh thu tách `refundedAmount`. **Còn lại**: ledger/trạng thái chi tiền thực (B06) và invoice adjustment (C05). |
| **C05** Generic refund vs cancel subscription | 🟡 **Sửa một phần** | Đơn online **không thể** bị đổi trạng thái thủ công (A05) nên không còn nhánh “refund mà gói vẫn ACTIVE / SUCCESS mà không có gói”; huỷ gói cập nhật payment REFUNDED trong cùng transaction. **Còn lại**: invoice chưa được điều chỉnh/hủy tương ứng khi refund (invoice hiện chỉ tạo lúc mua/activation). |
| **C08** Anonymous feedback chưa ẩn danh thật | ✅ **Đã sửa** | `listFeedbacksForCoach` strip hẳn `memberId`/`member` khỏi item `isAnonymous` + thêm `isOwn` cho mọi item; author xem bản của mình qua `/feedbacks/my`; feedback có `classId` phải thuộc đúng coach (400). |
| **C10** Report member FREE sai | ✅ **Đã sửa** | `tierCounts.FREE` cộng phần member không có gói hiệu lực vào số FREE thật (không còn ghi đè `total − active`); comment nêu rõ lý do cũ sai. |
| **C11** Report revenue sai cohort/note | ✅ **Đã sửa** | Response tách cohort: **cash (`paidAt`)** → `totalRevenue`, `refundedAmount`, `netRevenue`, `revenueByMethod`, `successPayments/refundedPayments`, `recentPayments` (chỉ SUCCESS/REFUNDED, sort `paidAt`); **order (`createdAt`)** → `totalPayments`, `pendingPayments`, `failedPayments`; `note` mô tả đúng gross/refunded/net + giới hạn refund ledger. |

### 3.3. Nhóm D — Security / Authorization

| ID | Kết luận | Đã làm gì |
|---|---|---|
| **D01** Response chứa password hash | ✅ **Đã sửa** | Xem CRITICAL-03/04: mọi nested `User` chọn select tối thiểu; đã soát repo không còn `password: true`. |
| **D02** Coach xem dữ liệu ngoài lớp phụ trách | 🟡 **Sửa một phần** | `GET /enrollments/schedule/:scheduleId`: COACH bị kiểm tra **assigned** (403 nếu không dạy lớp đó) — `enrollments.service.ts:279–295`. **Còn lại**: `GET /members/:id` vẫn cho COACH mà chưa kiểm tra quan hệ coach–member (route `authorize("MANAGER","STAFF","COACH")`, service chưa có guard). |
| **D03** File chat public + upload không kiểm nội dung | ✅ **Đã sửa** | `ChatAttachment` + `GET /chat/attachments/:id` (auth + owner/receiver/MANAGER, phòng chung ai cũng tải); magic-byte sniffing (khai sai ⇒ 400 + dọn file); tên file server sinh (chống path/extension injection); avatar bắt buộc chữ ký ảnh; static chỉ `/uploads/avatars`. |
| **D04** Socket không revalidate sau khóa/đổi role | ✅ **Đã sửa** | `disconnectUserSockets(userId)` ngắt mọi socket + dọn presence; gọi khi **khóa tài khoản**, **đổi role** (`users.service.ts:175–205`) và **đổi mật khẩu** (`auth.service.ts:198`); comment nêu rõ handshake chỉ xác thực một lần. |
| **D05** changePassword không revoke refresh token | ✅ **Đã sửa** | `changePassword`: transaction `user.update` + `refreshToken.deleteMany({ userId })` (thu hồi **mọi thiết bị**) + `disconnectUserSockets`; e2e kiểm tra refresh token cũ bị từ chối sau khi đổi. |
| **D06** mock-confirm không ràng môi trường | ✅ **Đã sửa** | `server.ts:20–27` fail-fast (`process.exit(1)`) nếu `NODE_ENV=production` mà `SEPAY_MOCK_MODE=true`; service trả `403 SEPAY_MOCK_DISABLED` khi mock tắt hoặc ở production. |
| **D07** Webhook HMAC chưa kiểm freshness | ✅ **Đã sửa** | `SEPAY_WEBHOOK_MAX_SKEW_SECONDS` (mặc định **3600s**, `0` = tắt); verify chữ ký timing-safe xong kiểm tra timestamp, quá cũ ⇒ 401 `SEPAY_INVALID_SIGNATURE` (chống replay). |

### 3.4. Nhóm E / F / G — Race, Transaction, DB Integrity

| ID | Kết luận | Đã làm gì |
|---|---|---|
| **E04** Book vs cancel/update schedule | ✅ **Đã sửa (A12)** | Booking/course/schedule mutation dùng chung `lockSchedule` + CAS trạng thái + đọc lại sau lock; không còn “stale read” tạo BOOKED trên lịch đã hủy. |
| **E07** Đơn hết TTL vs webhook | ✅ **Đã sửa** | Job đóng PENDING dùng **CAS** `updateMany where status = PENDING` (không đè `SUCCESS` vừa commit); tiền về sau TTL đi nhánh LATE (ghi đối soát, không cấp gói). |
| **E11** Giảm capacity vs booking | 🟡 **Sửa một phần** | Guard không cho giảm dưới số chỗ đang giữ (lớp/phòng). **Còn lại**: chưa serialize capacity-update với booking đang chạy (không cùng lock). |
| **E16** Reminder scan nhiều instance | 🟡 **Sửa một phần** | Dedupe 2 lớp: notification **đã gửi** (24h) **và** row outbox `PENDING/SENDING` cùng `subscriptionId` (ngăn gửi trùng khi flush theo lô chưa tới). **Còn lại**: chưa có unique dedupe key ở DB cho multi-instance. |
| **F01** Notification ngoài transaction | ✅ **Đã sửa** | `NotificationOutbox` + `enqueueNotification(tx, …)` ghi **trong** business transaction; `flushNotificationOutbox()` sau commit; worker 5s trong `server.ts` (unref) retry row PENDING/FAILED; e2e kiểm tra rollback không gửi và commit thì gửi. |
| **F02** Partial update profile | ✅ **Đã sửa** | `auth.service.ts:161` (updateMe), `members.service.ts:98` (updateMember), `coaches.service.ts:112` (updateCoach) đều bọc transaction User + Profile. |
| **F03** Đổi status/refund không cùng orchestration | 🟡 **Sửa một phần** | A05 chặn generic override đơn online; A02 cap refund; activation + payment + invoice + notification nằm trong transaction (F01). **Còn lại**: “settlement command” thống nhất + refund ledger (B06). |
| **F06** Upload file vs DB không atomic | 🟡 **Sửa một phần** | Controller chat dọn file trên **mọi nhánh lỗi** (định dạng sai, người nhận sai, DB lỗi); file + message tạo trong cùng transaction. **Còn lại**: cơ chế temporary-upload/finalize tổng quát. |
| **G02** Thiếu snapshot/ledger/uniqueness | 🟡 **Sửa một phần** | ✅ offer snapshot (A07), ✅ bank movement uniqueness + allocation một lần (A14). ⬜ còn thiếu refund ledger. |

**Điểm review đánh giá tốt vẫn giữ nguyên:** HTTP auth đọc DB mỗi request; advisory lock schedule/memberQuota/memberClass; webhook timing-safe + raw body + unique claim; room/coach conflict; quota/tier check; notification read ownership; report boundary +07:00.

---

## 4. Chi tiết kỹ thuật các fix

### 4.1. Notification Outbox (F01, hỗ trợ B07/B13)

- Model `NotificationOutbox` (enum `OutboxStatus { PENDING, SENDING, SENT, FAILED }`) với `type/title/body/metadata/availableAt/attempts/lastError`.
- `enqueueNotification(db, payload)` nhận **transaction client** ⇒ notification được ghi **cùng transaction** với nghiệp vụ (không còn “báo thành công rồi rollback”).
- `flushNotificationOutbox(limit)` gửi row PENDING tới bảng `Notification` (kèm retry/backoff qua `availableAt`, ghi `lastError`); nghiệp vụ gọi flush **sau commit**; worker `setInterval` 5s trong `server.ts` là lưới an toàn.
- E2E: `sepay-payment.e2e.ts` có check outbox rollback/commit (marker `F01-COMMIT-…`, `F01-ROLLBACK-…`) và `subscription-lifecycle.e2e.ts` dùng flush có kiểm soát.

### 4.2. Bank ledger `SepayBankTransaction` (A14 / CRITICAL-14)

- Định danh chuẩn hoá: `externalId` (UNIQUE), `sepayId` (UNIQUE — webhook), `apiTransactionId` (UNIQUE — SePay API), `referenceCode`, `amount`, `content`, `paymentId` **UNIQUE** (một movement ⇒ tối đa một payment).
- **Cả webhook và đối soát API dùng chung ledger** ⇒ retry/replay/2 kênh không thể cấp gói hai lần.
- Nội dung chuyển khoản chứa **nhiều mã đơn** ⇒ `CONTENT_AMBIGUOUS` (không tự đoán); reference đã dùng ⇒ ghi nhận nhưng **không cấp gói** cho đơn khác.
- Kèm `closeStaleSepayPendingPayments` (B07) đóng PENDING quá TTL bằng CAS.

### 4.3. Tách “tiền” ↔ “cấp quyền”: A05 / A06 / A07

- **A05**: `PATCH /payments/{id}/status` ⇒ 400 nếu `payment.gateway` (đơn online).
- **A06**: enum `PaymentActivationStatus { ACTIVATED, REQUIRES_REVIEW }`, `reviewReason`, `reviewedAt/reviewedById`; response `GET /payments/sepay/:id` thêm `activationStatus/requiresReview/reviewReason`. Khi cấp gói thất bại sau khi đã thu tiền: payment giữ `SUCCESS`, `activationStatus = REQUIRES_REVIEW`, ghi note đối soát; endpoint `POST /payments/{id}/retry-activation` (MANAGER) cấp gói theo snapshot, cập nhật `reviewedById/At` khi thành công hoặc lưu `reviewReason` mới nhất khi vẫn bị chặn (409 `SEPAY_ACTIVATION_REJECTED`).
- **A07**: `planNameSnapshot / planTierSnapshot / durationDaysSnapshot / maxConcurrentClassesSnapshot` trên Payment; `activateSubscriptionForPayment` nhận `optionSnapshot` ⇒ duration/tier/quota lấy từ snapshot; invoice/payment dùng số tiền đã chốt.

### 4.4. Job vòng đời gói tập + HMAC skew + mock guard (B07 / D07 / D06)

- `subscription-lifecycle.service.ts`:
  - `expireStaleSubscriptions` — CAS `where status ∈ {ACTIVE, SUSPENDED} AND endDate < now`, đặt `EXPIRED`, xoá `suspendedAt/remainingDays`, enqueue `SUBSCRIPTION_EXPIRED`.
  - `sendSubscriptionExpiryReminders` — nhắc ≤ 3 ngày, dedupe 24h **+ kiểm tra outbox đang chờ**.
  - `closeStaleSepayPendingPayments` — PENDING quá `ttlMinutes` ⇒ `FAILED` + note, CAS theo `status = PENDING`.
  - `runSubscriptionLifecycleJobs` gộp 3 bước; gọi lúc boot + mỗi 15 phút (`LIFECYCLE_INTERVAL_MS`), `unref()`.
- `SEPAY_WEBHOOK_MAX_SKEW_SECONDS` (mặc định 3600): chữ ký đúng nhưng timestamp cũ ⇒ 401; swagger cập nhật.
- Mock: `server.ts` fail-fast ở production; service 403 `SEPAY_MOCK_DISABLED`.

### 4.5. Điểm danh / lịch / sức chứa (A09 → A12)

- `assertAttendanceWindow(schedule, now)`: buổi phải `SCHEDULED`; `now` trong `[start−30′, end+30′]` (config `ATTENDANCE.SCAN_OPEN_MINUTES_BEFORE/SCAN_CLOSE_MINUTES_AFTER`); áp dụng cho cả generate-qr và scan.
- Scan/manual-code: nếu đã có attendance với status ≠ `PRESENT` ⇒ **409** (không ghi đè); `PRESENT` chỉ cập nhật nguồn (QR ↔ mã dự phòng) — idempotent.
- `buildCoverageIntervals` (A10): `to = min(endDate, cancelledAt)`, SUSPENDED dừng ở `suspendedAt`; `getMembershipCoverageIntervals` dùng cho analytics **và** guard dời lịch.
- Guard sức chứa: `CLASS_CAPACITY_BELOW_BOOKED` (`classes.service.ts`), `ROOM_CAPACITY_TOO_SMALL` (`rooms.service.ts`).
- Dời lịch: kiểm tra member đang giữ chỗ bị **trùng giờ** hoặc **ngoài coverage** ⇒ 409 `SCHEDULE_MOVE_IMPACT` + danh sách tên.
- Lock/CAS: `lockSchedule` + `SCHEDULE_STATE_CHANGED` trong cancel/update/complete; booking/course **đọc lại sau lock** (`SCHEDULE_NOT_AVAILABLE`).

### 4.6. File chat riêng tư + phiên/socket (D03 / D04 / D05)

- **D03**: bảng `ChatAttachment` (owner/receiver/storedName/mimeType/size, `messageId` UNIQUE); upload `POST /chat/messages` (multipart field `file`) allowlist jpeg/png/webp/gif/pdf ≤ 10MB + **magic bytes**; tên file server sinh theo MIME; mọi nhánh lỗi **dọn file**; tải qua `GET /chat/attachments/:id` với `Authorization: Bearer` + phân quyền owner/receiver/MANAGER (phòng chung: mọi user đăng nhập); response kèm `Content-Type` + `X-Content-Type-Options: nosniff`; `app.ts` chỉ còn static `/uploads/avatars`.
- **Avatar**: middleware sniff chữ ký ảnh — file giả ảnh ⇒ 400 `"Avatar image content is invalid (jpeg, png, webp or gif)"`; giới hạn 5MB; sai MIME ⇒ 400.
- **D04**: `disconnectUserSockets(userId)` (ngắt mọi socket + dọn `socketsByUser` + announce offline một lần) — gọi khi disable tài khoản, đổi role, đổi mật khẩu; guard chống announce lần 2.
- **D05**: `changePassword` = transaction `[user.update(password), refreshToken.deleteMany({userId})]` + `disconnectUserSockets` ⇒ đổi mật khẩu thu hồi **mọi phiên** trên mọi thiết bị.

### 4.7. Gói tập / report / feedback (A01 / A02 / A08 / C08 / C10 / C11)

- **A01/A08**: `inspectPlanPurchase` loại FREE khỏi carry-over (`remainingDays = 0` khi tier FREE); renew từ FREE bắt đầu ngay + FREE cũ → `SUSPENDED`; luồng mua tại quầy/enrollment dùng chung `activateSubscriptionForPayment` + snapshot.
- **A02**: cap refund ≤ tiền đã thu (manager-hủy) và 30% giá gốc (self-hủy); note ghi rõ số ngày/số tiền; `cancelledAt` là mốc entitlement kết thúc.
- **C08**: feedback ẩn danh strip `memberId/member`; `isOwn` cho mọi item; `/feedbacks/my` cho tác giả; `classId` phải thuộc coach.
- **C10**: `tierCounts.FREE` không còn bị ghi đè.
- **C11**: report doanh thu 2 cohort (cash theo `paidAt`: gross/refunded/net/byMethod/recentPayments; order theo `createdAt`: tổng đơn/pending/failed) + `note` mô tả đúng.

---

## 5. Migration, env và bằng chứng kiểm thử

### 5.1. Migration mới (đã apply bằng `prisma migrate deploy`)

| Migration | Nội dung |
|---|---|
| `20260927000000_payment_offer_snapshot_activation_status` | `Payment.*Snapshot`, `PaymentActivationStatus`, `reviewReason/reviewedAt/reviewedById`, index `activationStatus`; `MembershipSubscription.maxConcurrentClassesSnapshot` |
| `20260927010000_sepay_bank_ledger_and_notification_outbox` | `SepayBankTransaction` (externalId/sepayId/apiTransactionId/paymentId UNIQUE) + `NotificationOutbox` + enum `OutboxStatus` |
| `20260927020000_subscription_cancelled_at` | `MembershipSubscription.cancelledAt` (nullable, additive) |
| `20260927030000_chat_attachments_private` | Bảng `ChatAttachment` + FK owner/receiver |

### 5.2. Biến môi trường mới

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SEPAY_WEBHOOK_MAX_SKEW_SECONDS` | `3600` | Cửa sổ freshness timestamp webhook (D07); `0` = tắt |
| `SEPAY_MOCK_MODE` | `false` | Chỉ dev; production fail-fast (D06) |
| `SUBSCRIPTION_LIFECYCLE.*` (config) | 3 ngày / 24h / batch | Tham số job B07 (`config/membership.ts`) |

### 5.3. Bằng chứng chạy

| Kiểm tra | Kết quả |
|---|---|
| `BE: npx tsc --noEmit` | ✅ **exit 0** (review trước ghi nhận fail) |
| `BE: npm run test:e2e` (quota) | ✅ **382 / 0** |
| `BE: npm run test:e2e:attendance` | ✅ **85 / 0** (gồm A09 window/overwrite, A11 capacity/move, A10 coverage) |
| `BE: npm run test:e2e:course` | ✅ **84 / 0** (lock order + re-read + quota) |
| `BE: npm run test:e2e:sepay` | ✅ **145 / 0** (A05/A06/A07/A14, D05/D06/D07, F01 outbox) |
| `BE: npm run test:e2e:chat` | ✅ **15 / 0** (D03: riêng tư, phòng chung, dọn file) |
| `BE: npm run test:e2e:lifecycle` | ✅ **14 / 0** (B07 expire/remind/close + C11 gate) |
| `FE: npm test` (baseline, FE đã revert) | ✅ 7 files / **43/43** · `typecheck` exit 0 |
| Tổng diff BE | ~45 file, **+2.644 / −296** (chưa kể 4 migration + 3 service/test mới) |

---

## 6. Còn lại — CHƯA sửa (không tính là đã xong)

### 6.1. P0 — còn nợ kỹ thuật

| Mục | Nội dung còn thiếu |
|---|---|
| B06 / CRITICAL-02 (phần ledger) | `Refund` entity + workflow `requested → approved → paid → failed` + `reference`; invoice adjustment khi hoàn tiền (C05); report chưa có refund ledger chi tiết nên REFUNDED vẫn tính hoàn **toàn bộ** tiền gốc |
| G01 | Migration `20260925100000_replace_momo_with_sepay` vẫn **đổi dữ liệu lịch sử `gateway = MOMO → SEPAY`** (sai provenance); cần giữ legacy gateway cho giao dịch đã thu trước đó |
| CRITICAL-13 (phần deploy) | Chưa chạy **fresh-DB replay** (`prisma migrate deploy` trên DB trắng) + `prisma generate` + build trên máy khác để chốt CI |
| CRITICAL-08 / E05 / E08 | Chưa có member-level lock khi 2 payment cùng member settle; chưa có trạng thái `QUEUED` cho gói tương lai; invariant “một entitlement hiệu lực” mới ở mức quy ước |

### 6.2. P1 — còn lại

| Mục | Nội dung còn thiếu |
|---|---|
| D02 (phần 2) | `GET /members/:id` vẫn cho COACH không kiểm tra quan hệ coach–member |
| B11 | Đổi role → MEMBER **không** provision FREE (create/register có; `users.service.updateUser` chỉ upsert `memberProfile`) |
| C03 | `updatePlan` không guard khi `isActive = false` (leaf guard `deletePlan` có, PATCH thì không) — đã xác minh trong code |
| Race còn lại | E06 (double-click checkout → 2 PENDING), E09 (2 primary coach), E10 (assign coach vs create schedule), E12 (2 manager disable nhau), E13/E14 (manual code rotate + rate limit không atomic), E15 (penalty revoke không CAS), E17 (cancel sub vs booking không chung member lock), E18 (bulk transfer room vs sửa/hủy lịch) |
| F04 / F05 | Manual-code rotate chưa nằm trong 1 transaction; sau commit course còn query quota (lỗi query ⇒ client nhận fail dù đã đăng ký) |
| G03–G07 | Enrollment `classId` ↔ `schedule.classId` không ràng buộc DB; chưa unique primary coach / entitlement overlap; feedback unique `classId` nullable; attendance chưa link enrollment; `releasedEnrollmentIds` JSON không FK |
| B10 (phần còn) | Retention/TTL file, quota storage, virus scan |
| B12 / B13 | Training plan chưa so `start/end` + trạng thái plan; chưa có `AuditEvent` actor/reason/before-after |
| C06 / C07 / C09 / C12 | GET có lazy expire (ghi DB); chuẩn hoá email/phone/DOB/tên chưa đồng nhất login vs manager-create; feedback vẫn cho review lớp khác của coach qua `BOOKED` tương lai + upsert class NULL; swagger chronology một số nhánh |

### 6.3. P2 — policy/timezone/UX

| Nhóm | Nội dung còn thiếu |
|---|---|
| Timezone | Weekday SQL `AT TIME ZONE 'Asia/Ho_Chi_Minh'` chưa xác minh ngữ nghĩa UTC-naive; `date=YYYY-MM-DD` parse UTC nửa đêm rồi `setDate` local; duration `Math.ceil(ms/86400000)` + `setDate` có thể tặng ~1 ngày/lần switch/freeze; policy coverage `endTime` của buổi chưa chốt |
| H transitions | `QUEUED`, `FreezePeriod`/rounding, `PARTIALLY_REFUNDED`, reopen schedule command, invoice adjustment document, webhook resolution case |
| B01–B05, B08, B09, B14 | CourseOffering/Registration, center calendar/maintenance, coach qualification, cancellation window/waitlist, entitlement theo sport/số buổi, freeze quota, học bù khi hủy lớp, email verification/password reset/rate limit login |
| I (UX do BE) | Class wizard DRAFT→PUBLISHED, semantics “trọn khóa”, trạng thái payment đối soát cho FE, badge gói tương lai, chat unread per-person + phân trang, 500 thay vì field error cho UUID/date sai, idempotency key |
| J còn lại | Các case J05, J06, J07, J21, J23–J27, J33–J45, J48, J49, J51, J53–J56, J59, J60 chưa có test tương ứng |

---

## 7. Ghi chú trung thực

1. Tài liệu này đối chiếu với **code hiện tại trên branch** `feature/BE-core-flow-1-2-3` (working tree chưa commit). Số dòng tham chiếu có thể lệch nếu tiếp tục sửa.
2. Quy ước trạng thái: ✅ = đã sửa code + có bằng chứng (e2e/typecheck); 🟡 = đã làm phần cốt lõi, các phần còn thiếu ghi rõ trong “Còn lại”; ⬜ = chưa làm (liệt kê ở §6) — **không** tính là đã xử lý.
3. Chưa chạy: fresh-DB migration replay trên máy trắng; stress/concurrency test thật cho các lock mới (mới có e2e logic + advisory lock, chưa có test tranh chấp song song quy mô lớn); chưa test với sandbox SePay thật (mới mock/webhook mô phỏng).
4. Các con số e2e chạy trên PostgreSQL dev DB local; nhóm “tốt” của review (auth DB-check, advisory lock, webhook timing-safe, report +07:00) được giữ nguyên và phản ánh ở các check cũ.
5. FE đã được **revert về nguyên trạng**; các patch FE cần làm gì để ăn khớp BE nằm ở `FE/docs/BE_INTEGRATION_GUIDE.md`.

### Lệnh chạy lại bằng chứng

```bash
# BE
cd BE
npx tsc --noEmit
npm run test:e2e:all        # 6 suite: quota, attendance, course, sepay, chat, lifecycle
npm run test:e2e:lifecycle  # B07 + C11
npm run test:e2e:chat       # D03
npm run test:e2e:sepay      # A05/A06/A07/A14 + D05/D06/D07 + F01

# FE (baseline sau revert)
cd FE
npm run typecheck
npm test
```







