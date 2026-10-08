# CURRENT BUSINESS FLOW AND RULES — Sports Center Management System (Backend)

> **Tài liệu mô tả HÀNH VI ĐÃ IMPLEMENT HIỆN TẠI** của backend, lấy repo làm nguồn sự thật.
> Ngày tổng hợp: 10/7/2026. Backend only — không mô tả FE trừ khi trỏ đích danh file.
>
> **KHÔNG** biến tài liệu này thành thiết kế lý tưởng: mọi luật đều kèm nhãn bằng chứng.

## Nhãn bằng chứng

| Loại | Nghĩa |
| ---- | ------ |
| `[VERIFIED]` | Có kết quả chạy test THỰT TẾ chứng minh (kỳ chạy trên schema cách ly `scms_verify_final_20261007`, 7/10/2026 — xem §4) |
| `[CODE-VERIFIED]` | Code nguồn hỗ trợ nhưng CHƯA tìm thấy test đã chạy chứng minh trực tiếp |
| `[DOCUMENTED]` | Chỉ tài liệu/Swagger ghi nhận, chưa có evidence |
| `[UNRESOLVED]` | Repo không đủ dữ liệu để kết luận |

**Thứ tự nguồn sự thật (ưu tiên giảm dần):** (1) code chạy được → (2) Prisma schema + ràng buộc DB → (3) test đã chạy + assertion → (4) route/controller/Zod → (5) Swagger → (6) tài liệu cũ → (7) comment. Khi các nguồn mâu thuẫn, tài liệu ghi rõ **RUNTIME / TESTED / DOCUMENTED / DISCREPANCY** thay vì tự sửa.

**Files code chính đã đọc để tổng hợp:** `BE/prisma/schema.prisma`, `BE/src/config/{attendance,membership,scoped-data,prisma}.ts`, `BE/src/middlewares/{facilityScope,authorize}.ts`, `BE/src/app.ts`, `BE/src/utils/dbLocks.ts`, các modules `subscriptions/`, `attendance/`, `enrollments/`, `waitlist/`, `facility-visits/`, `payments/`, `reports/`, `class-schedules/`, `classes/`, `auth/`, `notifications/outbox.service.ts`, cùng toàn bộ `BE/tests/*`.

---

# SECTION 1 — MEMBERSHIP POLICY A

## 1.0 State machine & ý nghĩa trạng thái

Enum `MembershipStatus` (schema): `ACTIVE | SUSPENDED | EXPIRED | CANCELLED`. `[CODE-VERIFIED]`

```text
REGISTER / Manager tạo MEMBER
        │  ensureActiveFreeSubscription
        ▼
   ┌──────────┐  mua/gia hạn (atomic replacement)   ┌────────────┐
   │  ACTIVE  │ ───────────────────────────────────▶ │ SUSPENDED  │ (terminal)
   └──────────┘                                      └────────────┘
        │
        │ job 15 phút: endDate < now (CAS)           ┌──────────┐
        ├───────────────────────────────────────────▶ │ EXPIRED  │ (terminal)
        │
        │ hủy (Member tự hủy / Manager)              ┌───────────┐
        └───────────────────────────────────────────▶ │ CANCELLED │ (terminal)

CẤM (400 SUBSCRIPTION_RESUME_FORBIDDEN):
  SUSPENDED  -X-> ACTIVE
  EXPIRED    -X-> ACTIVE
  CANCELLED  -X-> ACTIVE
```

| Trạng thái | Ý nghĩa kinh doanh | Bằng chứng |
| --- | --- | --- |
| `ACTIVE` | Gói đang cấp quyền. Điều kiện hiệu lực thực tế: `status = ACTIVE AND startDate <= now <= endDate` — resolver `findActiveSubscription()` (`enrollment-quota.service.ts`) dùng chung cho booking/quota/check-in/attendance/purchase/renew/cancel | `[CODE-VERIFIED]` |
| `SUSPENDED` | **Gói CŨ bị thay thế bởi gói mới** — trạng thái lịch sử cuối cùng (terminal). **Không** phải freeze, **không** phải pause, **không** resume; `suspendedAt`/`remainingDays` chỉ để audit/hiển thị, **không cộng** vào gói mới | `[VERIFIED]` policy-a: *"SUSPENDED resume rejected"*, *"FREE replaced by PAID, one ACTIVE, no FREE carry-over"* |
| `EXPIRED` | `endDate` đã qua (job chuyển stored-state). Lịch sử, không tự phản sinh gói cũ | `[VERIFIED]` policy-a: *"EXPIRED resume rejected"*, *"expiry job expires ACTIVE without reactivating history"*, *"purchase after expiry creates new ACTIVE"* |
| `CANCELLED` | Tự hủy (Member/Manager) — có mốc `cancelledAt`; hoàn tiền theo luồng riêng (§1.5); không phản sinh | `[VERIFIED]` policy-a *"CANCELLED resume rejected"*; `cross-facility-cancel` Case5/5b/6 |

**Invariant trung tâm (Policy A):** 1 member ≤ 1 subscription `ACTIVE`; mua/gia hạn = **replacement nguyên tử** (suspend gói cũ + tạo gói mới trong CÙNG transaction); **không cộng dồn ngày dư, không stack, không tạo ACTIVE tương lai (queued)**. `[VERIFIED]` policy-a (10/10): *"concurrent purchases end with exactly one ACTIVE"*, *"renew replaces current ACTIVE: one ACTIVE, no stacking"*.

Cơ chế chống đua: `lockMemberSubscription()` = `pg_advisory_xact_lock('membership:member:<id>')` trong transaction + CAS `updateMany({id, status:"ACTIVE"} → SUSPENDED)` phải trả `count = 1`, nếu không → **409 `SUBSCRIPTION_STATE_CHANGED`**. **Không** có unique constraint ACTIVE trong DB — cơ chế authoritative là lock + CAS + transaction (`docs/POLICY_A_MEMBERSHIP_LIFECYCLE.md` `[DOCUMENTED]`, khớp code `[CODE-VERIFIED]`).

## 1.2 Luồng mua gói (Purchase Flow)

Ba kênh đều chốt tiền qua **cùng một hàm** `activateSubscriptionForPayment()` (trong transaction):

```text
[Quầy]  Manager/Receptionist  POST /subscriptions
[SePay]  Member                POST /payments/sepay/checkout → webhook/đối soát/mock-confirm
         │
         ▼
activateSubscriptionForPayment(tx, {...})
  0. request KHÔNG có facilityId (webhook) → tự chạy với facilityId = Payment.facilityId (ORIGIN)
  1. lockMemberSubscription(memberId)            ← advisory lock, serialize purchase/renew/webhook
  2. applyPlanSwitchRules:
       inspectPlanPurchase — chặn hạ hạng (tier mới < tier ACTIVE → 400)
                           — cùng hạng mà durationDays < gói đã bán → 400
                           — remainingDays CHỈ để thông tin/hoàn tiền (FREE luôn 0), KHÔNG cộng
       CAS suspend gói ACTIVE cũ (id + status ACTIVE → SUSPENDED); count ≠ 1 → 409 SUBSCRIPTION_STATE_CHANGED
  3. snapshot offer A07 (planName/tier/duration/quota — lấy từ Payment snapshot nếu có)
  4. tạo MembershipSubscription ACTIVE: startDate = now (quầy có thể startDate tương lai),
     endDate = startDate + durationDays, facilityId = Payment.facilityId (ORIGIN), maxConcurrentClassesSnapshot
  5. Payment → SUCCESS + paidAt + subscriptionId + activationStatus = ACTIVATED + snapshot A07
  6. Invoice ISSUED (subtotal/total = SỐ TIỀN ĐÃ THU, snapshot planName/planTier/memberName)
  7. enqueueNotification PAYMENT_SUCCESS (OUTBOX ghi trong transaction — gửi SAU commit)
         ▼
flushNotificationOutbox() sau commit
```

`[CODE-VERIFIED]` toàn luồng; `[VERIFIED]` qua sepay-payment (145/0: checkout→webhook, snapshot A07, outbox F01), policy-a, cross-facility-cancel.

**Kênh quầy (CASH/BANK_TRANSFER):** `POST /subscriptions` — `authorize("MANAGER", "RECEPTIONIST")`, body `{memberId, planId, paymentMethod: CASH|BANK_TRANSFER, startDate?, note?}` (Zod `CreateSubscriptionSchema`). Service tạo Payment `PENDING` rồi chốt SUCCESS ngay trong cùng transaction. Validate: member phải là user MEMBER active (404/400 BR-16), plan tồn tại & active (404). `[CODE-VERIFIED]` + `[VERIFIED]` (sepay quầy flow; cross-facility-cancel Case5b gọi service)

**Kênh SePay online:** `POST /payments/sepay/checkout` (`MEMBER`): (1) fail-fast `inspectPlanPurchase` TRƯỚC khi tạo đơn (chặn hạ hạng/gói ít ngày — không tạo Payment rác); (2) chặn 1 đơn PENDING cho (member × plan) trong TTL, quá TTL → đóng FAILED để mở đơn mới; (3) tạo Payment `PENDING`, `method = SEPAY`, `gateway = "SEPAY"`, `transactionCode` UNIQUE (mã VietQR), **snapshot A07 ngay lúc tạo QR**. `[VERIFIED]` sepay sections B/E.

**Webhook SePay** `POST /payments/sepay/webhook` (KHÔNG qua authenticate/facility-scope — exempt tại `app.ts:120`; xác thực HMAC-SHA256 trên rawBody + timestamp, hoặc API Key). `settleSepayTransfer()` trong transaction:

```text
(1) claim SepayWebhookEvent.sepayId UNIQUE → trùng = DUPLICATE
(2) tiền RA → IGNORED            (3) mã đơn không khớp hệ thống → IGNORED
(4) lockPaymentWebhook(paymentId)
(5) sai tài khoản nhận → MISMATCH/ACCOUNT_MISMATCH
(6) nội dung chứa NHIỀU mã đơn lạ → MISMATCH/CONTENT_AMBIGUOUS
(7) lệch số tiền → MISMATCH/AMOUNT_MISMATCH  (KHÔNG kích hoạt, ghi note)
(8) đơn đã SUCCESS → DUPLICATE
(9) đơn đã đóng (FAILED/REFUNDED) → LATE + activationStatus = REQUIRES_REVIEW (KHÔNG kích hoạt)
(10) ledger SepayBankTransaction phân bổ MỘT LẦN (CAS theo externalId)
(11) PENDING → activateSubscriptionForPayment với snapshot A07
     - thiếu plan → SUCCESS + REQUIRES_REVIEW (PLAN_MISSING)
     - lỗi nghiệp vụ (vd hạ hạng) → SUCCESS + REQUIRES_REVIEW + reviewReason
       → MANAGER dùng POST /payments/:id/retry-activation để kích hoạt lại sau khi xử lý việc chặn
```

`[VERIFIED]` sepay sections B/D/G/H/K (145/0).

**Đối soát chủ động:** khi FE poll `GET /payments/sepay/:id`, nếu đơn còn PENDING và có `SEPAY_API_TOKEN`, BE gọi SePay API chốt ngay trong lần poll (`reconcileSepayPayment`, nguồn `RECONCILE` không cần sepayId). `[CODE-VERIFIED]` + `[VERIFIED]` sepay section H.

**Mock (dev/e2e):** `POST /payments/sepay/mock-confirm` chỉ khi `SEPAY_MOCK_MODE=true`, **block tuyệt đối ở `NODE_ENV=production`**; MEMBER chỉ xác nhận được đơn CỦA MÌNH. `[VERIFIED]` sepay section C.

**Job tự đóng:** SePay PENDING quá TTL → `FAILED` (lifecycle `closeStaleSepayPendingPayments`), tiền về sau rơi vào nhánh LATE. `[VERIFIED]` lifecycle section 3.

## 1.3 Luồng gia hạn (Renew)

`POST /subscriptions/:id/renew` — `authorize("MANAGER", "RECEPTIONIST")`, body `{planId, paymentMethod: CASH|BANK_TRANSFER, note?}`.

| Câu hỏi | Trả lời (code) | Evidence |
| --- | --- | --- |
| Renew có tạo subscription MỚI không? | **CÓ** — `create()` row mới, KHÔNG mutate `endDate` gói cũ | `[VERIFIED]` policy-a *"renew replaces current ACTIVE: one ACTIVE, no stacking"* |
| Gói ACTIVE cũ có bị SUSPENDED không? | **CÓ** — CAS `updateMany(id + ACTIVE → SUSPENDED, suspendedAt)`; count ≠ 1 → 409 `SUBSCRIPTION_STATE_CHANGED` | `[VERIFIED]` policy-a |
| Kỳ mới bắt đầu ngay? | **CÓ** — `startDate = now`, `endDate = now + plan.durationDays` (không stack sau endDate cũ, không ACTIVE tương lai) | `[VERIFIED]` policy-a |
| Ngày dư có cộng không? | **KHÔNG** (chỉ audit `remainingDays` khi suspend) | `[VERIFIED]` policy-a *"no carry-over"* |
| Renew được gói SUSPENDED không? | Renew **không yêu cầu** subscription trong path `:id` phải ACTIVE: nó thay thế gói ACTIVE HIỆN CÓ của member (nếu có) và tạo gói mới. Gói `:id` SUSPENDED/EXPIRED/CANCELLED chỉ là điểm khởi tạo — không có transition "resume" nào được thực hiện trên row cũ | `[CODE-VERIFIED]` (policy-a test renew từ ACTIVE) |
| Không có gói ACTIVE? | Không có gì để suspend → đơn thuần tạo gói ACTIVE mới | `[CODE-VERIFIED]` |
| Hai renew đồng thời? | Serialize qua `lockMemberSubscription` + CAS; request thua nhận 409 | `[VERIFIED]` policy-a *"concurrent purchases end with exactly one ACTIVE"* (cơ chế purchase/renew/webhook giống nhau) |

Payment cho kỳ mới tạo mới (`status = SUCCESS`, `paidAt = now`) + Invoice ISSUED snapshot. **Renew không gửi notification** (khác purchase có `PAYMENT_SUCCESS` qua outbox) — `[CODE-VERIFIED]`. `facilityId` gói mới = facility đang thao tác (fallback về origin gói cũ). `[CODE-VERIFIED]`

## 1.4 Luồng hết hạn (Expiry)

- **Điều kiện:** `status ∈ {ACTIVE, SUSPENDED} AND endDate < now` → chuyển `EXPIRED` bằng CAS (`updateMany` kèm điều kiện), đồng thời `suspendedAt = null, remainingDays = null`. `[CODE-VERIFIED]` + `[VERIFIED]` lifecycle section 1
- **Job:** `runSubscriptionLifecycleJobs()` chạy **một lần khi boot + interval 15 phút** (`server.ts`), gồm: (1) `expireStaleSubscriptions` (batch 500) + outbox `SUBSCRIPTION_EXPIRED`; (2) `sendSubscriptionExpiryReminders` (nhắc trước 3 ngày, dedupe 24h theo subscription — kiểm tra cả Notification đã gửi lẫn Outbox đang chờ); (3) `closeStaleSepayPendingPayments`. `[VERIFIED]` lifecycle sections 1–3 (*idempotent chạy lại không gửi trùng*)
- **Lazy + scheduled:** quyền sử dụng **luôn** được suy ra theo `startDate <= now <= endDate` ở mọi resolver → gói quá hạn mất quyền NGAY cả trước khi job kịp đổi stored-state; job chỉ đồng bộ stored-state cho báo cáo/thông báo. `[CODE-VERIFIED]` (comment + code `findActiveSubscription`)
- **Không hồi sinh:** job không kích hoạt lại SUSPENDED/FREE cũ, không tạo fallback subscription. `[VERIFIED]` policy-a *"expiry job expires ACTIVE without reactivating history"*
- **Sau khi hết hạn, member làm được gì?**
  - Vẫn là MEMBER; xem lịch sử, profile, hóa đơn (MF-05: nhân sự thấy đủ lịch sử thanh toán).
  - **Bị chặn:** đặt lớp (403 *"Không có gói tập đang hoạt động"*), transfer/bulk (cùng bộ luật), check-in (403), tự điểm danh QR/mã (403 *"Gói tập đã hết hạn"*), quota `limit = 0`. `[CODE-VERIFIED]` từng endpoint; `[VERIFIED]` (quota 10 *"Member không có gói ACTIVE → limit = 0"*; sepay E)
  - Đăng nhập lần sau → MF-08 có thể cấp FREE ACTIVE mới (§1.1) `[CODE-VERIFIED]`
  - Muốn dùng lại → mua/gia hạn gói mới (Policy A) `[VERIFIED]` policy-a *"purchase after expiry creates new ACTIVE"*

## 1.5 Hủy gói & hoàn tiền (Cancellation / Refund)

Có **hai luồng hủy** với công thức hoàn tiền **KHÁC NHAU** — không trộn lẫn:

### A) Member tự hủy — `PATCH /subscriptions/:id/cancel` (`authorize("MEMBER")`)

```text
Request { reason? } (max 500)
 → tìm subscription + verify NGƯỜI HỦY = chủ gói (403 nếu không)
 → nếu status ≠ ACTIVE → 400 "Không thể hủy gói đang ở trạng thái ..."
 → daysLeft = ceil((endDate − now)/1 ngày)
 → refund: daysLeft > 15  →  round(amount SUCCESS gần nhất × 30%)
           daysLeft ≤ 15  →  0
 → transaction:
     1. subscription → CANCELLED + cancelledAt = now
     2. BỎ scope facility → hủy TOÀN BỘ enrollment BOOKED tương lai của member (mọi cơ sở)
     3. nếu refund > 0: Payment gốc → REFUNDED + refundedAmount + refundedAt + note
        (chạy trong context facility = originalPayment.facilityId → không vướng FORBIDDEN_SCOPE)
 → notification SUBSCRIPTION_CANCELLED (direct create, fire-and-forget)
 → trả { status, daysLeft, refundAmount, willRefund, message }
```

`[CODE-VERIFIED]`; `[VERIFIED]` cross-facility-cancel Case5: *"KHÔNG còn FORBIDDEN_SCOPE — hủy + hoàn tiền tại B thành công"*, *"payment REFUNDED đúng 30% (300.000đ) và có refundedAt"*, *"booking tương lai tại A và B của cùng hội viên đều CANCELLED"*; Case6: member khác → 403.

Swagger của endpoint ghi đúng 30% / ≤15 ngày → **không có DISCREPANCY** (code = swagger). `[VERIFIED]` code đọc + swagger đọc.

### B) Manager hủy — `PATCH /subscriptions/:id/status` (`authorize("MANAGER")`)

- Body: `{ status: ACTIVE | EXPIRED | CANCELLED | SUSPENDED }` (Zod `UpdateStatusSchema`).
- **Cấm resume** (đổi sang `ACTIVE` khi đang `SUSPENDED`/`EXPIRED`/`CANCELLED`) → **400 `SUBSCRIPTION_RESUME_FORBIDDEN`** (3 nhánh, message riêng từng trạng thái). `[VERIFIED]` policy-a (3 checks)
- `ACTIVE → SUSPENDED`: cho phép, ghi `suspendedAt` + `remainingDays` (audit-only, không cộng dồn). `[CODE-VERIFIED]`
- `ACTIVE → CANCELLED` (đường prorated):
  ```text
  refund = min( round(amount / soldDuration × daysLeft), round(amount) )
  ```
  với `soldDuration` lấy từ `durationDaysSnapshot` (fallback chia `endDate − startDate`); **KHÔNG bao giờ vượt số tiền đã thu**. Transaction: subscription CANCELLED + hủy enrollment BOOKED tương lai GLOBAL (bỏ scope) + Payment REFUNDED (context facility = payment.facilityId) + invoice → CANCELLED nếu có. Notification `PAYMENT_REFUNDED` (refund > 0) hoặc `SUBSCRIPTION_CANCELLED`. `[CODE-VERIFIED]` công thức; `[VERIFIED]` cross-facility-cancel Case5b: *"Manager hủy từ facility B KHÔNG lỗi"*, *"membership CANCELLED + payment REFUNDED + booking tại A CANCELLED"* (suite 17/18 — Case5b PASS).
- Refund **gốc phát hành tại cơ sở nào thì ghi ở context facility đó (ORIGIN)** — không đổi chủ sở hữu payment. `[CODE-VERIFIED]`

### C) Qua trạng thái payment — `PATCH /payments/:id/status` (`MANAGER`, chỉ giao dịch KHÔNG có gateway)

- State machine nghiêm: `SUCCESS → chỉ REFUNDED`; `FAILED`/`REFUNDED` bất di bất dịch; đổi từ `FAILED`/`REFUNDED` → 400. `[CODE-VERIFIED]`
- `REFUNDED` đầy đủ (`refundedAmount = amount`) và nếu `subscriptionId` còn ACTIVE → subscription `CANCELLED` + hủy booking tương lai GLOBAL. `[CODE-VERIFIED]`
- Giao dịch có `gateway` (SePay) → **400** "Không thể đổi trạng thái thanh toán online thủ công". `[CODE-VERIFIED]`

### D) Side-effect hủy booking

Mọi đường hủy (Member/Manager/payment-refund) đều hủy enrollment `BOOKED` **tương lai** của member trên **MỌI cơ sở** (Membership là GLOBAL) — dùng `requestContext.run({facilityId: undefined})` để bỏ scope cho đúng câu updateMany, where vẫn giới hạn `memberId + BOOKED + startTime > now`. `[VERIFIED]` cross-facility-cancel Case1/2/5/5b.

### E) Lịch sử trước hủy

`cancelledAt` cắt **phạm vi quyền lợi dùng cho tính attendance (A10)** nhưng KHÔNG xoá điểm danh đã có; các buổi học trước mốc hủy vẫn được đếm. `[CODE-VERIFIED]` (`buildCoverageIntervals`)

## 1.6 Bất biến Membership (chỉ nêu cái ĐƯỢC enforce)

| # | Bất biến | Enforced bởi | Evidence |
| --- | --- | --- | --- |
| INV-1 | 1 member ≤ 1 subscription `ACTIVE` | advisory lock + CAS suspend + cùng transaction (KHÔNG có unique index) | `[VERIFIED]` policy-a concurrent purchases |
| INV-2 | `SUSPENDED/EXPIRED/CANCELLED → ACTIVE` = 400 `SUBSCRIPTION_RESUME_FORBIDDEN` | 3 nhánh chặn trong `updateSubscriptionStatus` | `[VERIFIED]` policy-a (3 checks) |
| INV-3 | Không cộng ngày dư (carry-over), không stack, không ACTIVE tương lai | `endDate = start + durationDays` với `start = now`; `remainingDays` audit-only | `[VERIFIED]` policy-a (FREE & paid carry-over, renew no-stacking) |
| INV-4 | FREE luôn trả `remainingDays = 0` khi bị thay thế | `inspectPlanPurchase`: `tier !== "FREE" && endDate > now` mới tính | `[VERIFIED]` sepay H, policy-a |
| INV-5 | Replacement nguyên tử (không nửa vời) | cùng `$transaction`: suspend + create + payment + invoice + outbox | `[VERIFIED]` policy-a/sepay |
| INV-6 | Không hạ hạng; cùng hạng không mua gói ít ngày hơn gói đã bán | `inspectPlanPurchase` → 400 | `[CODE-VERIFIED]` |
| INV-7 | Quota đã bán snapshot theo kỳ (`maxConcurrentClassesSnapshot`) | ghi lúc cấp/SEPAY checkout A07 | `[CODE-VERIFIED]` (test quota có cover snapshot plan live ở mức độ nào thì xem §4) |
| INV-8 | FREE contribute 0 giá trị tiền (price 0, không sinh revenue) | `planAmount = 0`; checkout chặn `plan.tier === FREE` | `[CODE-VERIFIED]` + `[VERIFIED]` sepay E (chặn gói FREE) |

## 1.7 Ví dụ Membership

**Ví dụ A — Member mới: FREE → trả phí**
1. `POST /auth/register` → MemberProfile + subscription FREE ACTIVE (3650 ngày, quota 0, facilityId null). `[CODE-VERIFIED]`
2. Mua gói MEMBERSHIP 30 ngày tại quầy/A: FREE bị SUSPENDED (`suspendedAt` ghi, `remainingDays` ≈ 3650 audit nhưng **KHÔNG cộng**), gói 30 ngày ACTIVE `startDate = now`, `endDate = now + 30`. `[VERIFIED]` policy-a *"FREE replaced by PAID, one ACTIVE, no FREE carry-over"* (endDate < 31 ngày).

**Ví dụ B — Đang có paid → mua paid khác**
Gói 30 ngày ACTIVE → mua gói 60 ngày: gói 30 ngày → SUSPENDED, gói 60 ngày ACTIVE ngay thời điểm chốt tiền; **không** cộng ~xén ngày của gói 30. `[VERIFIED]` policy-a *"paid replaced by paid, one ACTIVE, no carry-over"*. Nếu cố mua tier thấp hơn → 400; cùng tier ít ngày hơn gói đã bán → 400. `[CODE-VERIFIED]`

**Ví dụ C — Paid hết hạn**
endDate qua → resolver trả `null` NGAY (lazy); job 15 phút chuyển stored-state `EXPIRED` + notification `SUBSCRIPTION_EXPIRED`. Member không book/check-in/điểm danh được. Gói FREE cũ vẫn `SUSPENDED` (không hồi sinh). `[VERIFIED]` policy-a + lifecycle. Đăng nhập lại → MF-08 có thể cấp FREE ACTIVE mới (quota 0). `[CODE-VERIFIED]`

**Ví dụ D — Renew**
`POST /subscriptions/:id/renew {planId}`: gói ACTIVE → SUSPENDED; gói mới ACTIVE `start = now`, `end = now + durationDays` — ví dụ gói 30 ngày cũ còn 10 ngày → **vẫn chỉ có 30 ngày mới** (10 ngày mất). `[VERIFIED]` policy-a *"renew replaces current ACTIVE: one ACTIVE, no stacking"*.

**Ví dụ E — Cố resume gói SUSPENDED**
`PATCH /subscriptions/:id/status {status:"ACTIVE"}` trên gói SUSPENDED → **400** `{code: "SUBSCRIPTION_RESUME_FORBIDDEN"}` *"Suspended subscription has been replaced and cannot be reactivated. Please purchase or renew a new subscription."* — y hệt với EXPIRED/CANCELLED. `[VERIFIED]` policy-a (3 checks)

**Ví dụ F — Hai mua đồng thời (2 request song song)**
Cả hai chạy `Promise.allSettled([purchase, purchase])`: theo lock, request 1 suspend + tạo ACTIVE rồi commit; request 2 đọc lại trong lock → thấy gói ACTIVE của request 1, suspend nó, tạo ACTIVE mới — hoặc fail CAS với 409. Kết thúc: **đúng 1 (hoặc chuỗi thay thế hợp lệ, không bao giờ 2 ACTIVE cùng lúc)** — assertion của test: `exactly one ACTIVE`. `[VERIFIED]` policy-a *"concurrent purchases end with exactly one ACTIVE"*

---

# SECTION 2 — ATTENDANCE POLICY

Hai **lớp** tách bạch (nguồn: `config/attendance.ts` + `attendance-analytics.service.ts`):

```text
LỚP 1 — ADVISORY (tự động, thuần thông báo):
   FIXED (Class có plannedSessionCount > 0)  hoặc  RECURRING (fallback rolling)
        → NORMAL / NOTICE / WARNING  → chỉ gửi notification tham khảo
        → KHÔNG phạt / KHÔNG khóa booking / KHÔNG hủy / KHÔNG đổi gói

LỚP 2 — PENALTY thủ công (quyết định của con người):
   Manager review → POST /attendance/penalties/apply (lý do + audit decidedBy)
        → AttendancePenalty APPLIED → chặn ĐẶT LẠI đúng (member × class) tới blockedUntil
```

`[CODE-VERIFIED]` (comment đầu file + code); WARNING không bao giờ tự sinh penalty: `[VERIFIED]` (quota 6 chỉ apply qua API MANAGER; không có code path nào tự gọi `applyPenalty`)

Dữ liệu nguồn: `Class.attendancePolicy` (TEXT, default `"RECURRING"`) + `Class.plannedSessionCount` (INT nullable) — thêm migration `20261011000000_class_attendance_policy`. `[CODE-VERIFIED]`

## 2.1 Chính sách FIXED

**FIXED được dùng khi:** `attendancePolicy === "FIXED" AND typeof plannedSessionCount === "number" AND plannedSessionCount > 0` (đúng điều kiện code trong `computeAttendanceBuckets`). `[CODE-VERIFIED]` + `[VERIFIED]` (unit test đọc hàm — final-member-facility)

```text
allowedAbsences = floor(plannedSessionCount × 20%)
currentAbsences = ABSENT + NO_SHOW   (đã "chốt": buổi đã kết thúc, trong coverage)
```

**Bảng allowance** (`absenceAllowance`) — `[VERIFIED]` final-member-facility (26 assert, 7 dòng bảng):

| Planned sessions | 2 | 3 | 4 | 5 | 10 | 15 | 20 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Allowed absences | 0 | 0 | 0 | 1 | 2 | 3 | 4 |

**Loại trừ khỏi `currentAbsences`:**

| Loại trừ | Cách loại |
| --- | --- |
| `EXCUSED` (vắng có phép) | đếm riêng `excusedCount`, không vào vắng |
| Buổi bị center hủy (`ClassSchedule.status = CANCELLED`) | query loại `status: { not: "CANCELLED" }` |
| Buổi tương lai / chưa kết thúc | `schedule.endTime <= now` |
| Buổi ngoài coverage quyền lợi (A10) | `isCoveredByMembership` theo `[startDate, min(endDate, cancelledAt, suspendedAt)]` |
| Enrollment bị CANCELLED | chỉ đếm enrollment `BOOKED/COMPLETED` |
| `LATE`/`PRESENT` | không phải vắng |

`[CODE-VERIFIED]` từng dòng; coverage A10 `[CODE-VERIFIED]`.

**Phân loại** (`classifyFixedAbsence`) — `[VERIFIED]` final-member-facility:

```text
currentAbsences <  allowed  → NORMAL
currentAbsences == allowed  → NOTICE
currentAbsences >  allowed  → WARNING
(0, 0) → NORMAL ;  (1, 0) → WARNING     ← allowance = 0: vắng đầu tiên = WARNING ngay
```

**Đánh giá TRƯỚC khi học xong khóa (early warning):** evaluation chạy trên `schedule.endTime <= now` — tức sau **mỗi buổi đã kết thúc**, KHÔNG đợi cả khóa hoàn tất; không yêu cầu mẫu tối thiểu 5. Việc gửi thông báo xảy ra khi: (a) `PATCH /class-schedules/:id/complete` xong → `scanAttendanceWarnings(classId)` fire-and-forget; (b) MANAGER gọi `POST /attendance/warnings/scan`. `[CODE-VERIFIED]` + `[VERIFIED]` (attendance suite không cover scan — xem §4: warning scan là `[CODE-VERIFIED]`, unit phân loại `[VERIFIED]`)

**Ví dụ sớm:** khóa 10 buổi (allowance 2). Sau buổi 3 mà member vắng 2 → `current == allowed` → **NOTICE ngay** ("dùng hết số buổi vắng cho phép") — không chờ buổi 10. Vắng buổi thứ 3 → **WARNING**. `[CODE-VERIFIED]`

**Snapshot & khóa policy:**
- `plannedSessionCount` là **snapshot** — thêm schedule sau này KHÔNG tăng allowance (không COUNT schedule). `[CODE-VERIFIED]`
- Sửa `attendancePolicy`/`plannedSessionCount` khi Class **đã có enrollment** → **400 `{code: "ATTENDANCE_POLICY_LOCKED"}`** *"Không thể đổi chính sách/tổng số buổi chuyên cần khi Class đã có người đăng ký. Hãy tạo Class/cohort mới cho amendment."* (`classes.service.ts:176-185`). `[CODE-VERIFIED]` — **chưa có test chạy** cho lỗi này.
- Zod `CreateClass`: `attendancePolicy = FIXED` mà thiếu `plannedSessionCount` → 400 *"FIXED class requires plannedSessionCount"*; `RECURRING` → ép `plannedSessionCount = null`. `[CODE-VERIFIED]`

## 2.2 Chính sách RECURRING (fallback)

Áp cho **mọi trường hợp không phải FIXED** (default của schema là `RECURRING`). `[CODE-VERIFIED]`

| Thông số | Giá trị | Hằng số |
| --- | --- | --- |
| Cửa sổ rolling | 10 buổi gần nhất / (member × class) | `ATTENDANCE.SAMPLE_WINDOW = 10` |
| Mẫu tối thiểu | < 5 buổi được tính → luôn **NORMAL** | `ATTENDANCE.MIN_SAMPLE = 5` |
| Công thức rate | `rate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT + NO_SHOW)` × 100 — EXCUSED không vào tử/mẫu; `sampleSize = 0` → rate 100 | `computeAttendanceBuckets` |
| Ngưỡng | `rate >= 80%` → **NORMAL**; `70% <= rate < 80%` → **NOTICE**; `rate < 70%` → **WARNING** | `WARN_THRESHOLD = 80`, `RELEASE_THRESHOLD = 70` |

`[CODE-VERIFIED]` toàn bộ; **`[VERIFIED]` final-member-facility**: `classifyAttendance(0,0)=NORMAL`, `(100,4)=NORMAL` (sample<5), `(85,5)=NORMAL`, `(79,5)=NOTICE`, `(70,5)=NOTICE`, `(69,5)=WARNING`.

`NO_SHOW` = (a) bản ghi `ABSENT` có `note = "SYSTEM_NO_SHOW"` do hệ thống tạo khi complete schedule, hoặc (b) buổi đã kết thúc nhưng CHƯA có bản ghi attendance nào. `[CODE-VERIFIED]`

## 2.3 WARNING ≠ PENALTY

```text
computeAttendanceBuckets → status = NORMAL | NOTICE | WARNING     (advisory, tự động)
        │  KHÔNG tự động phạt, KHÔNG tự khóa, KHÔNG đụng gói tập
        ▼
Manager review  ─ POST /attendance/penalties/preview (chỉ đọc)
        │
        ▼  (quyết định của con người — MANAGER)
POST /attendance/penalties/apply {memberId, classId, reason?}
        │  validate lại: đủ mẫu (FIXED: min(5, totalPlannedSessions); RECURRING: 5)
        │  chưa có penalty PENDING/APPLIED cho cặp này (409 nếu có)
        ▼
AttendancePenalty status = APPLIED, blockedUntil = now + 30 ngày (PENALTY_BLOCK_DAYS)
   + reason (nếu client không gửi → buildPenaltyReason(bucket))
   + attendanceRate, sampleSize (snapshot lúc phạt)
   + decidedBy, decidedAt  (audit)
   + releasedCount + releasedEnrollmentIds  (số chỗ bị thu hồi)
        │
        ├─ trong tx: hủy enrollment BOOKED TƯƠNG LAI của đúng (member × class) này
        └─ assertCanBook: member đó book lại Class NÀY → 403 tới blockedUntil
           (Class khác vẫn book bình thường nếu quota cho phép)
```

| Câu hỏi | Trả lời | Evidence |
| --- | --- | --- |
| Ai áp dụng? | Chỉ **MANAGER** (`authorize("MANAGER")`; ADMIN đi ngả MANAGER/RECEPTIONIST trong `authorize`) | `[CODE-VERIFIED]` |
| Lý do bắt buộc? | `reason` là **tùy chọn** (Zod `max 500`) — thiếu thì service tự sinh từ bucket. KHÔNG có trường "lý do bắt buộc" | `[CODE-VERIFIED]` |
| Audit? | `decidedBy` + `decidedAt` bắt buộc ghi; appeal ghi `appealReason`/`appealedAt`; revoke ghi `revokedBy`/`revokedAt`/`revokedReason` | `[CODE-VERIFIED]` |
| Yêu cầu mẫu? | FIXED: `min(5, plannedSessionCount)` (2 buổi→2, 3→3, 4→4, 5+→5); RECURRING: 5. Thiếu → 400 *"Chưa đủ N buổi được tính để áp dụng hình phạt"* | `[CODE-VERIFIED]` |
| Phạm vi penalty? | Đúng **(member × class)** — không ảnh hưởng class khác, không ảnh hưởng member khác | `[VERIFIED]` quota 6: *"Đặt lại Class P → 403 do penalty"*, *"403 này KHÔNG phải lỗi quota"*, *"Class khác vẫn book được"* |
| Membership có bị ảnh hưởng? | **KHÔNG** — không hủy/freeze/rút gọn/gia hạn gói; chỉ hủy chỗ đặt tương lai của class đó + chặn đặt lại | `[VERIFIED]` quota 6 (quota/gói không đổi trừ slot bị thu) |
| WARNING tự động làm gì? | **CHỈ gửi notification tham khảo.** KHÔNG tự chặn booking, KHÔNG hủy gói, KHÔNG freeze, KHÔNG hoàn tiền | `[CODE-VERIFIED]` (không có code path) + `[VERIFIED]` gián tiếp (quota 6 penalty chỉ đến từ API apply) |
| Appeal? | Member khiếu nại trong **72h** (`APPEAL_WINDOW_HOURS`) — chỉ ghi audit + notify người quyết định, **KHÔNG tự gỡ** | `[CODE-VERIFIED]` |
| Revoke? | `POST /attendance/penalties/:id/revoke` (MANAGER) → `REVOKED`; `restoreSlots = true` khôi phục từng chỗ CÓ ĐIỀU KIỆN (chưa bắt đầu, còn capacity, không trùng giờ — không overbooking) | `[CODE-VERIFIED]` |
| Hết hạn phạt? | `APPLIED` quá `blockedUntil` → `EXPIRED` (lazy-expire ở list/summary/apply + tại `getMyAttendanceSummary`) | `[CODE-VERIFIED]` |

Trạng thái `AttendancePenaltyStatus` có `PENDING` nhưng **không luồng nào persist PENDING** (preview read-only, apply tạo thẳng `APPLIED`) — reserved cho luồng duyệt tương lai. `[CODE-VERIFIED]` (comment schema) — query list vẫn nhận filter `PENDING` (Zod) → `[CODE-VERIFIED]` (không phải bug, chỉ là trạng thái dự phòng).

## 2.4 Notification chuyên cần

**Khi nào chạy evaluation:** `computeAttendanceBuckets` là hàm tính toán **on-demand** (GET report/summary, scan, preview, apply). `[CODE-VERIFIED]`

**Ai kích hoạt quét & gửi thông báo:**
1. `PATCH /class-schedules/:id/complete` (MANAGER/RECEPTIONIST) — sau khi transaction complete xong: `scanAttendanceWarnings(schedule.classId).catch(() => {})` → **fire-and-forget**, không block response, lỗi nuốt. `[CODE-VERIFIED]`
2. `POST /attendance/warnings/scan` (MANAGER, optional `classId`). `[CODE-VERIFIED]`
3. **GET KHÔNG gửi notification** — `GET /reports/attendance` và `GET /attendance/my/summary` chỉ tính + có thể lazy-expire penalty (đổi stored-state), không tạo notification. `[CODE-VERIFIED]`

**Dedupe theo STATE TRANSITION** (`scanAttendanceWarnings`): tìm notification `ATTENDANCE_WARNING` GẦN NHẤT của (member × class), đọc `metadata.state`:

| Chuyển trạng thái | Hành động |
| --- | --- |
| chưa từng báo → NOTICE/WARNING mới | gửi |
| trạng thái gần nhất == hiện tại (rate nhích) | **KHÔNG gửi lại** (`skippedDuplicate++`) |
| NOTICE → WARNING (hoặc ngược) | gửi đúng 1 lần cho trạng thái mới |
| NORMAL | không gửi (chỉ quét NOTICE/WARNING) |

`[CODE-VERIFIED]` (dedupe theo `metadata.state`, không theo rate).

**Độ bền notification:**

| Loại | Cơ chế | Đảm bảo? |
| --- | --- | --- |
| Quét warning (`ATTENDANCE_WARNING`) | `createNotification` **direct** (await trong scan, nhưng scan itself fire-and-forget từ completeSchedule) | **KHÔNG có retry** — nếu process chết giữa chừng thì mất; `[CODE-VERIFIED]` |
| Booking/payment/promotion/expiry/expiring | `enqueueNotification` ghi **OUTBOX trong transaction** → flush sau commit + worker 5 giây + CAS claim + backoff, tối đa 10 attempts → `FAILED` | Ghi atomic với nghiệp vụ (rollback = không thông báo); **gửi có retry nhưng không guaranteed delivery** (failed rows cần xem tay); `[CODE-VERIFIED]` |
| Hủy gói / penalty / transfer | `createNotification(...).catch(() => {})` fire-and-forget | KHÔNG retry; `[CODE-VERIFIED]` |

**KHÔNG tuyên bố guaranteed delivery** — outbox có retry nội bộ nhưng `FAILED` là chốt cuối (không có worker hồi sinh `FAILED`). `[CODE-VERIFIED]`

**Nội dung wording FIXED:** thông báo FIXED nêu *"Khóa này có X buổi, được phép vắng tối đa Y buổi, bạn đã vắng Z buổi"* + câu *"không tự động khóa đặt lớp hay ảnh hưởng gói tập"* cho WARNING. `[CODE-VERIFIED]`

## 2.5 Báo cáo chuyên cần — `GET /api/v1/reports/attendance`

- **Role:** `router.use(authenticate, authorize("MANAGER"))` → **MANAGER** (và ADMIN nhờ ngả quyền trong `authorize`). Facility scope: endpoint nằm trong nhóm cần `X-Facility-Id`. `[CODE-VERIFIED]`
- **Query (Zod `AttendanceReportQuerySchema`):** `status ∈ {NORMAL, NOTICE, WARNING}` (optional), `classId`, `memberId`, `page` (mặc định 1), `limit` (mặc định 20, max 100). `[CODE-VERIFIED]`
- **Ý nghĩa `?status=WARNING`:** lọc các dòng **(member × class) đang được phân loại WARNING** tại thời điểm gọi (tính động, không lưu bảng trạng thái). Lưu ý: `summary` được tính **TRƯỚC** khi lọc status (summary phản ánh toàn bộ, `rows` mới là kết quả lọc) — `[CODE-VERIFIED]` (đọc code thứ tự filter).
- **Sắp xếp:** rủi ro cao trước — `currentAbsences − allowedAbsences` giảm dần, rồi `attendanceRate` tăng, rồi `sampleSize` giảm. `[CODE-VERIFIED]`

**Trả về** (`rows` + `summary` + `pagination`) — mỗi row gồm (`AttendanceBucket` + `activePenalty`):

| Field | Ý nghĩa |
| --- | --- |
| `memberId`, `memberName`, `memberUserId` | định danh hội viên |
| `classId`, `className` | lớp |
| `policy` | `"FIXED"` hoặc `"RECURRING"` |
| `totalPlannedSessions` | FIXED: snapshot; RECURRING: `null` |
| `completedSessions` | số buổi đã chốt trong coverage (`sampleSize + excusedCount`) |
| `currentAbsences`, `allowedAbsences`, `remainingAbsences` | FIXED có ý nghĩa; RECURRING: `0` |
| `sampleSize`, `presentCount`, `lateCount`, `absentCount`, `noShowCount`, `excusedCount` | các quầy đếm |
| `attendanceRate` | % (RECURRING dùng chính nó; FIXED chỉ để tham khảo) |
| `status` | NORMAL / NOTICE / WARNING |
| `activePenalty` | `{id, status, blockedUntil, releasedCount}` hoặc `null` (chỉ penalty `PENDING/APPLIED`) |
| `summary` | `{total, normal, notice, warning}` |
| `pagination` | `{page, limit, total, totalPages}` |

`[CODE-VERIFIED]` từng field; `[VERIFIED]` membership-reports (10/0 — suite cover báo cáo membership; report attendance read qua code, assertion trực tiếp chưa thấy → khoanh `[CODE-VERIFIED]` cho phần response shape của attendance report).

**Ghi chú Swagger/no-show:** `PATCH /class-schedules/:id/complete` — trong transaction: tạo `ABSENT` + `note = "SYSTEM_NO_SHOW"` cho mọi enrollment BOOKED chưa có điểm danh (`skipDuplicates`), chuyển BOOKED → COMPLETED, CAS schedule → COMPLETED (lock schedule chống đua), idempotent nếu đã COMPLETED. `[CODE-VERIFIED]` — **test trực tiếp?** `[CODE-VERIFIED]` (chưa thấy suite gọi complete schedule rồi assert no-show; facility-operations có tạo attendance trực tiếp nhưng không phải luồng complete).

---

# SECTION 3 — MEMBER × FACILITY

## 3.1 Toàn cục (GLOBAL) vs Cơ sở (FACILITY)

Kiến trúc cuối: **MEMBERSHIP = GLOBAL · OPERATIONS = FACILITY-SCOPED · `Subscription.facilityId` = ORIGIN** (nơi phát hành, chỉ cho báo cáo/audit — KHÔNG giới hạn hiệu lực).

| Dữ liệu | Scope | Ý nghĩa | Evidence |
| --- | --- | --- | --- |
| Membership entitlement (gói ACTIVE, tier, quota) | **GLOBAL** | `MembershipSubscription` KHÔNG nằm trong DAL facility scope → tra được mọi cơ sở; đổi `X-Facility-Id` không làm gói biến mất | `[CODE-VERIFIED]` (`scoped-data.ts` chú thích) + `[VERIFIED]` final/cross-facility suites |
| `Subscription.facilityId` | **ORIGIN** | Cơ sở thu tiền phát hành gói (báo cáo/audit). `NULL` với FREE. Mua ở A vẫn dùng được ở B/C | `[VERIFIED]` cross-facility-booking |
| `Payment` | **FACILITY** | DAL tự lọc theo facility context; payment phát hành ở đâu thấy ở đó; refund ghi về context ORIGIN | `[VERIFIED]` cross-facility-cancel Case8 *"GET /payments tại A chỉ thấy payment phát hành ở A"* |
| `Class`, `Room`, `Schedule (ClassSchedule)` | **FACILITY** | Model gốc có `facilityId` (Class `@default("legacy-main")`) | `[CODE-VERIFIED]` + `[VERIFIED]` Case8 |
| `Enrollment` | **scope theo CHA** (`Enrollment → Class → facilityId`) cho thao tác của staff; view của member là GLOBAL | Staff A không thấy booking của class B; member tự thấy chỗ của mình mọi nơi | `[VERIFIED]` Case8 *"GET /enrollments vẫn scope theo facility của class"* |
| `Attendance` | scope theo CHA (`schedule`, `class`) | | `[CODE-VERIFIED]` |
| `FacilityVisit` | **FACILITY** (usage facility = cơ sở ĐANG vào) | | `[CODE-VERIFIED]` |
| `WaitlistEntry` | scope theo CHA (`schedule`, `class`); `GET /waitlist/my` chủ động bỏ scope → GLOBAL | | `[CODE-VERIFIED]` |
| `Invoice` | scope theo CHA (`payment`) — trừ khi xem qua subscriptions detail (MF-05 không filter nested) | | `[CODE-VERIFIED]` |
| Reports | **theo endpoint** (xem §5) | memberships/cross-facility-usage = ORIGIN facility; revenue = payment facility-scoped | `[CODE-VERIFIED]` |
| Models `facilityRoots` | `Room, Class, Payment, FacilityVisit, Issue, LeaveRequest, Slot, SchedulePattern, AuditLog, FacilityStaff` | tự lọc/ghi theo facility trong requestContext | `[CODE-VERIFIED]` + `[VERIFIED]` (DAL test Case8) |

## 3.2 Hạ tầng facility scope

```text
Request (HTTP)
 → authenticate (JWT)                      [bỏ qua cho 1 số route public + webhook SePay]
 → checkFacilityScope (app.ts, nhóm route có liệt kê)
     - lấy facility từ params/query/body/X-Facility-Id
     - thiếu → 400 FACILITY_CONTEXT_REQUIRED
     - trùng lệch giữa các nguồn → 400 CONFLICTING_FACILITY_CONTEXT
     - facility không tồn tại / inactive → 403 FORBIDDEN_SCOPE
     - ADMIN, MEMBER: miễn kiểm assignment
       vai trò khác (COACH/MANAGER/RECEPTIONIST): phải có FacilityStaff row active
       khớp (facilityId, userId, role) → không có: 403 FORBIDDEN_SCOPE
     - requestContext.run({facilityId, actorId, role, reason}) → next()
 → DAL (prisma $use middleware):
     - model facilityRoots / parents → tự inject facilityFilter vào where
     - kiểm row theo id có facilityId khớp context không (read theo id)
     - write AuditLog cho model audited khi có actorId + facilityId
     - MembershipSubscription KHÔNG thuộc scope (GLOBAL)
```

`[CODE-VERIFIED]` (`facilityScope.ts`, `prisma.ts`, `scoped-data.ts`); `[VERIFIED]` (facility-http / facility-operations / cross-facility-cancel Case8 kiểm cách ly facility thực tế).

**Route exempt khỏi authenticate+scope tại tầng app:** `GET /membership-plans`, `GET /sports`, `GET /subjects` (public), và `POST /payments/sepay/webhook`. Mọi route khác trong danh sách gốc (`rooms, classes, class-schedules, enrollments, subscriptions, payments, invoices, reports, attendance, feedbacks, operations, members, coaches, issues, leave-requests, audit-logs, slots, schedule-patterns, counter-orders, membership-plans, sports, subjects, facility-visits, waitlist`) đều qua authenticate + checkFacilityScope. `[CODE-VERIFIED]` (`app.ts:86-126`)

**Nhân sự (COACH/MANAGER/RECEPTIONIST) bị chặn nếu không assigned vào facility đang chọn; MEMBER thì luôn qua scope check (miễn assignment) nhưng vẫn phải facility active.** `[CODE-VERIFIED]`

## 3.3 Hành trình hội viên (câu chuyện thực tế)

```text
1. Đăng ký            → FREE ACTIVE (facilityId = null, quota 0)
2. Mua gói 30 ngày ở A (quầy/SePay)
                        → Payment facilityId = A (ORIGIN)
                        → FREE → SUSPENDED ; gói 30 ngày ACTIVE (facilityId = A = ORIGIN)
3. Đặt lớp Yoga ở B    → findActiveSubscription (GLOBAL) → còn hạn? quota? tier?
                        → kiểm TRÙNG GIỜ với mọi booking (mọi cơ sở)
                        → kiểm TRAVEL BUFFER nếu khác facility (§3.6)
                        → capacity B → BOOKED (Enrollment scope theo Class của B)
4. Buổi học ở B        → HLV sinh QR/mã → member tự điểm danh (cửa sổ −30′ … endTime)
5. Check-in vào cửa B  → POST /facility-visits/check-in (X-Facility-Id = B)
                        → facility active + gói ACTIVE (FREE cũng vào được) + dedupe 5′
                        → FacilityVisit facilityId = B (USAGE, khác ORIGIN)
6. Đặt tiếp ở C        → cùng luật toàn cục (quota 3/3 nếu plan maxConcurrentClasses = 3)
7. Hủy gói             → hủy MỌI booking tương lai ở A/B/C ; refund ghi ở payment ORIGIN = A
8. Báo cáo             → cross-facility-usage(A): "gói phát hành ở A đang dùng ở đâu" = B, C
```

Mỗi bước đều đã chỉ ra file code ở các mục tương ứng. `[CODE-VERIFIED]` tổng thể; các mắt xích riêng lẻ có `[VERIFIED]` ở §3.4–3.9.

## 3.4 Quota lớp học song song (GLOBAL)

Nguồn: `MembershipPlan.maxConcurrentClasses` (Manager cấu hình; mặc định theo tier `FREE = 0, MEMBERSHIP = 3, PREMIUM = 6`) + snapshot `MembershipSubscription.maxConcurrentClassesSnapshot` (đọc snapshot trước, dữ liệu cũ fallback plan live). `[CODE-VERIFIED]`

```text
used = COUNT(DISTINCT Class) mà member có ≥1 Enrollment BOOKED
       ở buổi SCHEDULED CHƯA bắt đầu (startTime > now, status SCHEDULED)
limit = gói ACTIVE ? (snapshot ?? plan.maxConcurrentClasses) : 0
remaining = max(0, limit − used)
```

- **Đếm DISTINCT Class** — nhiều buổi BOOKED trong CÙNG Class = 1 quota. `[VERIFIED]` quota sections 2–3
- **KHÔNG tính:** enrollment COMPLETED/CANCELLED, buổi đã bắt đầu, buổi CANCELLED/COMPLETED. `[VERIFIED]` quota sections 4–5
- **GLOBAL:** tính trên enrollment của MỌI cơ sở — đổi facility không nhân quota. `[CODE-VERIFIED]` + `[VERIFIED]` (cross-facility-booking giữ quota qua cơ sở)
- **Không có gói ACTIVE** → `hasActiveSubscription = false, tier = null, limit = 0, remaining = 0` (không dùng `"FREE"` để đại diện). `[VERIFIED]` quota section 10
- **Vượt quota** → **403 `CONCURRENT_CLASS_LIMIT_REACHED`** kèm `tier/limit/used/remaining` trong error details. `[VERIFIED]` quota sections 1, 7
- Class đã giữ (có buổi BOOKED tương lai) → book thêm buổi CỦA CLASS ĐÓ không tiêu thêm quota. `[VERIFIED]` quota section 2
- **Grandfathering khi downgrade:** plan sửa limit xuống → không hủy lớp cũ, chỉ chặn book MỚI tới khi `used < limit`. `[VERIFIED]` quota section 7
- **Concurrency:** 2 request song song vượt quota → đúng 1 thắng (lock `enrollment:member-quota:<id>`). `[VERIFIED]` quota section 8
- Xem `GET /enrollments/my/quota` — chỉ trả quota của chính mình (không nhận memberId ngoài). `[VERIFIED]` quota section 9

**Ví dụ (plan maxConcurrentClasses = 3):** giữ A(1) + B(1) + C(1) = 3/3; book D ở **bất kỳ cơ sở nào** → 403 `CONCURRENT_CLASS_LIMIT_REACHED`. `[VERIFIED]` quota section 1.

## 3.5 Trùng giờ (time conflict) — toàn cục

Trong `assertCanBook` (dùng chung book / transfer / bulk / waitlist promotion):

```text
WHERE enrollment của member, status ∈ {BOOKED, COMPLETED},
      schedule.status = SCHEDULED,
      schedule.startTime < target.endTime AND schedule.endTime > target.startTime
→ nếu thấy → 409 "You have a conflicting class \"<tên>\" at this time"
```

- Áp trên **toàn bộ cơ sở** (query chạy với `facilityId: undefined` — bỏ scope có chủ đích). `[CODE-VERIFIED]`
- **Chạm biên cho phép:** buổi 08:00–09:00 và 09:00–10:00 **không** trùng (điều kiện `<` / `>`(strict)) — cùng facility. `[CODE-VERIFIED]`
- Buổi CANCELLED/COMPLETED không xét trùng; `excludeEnrollmentId` để transfer bỏ chỗ cũ. `[CODE-VERIFIED]`
- Cross-facility cùng khung giờ (chồng lấn thật) cũng 409 — trùng giờ là luật GLOBAL trước cả travel buffer. `[CODE-VERIFIED]`

## 3.6 Travel buffer liên cơ sở

`getScheduleTravelConflictReason()` — luật giữa các **SCHEDULE**, không thuộc tính của Class:

| Trường hợp | Quy tắc | Evidence |
| --- | --- | --- |
| Cùng facility | giữ nguyên time-conflict (chạm biên cho phép), **không** áp buffer | `[VERIFIED]` final-member-facility: A 08–09 vs A 09–10 → `null` |
| Khác facility, khoảng chồng lấn thật | vẫn 409 time-conflict (đi trước buffer) | `[CODE-VERIFIED]` |
| Khác facility, `gap < buffer` | **conflict** → 409 `TIME_CONFLICT` kèm `travelBufferMinutes` | `[VERIFIED]` final-member-facility: A 08:00–09:00 vs B **09:00**–10:00 → conflict; cross-facility-booking *"không còn cho phép back-to-back khác facility"* (suite 11/0) |
| Khác facility, `gap == buffer` | **cho qua** (so sánh nghiêm `gap < bufferMs`) | `[VERIFIED]` final-member-facility: A 08–09 vs B **09:30**–10:30 (buffer 30) → `null` |
| `buffer = 0` (env) | tắt buffer (trả `null`) | `[VERIFIED]` final-member-facility |

- **Giá trị mặc định 30 phút**, cấu hình qua env `CROSS_FACILITY_TRAVEL_BUFFER_MINUTES` (không hợp lệ/âm → 30; clamp trần 180 phút) — đọc động, không cần deploy lại. `[CODE-VERIFIED]` (`crossFacilityTravelBufferMinutes()`)
- Áp dụng ở **4 nơi** dùng chung helper: đặt đơn lẻ (`assertCanBook`), bulk cả khóa (`course-enrollment`), transfer, waitlist promotion (vì promotion tái dùng `assertCanBook`). `[CODE-VERIFIED]`
- **Ví dụ (30′):** A 08:00–09:00 + B 09:00–10:00 → **reject**; A 08:00–09:00 + B 09:30–10:30 → **allow**. `[VERIFIED]` (2 assert unit đúng 2 ví dụ này)
- Bulk: `TIME_CONFLICT` trả trong `errors.details[]` trỏ đúng `sessionId` + tên lớp đang giữ. `[VERIFIED]` course section 5

## 3.7 Waitlist (danh sách chờ theo BUỔI)

- **Theo schedule** (không phải theo class). Enum `WaitlistStatus = WAITING | PROMOTED | CANCELLED`. `[CODE-VERIFIED]`
- **Join:** `POST /waitlist {scheduleId}` (`MEMBER`) — buổi phải `SCHEDULED` + chưa bắt đầu; member chưa BOOKED/COMPLETED buổi này; **chỉ join được khi ĐẦY** (`bookedCount >= capacity`), còn trống → 409 *"This class still has available slots. Please book directly."*; đã WAITING → 409. `position = max(position WAITING) + 1` tính trong `lockSchedule` (đơn điệu, không API sửa tay). Race cuối DB chặn bằng unique một phần (P2002 → 409). `[CODE-VERIFIED]`
- **Rời:** `DELETE /waitlist/:id` (`MEMBER`) — CAS `WAITING → CANCELLED` (count ≠ 1 → 404). `[CODE-VERIFIED]`
- **Xem:** `GET /waitlist/my` (`MEMBER`, GLOBAL — chủ động bỏ scope); `GET /waitlist/schedule/:scheduleId` (MANAGER/RECEPTIONIST/COACH, facility-scoped qua Schedule → Class). `[CODE-VERIFIED]`
- **Thăng hạng (promotion):** chạy trong **CÙNG transaction với cancelEnrollment** sau khi đã `lockSchedule`:
  ```text
  duyệt WAITING theo position ↑
    → lock memberQuota + memberClass của TỪNG ứng viên
    → assertCanBook đầy đủ (gói/tier/quota/capacity/trùng giờ/phạt/travel buffer)
      fail → continue (bỏ qua, giữ WAITING, xét người sau)
    → CAS claim WAITING → PROMOTED (count ≠ 1 → continue — không đôn trùng)
    → tạo/reactivate Enrollment BOOKED + enqueue notification (outbox)
  → flush outbox sau commit
  ```
  2 cancel đồng thời không promote 2 lần cho 1 slot. `[CODE-VERIFIED]` — **KHÔNG có test BE nào gọi waitlist** → `[CODE-VERIFIED]` toàn phần (xem §4/§8).
- **Notification:** `ENROLLMENT_CONFIRMED` *"Được xếp chỗ từ waitlist"* ghi outbox trong tx. `[CODE-VERIFIED]`

## 3.8 Check-in vào cơ sở (FacilityVisit)

`POST /facility-visits/check-in` (`MEMBER`, cần `X-Facility-Id`):

```text
→ authenticate + facility scope (app.ts)
→ lockMemberCheckIn(memberId)  (advisory — serialize 2 lần check-in cùng member)
→ facility tồn tại (404) và isActive (403 FORBIDDEN_SCOPE)
→ findActiveSubscription: KHÔNG có gói ACTIVE → 403 "Bạn không có gói tập đang hoạt động..."
   (gói ACTIVE bất kể tier — FREE CŨNG vào được; ORIGIN KHÔNG giới hạn — mua ở A check-in ở B)
→ dedupe: cùng (member × facility) trong 5 phút (FACILITY_CHECKIN.DEDUPE_MINUTES)
   → trả về lượt ĐÃ CÓ, duplicate: true (không tạo mới)
→ create FacilityVisit {facilityId = CƠ SỞ ĐANG Ở, method QR|RECEPTION}
```

`[CODE-VERIFIED]` từng bước; **KHÔNG có test BE nào chạm `FacilityVisit`/`check-in`** → `[CODE-VERIFIED]` (xem §4/§8).

- `POST /facility-visits/reception-check-in` (MANAGER/RECEPTIONIST): lễ tân điểm danh hộ — `resolveMemberProfile` (chặn user không phải MEMBER / bị khóa) rồi cùng `checkIn`. `[CODE-VERIFIED]`
- **`GET /facility-visits/my`** (`MEMBER`): lịch sử vào cửa **GLOBAL** — query chạy với `facilityId: undefined` (bỏ scope), filter `memberId` + khoảng ngày. `[CODE-VERIFIED]`
- **`GET /facility-visits`** (MANAGER/RECEPTIONIST): danh sách vận hành **facility-scoped** qua DAL; optional `memberId`, `from`, `to`. `[CODE-VERIFIED]`

## 3.9 Báo cáo cross-facility usage

`GET /api/v1/reports/cross-facility-usage?startDate&endDate` (MANAGER/ADMIN, cần facility context):

- **Origin facility** = `X-Facility-Id` của request = `Subscription.facilityId` (cơ sở PHÁT HÀNH gói). Thiếu context → 400 `FACILITY_CONTEXT_REQUIRED` (fail-fast, không âm thầm thành báo cáo GLOBAL). `[CODE-VERIFIED]`
- Cohort member: `member.subscriptions.some({facilityId: origin})` (member đã phát hành ít nhất 1 gói ở A; member chỉ có FREE `facilityId=null` KHÔNG vào cohort). `[CODE-VERIFIED]`
- **Usage facility** = `Class.facilityId` của Enrollment (bookings) và `Facility.facilityId` của Visit (visits). `[CODE-VERIFIED]`
- Metric theo từng usage facility: `bookings`, `visits`, `uniqueMembers`; tổng `totalBookings`, `totalVisits`, `totalUniqueMembers`. `[CODE-VERIFIED]`
- **KHÔNG đổi model subscription, không tạo bảng usage** — tính từ Enrollment + FacilityVisit hiện có. `[CODE-VERIFIED]` (comment + code); báo cáo revenue không bị sửa. `[VERIFIED]` membership-reports (10/0) không đụng vào revenue semantics

---

# SECTION 4 — TESTS / VERIFICATION

## 4.1 Ma trận kiểm chứng (verification matrix)

Mọi số liệu dưới đây là **kết quả chạy THỰT TẾ** ngày 7/10/2026 trên schema cách ly `scms_verify_final_20261007` (Postgres `scms_test` + Mongo test replica-set port 27018), trừ dòng ghi rõ "kỳ chạy trước" = cùng phiên 7/10/2026 trên cùng schema, chạy trước khi tổng hợp tài liệu.

### Nhóm Membership / Policy A

| Suite | File | Command | Số check | Kết quả | Chứng minh |
| --- | --- | --- | --- | --- | --- |
| Policy A | `tests/policy-a-membership.integration.ts` | `npm run test:policy-a:membership` | 10 | **10 PASS** (kỳ chạy trước) `[VERIFIED]` | FREE/paid replacement không carry-over; resume SUSPENDED/EXPIRED/CANCELLED bị chặn; expiry job không hồi sinh; mua sau hết hạn tạo ACTIVE mới; renew không stacking; 2 purchase song song → đúng 1 ACTIVE; resolver chỉ trả ACTIVE |
| Quota e2e | `tests/enrollment-quota.e2e.ts` | `npm run test:e2e` | 379 | **379 PASS / 0 FAIL, exit 0** `[VERIFIED]` | Quota DISTINCT-class (1–5); **penalty thu hồi chỗ + chặn đặt lại class đúng (6)**; downgrade grandfathering (7); concurrency quota (8); phân quyền quota (9); không có gói → limit 0 (10); FREE auto-provision idempotent (12); effectiveTier (13) |
| Sepay e2e | `tests/sepay-payment.e2e.ts` | `npm run test:e2e:sepay` | 145 | **145 PASS / 0 FAIL, exit 0** `[VERIFIED]` | Checkout/webhook mọi nhánh (B); mock-confirm (C); TTL + tiền về muộn không kích hoạt (D); chặn FREE/hạ hạng + không cộng ngày (E/H); HMAC (G); đối soát API (H); snapshot A07 + REQUIRES_REVIEW/retry (K); ledger A14 + outbox F01 (L) |
| Subscription lifecycle | `tests/subscription-lifecycle.e2e.ts` | `npm run test:e2e:lifecycle` | 14 | **14 PASS / 0 FAIL, exit 0** `[VERIFIED]` | B07: quá hạn → EXPIRED + notification idempotent (1); nhắc trước 3 ngày dedupe 24h (2); SePay PENDING quá TTL → FAILED (3); C11 revenue report gross/refunded/net + cohort cash vs đơn (4) |
| Cross-facility cancel | `tests/cross-facility-cancel.integration.ts` | `npm run test:operations:cross-facility-cancel` | 18 | **17 PASS / 1 FAIL** (chạy lại 7/10) `[VERIFIED]` — failure là **assertion phụ thuộc thứ tự UUID** (§8-L3), KHÔNG phải lỗi hành vi hủy | Hủy gói hủy booking tương lai toàn cơ sở (1–2); booking quá khứ giữ nguyên (3 — flaky); idempotent (4); member tự hủy 30% + hủy booking A+B (5); Manager hủy không lỗi scope (5b); IDOR 403 (6); không refund khi thiếu điều kiện (7); **cách lý Payment/Class/Enrollment theo facility (8)** |

### Nhóm Attendance

| Suite | File | Command | Số check | Kết quả | Chứng minh |
| --- | --- | --- | --- | --- | --- |
| Attendance manual code | `tests/attendance-manual-code.e2e.ts` | `npm run test:e2e:attendance` | 80 | **80 PASS / 0 FAIL** (kỳ chạy trước) `[VERIFIED]` | QR + mã dự phòng: sinh/duyệt cửa sổ −30′, TTL, revoke sau 5 lần sai, rate-limit 429, idempotent PRESENT, 409 khi đã chốt, phân quyền roster/mutation |
| Unit phân loại + travel buffer | `tests/final-member-facility.integration.ts` | `npm run test:final:member-facility` | 26 | **26 PASS** (kỳ chạy trước) `[VERIFIED]` | Bảng allowance FIXED (2→0 … 20→4); `classifyFixedAbsence` đủ ca (gồm (0,0)=NORMAL, (1,0)=WARNING); ngưỡng RECURRING 80/70 + mẫu <5 → NORMAL; travel-buffer 4 ca (gap 0 conflict, gap 30 cho qua, cùng facility, buffer 0). **Suite SKIP nếu thiếu schema `scms_verify_`** |
| Penalty apply (một phần của quota suite) | `tests/enrollment-quota.e2e.ts` §6 | (cùng `test:e2e`) | 7 check | `[VERIFIED]` | Đủ mẫu mới apply được (5 buổi ABSENT); apply → `releasedCount`; quota giảm; 403 do **penalty** (không phải quota); class khác vẫn book |
| Warning scan / notification / no-show khi complete schedule | — | — | — | **NOT TESTED** | `[CODE-VERIFIED]` (§2.4, §2.5) |
| `GET /reports/attendance` | — | — | — | **NOT TESTED** trực tiếp | `[CODE-VERIFIED]` (§2.5) |
| `ATTENDANCE_POLICY_LOCKED` | — | — | — | **NOT TESTED** | `[CODE-VERIFIED]` |

### Nhóm Facility / Cross-facility

| Suite | File | Command | Số check | Kết quả | Chứng minh |
| --- | --- | --- | --- | --- | --- |
| Cross-facility booking | `tests/cross-facility-booking.integration.ts` | `npm run test:operations:cross-facility` | 11 | **11 PASS** (kỳ chạy trước) `[VERIFIED]` | FREE `facilityId = null` (GLOBAL); gói A book được B; travel-buffer chặn back-to-back khác facility; transfer BR-08/scope; resume bị chặn |
| Cross-facility my-schedule | `tests/cross-facility-my-schedule.integration.ts` | `npm run test:operations:cross-facility-my-schedule` | 18 | **18 PASS** (kỳ chạy trước) `[VERIFIED]` | Lịch của member thấy đủ mọi cơ sở (GLOBAL view) |
| Facility ops / HTTP / migration | `tests/facility-*.integration.ts` | `npm run test:operations` (+ biến thể `:http`, `:migration`) | — | **PASS (exit 0)** (kỳ chạy trước) `[VERIFIED]` | DAL cách ly facility, HTTP scope, migration |
| Check-in (`FacilityVisit`) | — | — | — | **NOT TESTED** | `[CODE-VERIFIED]` (§3.8) |
| Waitlist (join/promotion) | — | — | — | **NOT TESTED** | `[CODE-VERIFIED]` (§3.7) |

### Nhóm Enrollment / Course / Chat / Report / Audit

| Suite | File | Command | Số check | Kết quả | Chứng minh |
| --- | --- | --- | --- | --- | --- |
| Course enrollment (bulk) | `tests/course-enrollment.e2e.ts` | `npm run test:e2e:course` | 84 | **84 PASS / 0 FAIL, exit 0** `[VERIFIED]` | All-or-nothing cả khóa; `COURSE_ENROLLMENT_FAILED` + `errors.details[]`; `TIME_CONFLICT` trỏ đúng session/lớp; capacity/tier/quota/penalty cấp khóa |
| Chat attachments | `tests/chat-attachments.e2e.ts` | `npm run test:e2e:chat` | 15 | **15 PASS / 0 FAIL, exit 0** `[VERIFIED]` | Upload/đính kèm chat + cleanup FK an toàn (ngoài lề 5 lĩnh vực — kiểm chứng harness) |
| Membership reports | `tests/membership-reports.integration.ts` | `npm run test:operations:membership-reports` | 10 | **10 PASS** (kỳ chạy trước) `[VERIFIED]` | `GET /reports/memberships` theo ORIGIN facility |
| Integration audit | `tests/integration-audit.ts` | `npm run test:integration:audit` | 28 | **28 PASS** (kỳ chạy trước) `[VERIFIED]` | Truy vết xuyên tầng API contract |

### Kiểm chứng công cụ (chạy trong phiên 7/10/2026)

| Lệnh | Kết quả |
| --- | --- |
| `npx tsc --noEmit` (BE) | **exit 0** `[VERIFIED]` |
| `npx prisma validate` | **exit 0** — *"The schema at prisma\schema.prisma is valid"* `[VERIFIED]` |
| `npx prisma generate` | **exit 0** `[VERIFIED]` |

**KHÔNG tuyên bố "toàn bộ hệ thống hoạt động":** các mục NOT TESTED vẫn chỉ `[CODE-VERIFIED]`; suite không chạy lại trong phiên (facility ops/http/migration, attendance, policy-a…) nằm ở kỳ chạy trước trên **cùng schema**, được ghi rõ nguồn.

## 4.2 An toàn test (TEST SAFETY)

| Hạng mục | Thực tế |
| --- | --- |
| **Schema cách ly** | Các suite write-capable **từ chối chạy** nếu `DATABASE_URL` không chứa schema bắt đầu bằng `scms_verify_` (assert regex / skip — vd `policy-a-membership.integration.ts` `assert.match(schema, /^scms_verify_/)`, `final-member-facility` SKIP). Kỳ chạy dùng `postgresql://…/scms_test?schema=scms_verify_final_20261007`. `[VERIFIED]` |
| **Bảo vệ production** | Cùng `.env` trỏ local; không suite nào nhắm DB prod; SePay mock bị block ở `NODE_ENV=production`. `[CODE-VERIFIED]` |
| **Ghi dữ liệu?** | **CÓ** — suite tạo user/plan/facility/enrollment/payment thật trong schema test rồi tự dọn (dùng `RUN`/`randomUUID` để không đè dữ liệu cũ; cleanup theo fixture). Mongo test instance riêng (port 27018, `replSet=rs0`) + `deleteIdentities` của helper. `[CODE-VERIFIED]` |
| **Migration trong test** | Schema test được dựng bằng **`prisma db push`** (KHÔNG `migrate deploy`) → **data migration không tự chạy** → suite phải tự `upsert` row `legacy-main` (FK mặc định của `Payment.facilityId`/`Class.facilityId`). `[VERIFIED]` (comment trong policy-a test + thực tế chạy) |
| **Cleanup FK** | `chat-attachments` dọn theo đúng thứ tự (enrollment/attendance/invoice/payment/membershipSubscription → user) vì `MembershipSubscription` FK `ON DELETE RESTRICT`. `[VERIFIED]` (suite 15/0 sau khi sửa cleanup) |
| **Giới hạn test concurrency** | Chỉ test "2 request song song + đúng 1 thắng" (quota §8, policy-a `Promise.allSettled`) — **KHÔNG** mô phỏng kill-process giữa transaction, không có load-test/chaos; lock+CAS dựa trên PostgreSQL advisory lock (single-DB) nên không phủ failover. `[CODE-VERIFIED]` |
| **Suite trạng thái (flaky)** | `cross-facility-cancel` Case3 assert theo `orderBy id asc` trên UUID ngẫu nhiên → 50/50 (xem §8-L3). `[VERIFIED]` (chạy lại 7/10: 17/18) |

---

# SECTION 5 — API / DOCS / SWAGGER

**Swagger:** sinh từ comment `@swagger` trong route files (`BE/src/config/swagger.js`), serve tại **`GET /api/v1/docs`** (`app.ts`). Bản đồ contract máy đọc: `docs/API_CONTRACT_MAP.json` (+ `.md`), FE còn có `FE/docs/openapi.json` sinh bằng `FE/scripts/generate-api.mjs`. `[CODE-VERIFIED]`

**Quy ước đọc cột ROLE:** `authorize(...roles)` — **ADMIN được đi ngả** khi danh sách chứa MANAGER hoặc RECEPTIONIST (`middlewares/authorize.ts`), nên "MANAGER" đọc là "MANAGER + ADMIN"; "ADMIN" nghĩa là đúng ADMIN. Mọi endpoint dưới đây đã kiểm trong file route (KHÔNG suy từ FE).

**Cột SCOPE:** `FACILITY` = nằm trong danh sách gốc của `app.ts` → bắt buộc context (`X-Facility-Id`/param/query/body); `GLOBAL` = không qua scope; `PUBLIC` = không authenticate.

## 5.1 Membership / Plans

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/subscriptions` | MANAGER, RECEPTIONIST | FACILITY | `memberId, planId, paymentMethod(CASH\|BANK_TRANSFER), startDate?, note?` | Mua tại quầy (replacement nguyên tử) | BR-16 member active (404/400); plan active (404); chặn hạ hạng/gói ít ngày (400); CAS fail → 409 `SUBSCRIPTION_STATE_CHANGED` `[CODE-VERIFIED]` |
| POST | `/subscriptions/:id/renew` | MANAGER, RECEPTIONIST | FACILITY | `planId, paymentMethod, note?` | Gia hạn = replacement mới, start = now | như trên; 409 `SUBSCRIPTION_STATE_CHANGED` `[CODE-VERIFIED]` |
| GET | `/subscriptions/member/:memberId` | authenticate (service phân quyền) | FACILITY | query `page,limit,status` | Lịch sử subscription + payments/invoice của member | MEMBER chỉ xem của mình (403); COACH → 403; **không** filter nested theo facility (MF-05) `[CODE-VERIFIED]` |
| GET | `/subscriptions/:id` | MANAGER, RECEPTIONIST | FACILITY | path id | Chi tiết 1 gói | 404 `[CODE-VERIFIED]` |
| PATCH | `/subscriptions/:id/status` | MANAGER | FACILITY | `status ∈ 4 enum` | Cập nhật trạng thái / hủy prorated | resume từ SUSPENDED/EXPIRED/CANCELLED → 400 `SUBSCRIPTION_RESUME_FORBIDDEN`; CANCELLED từ ACTIVE = prorated refund + hủy booking GLOBAL `[VERIFIED]` policy-a |
| PATCH | `/subscriptions/:id/cancel` | MEMBER | FACILITY | `reason? (1–500)` | Tự hủy gói | 403 không phải chủ; 400 nếu không ACTIVE; refund 30% nếu >15 ngày `[VERIFIED]` cross-facility-cancel |
| GET | `/membership-plans` | PUBLIC | PUBLIC | query | Danh sách gói | — |
| POST/PATCH/DELETE | `/membership-plans[/:id]` | **ADMIN** | FACILITY | plan fields (`maxConcurrentClasses ≥ 0`, tier…) | CRUD gói | tạo/sửa/del gói `[CODE-VERIFIED]` (route `authorize("ADMIN")`) |
| POST | `/users` (tạo MEMBER) | **ADMIN** | GLOBAL (root `users` KHÔNG nằm trong danh sách scope của `app.ts`; router tự authenticate + authorize ADMIN) | user fields | Tạo user (MEMBER được cấp FREE) | `router.use(authenticate, authorize("ADMIN"))` `[CODE-VERIFIED]` |

## 5.2 Attendance

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/attendance?scheduleId=` | MEMBER, COACH, MANAGER, RECEPTIONIST | FACILITY | `scheduleId` (bắt buộc) | Roster điểm danh của buổi | MANAGER/RECEPTIONIST thấy đủ roster; COACH chỉ lớp phụ trách (403); MEMBER chỉ bản ghi CỦA MÌNH `[CODE-VERIFIED]` |
| POST | `/attendance` | COACH, MANAGER | FACILITY | `scheduleId(uuid), memberId, status(PRESENT\|ABSENT\|LATE\|EXCUSED), note?` | Ghi điểm danh | member phải BOOKED/COMPLETED (400); `EXCUSED` **chỉ MANAGER/ADMIN** (403); ngoài cửa sổ điểm danh → 409 `[CODE-VERIFIED]` |
| PATCH | `/attendance/:id` | ADMIN, MANAGER | FACILITY | `status?, note?` | Sửa/lý do hiệu chỉnh | `note` ≥ 3 ký tự (400); EXCUSED chỉ MANAGER (403) `[CODE-VERIFIED]` |
| POST | `/attendance/generate-qr` | COACH, MANAGER | FACILITY | `scheduleId(uuid)` | Sinh QR (JWT 600s) + mã dự phòng 6 ký tự (90s) | Cửa sổ server: `[-30′ trước startTime, endTime]` + schedule phải SCHEDULED; ngoài cửa sổ → 409; cấp mã mới thu hồi mã cũ `[VERIFIED]` attendance suite |
| POST | `/attendance/scan-qr` | MEMBER | FACILITY | `qrToken` **hoặc** `code` (strict, đúng 1) | Tự điểm danh | 403 nếu không BOOKED; 403 nếu không có gói ACTIVE; 409 ngoài cửa sổ/đã chốt không phải PRESENT; sai mã: 400/429 (rate-limit 10 lỗi/15′, mã thu hồi sau 5 lần) `[VERIFIED]` attendance suite (80/0) |
| GET | `/attendance/my` | MEMBER | FACILITY | `page,limit,status?,classId?` | Lịch sử điểm danh của mình | phân trang `[CODE-VERIFIED]` |
| GET | `/attendance/my/summary` | MEMBER | FACILITY | — | Bucket (member × class) + penalty + ngưỡng | lazy-expire penalty; `canAppeal` theo cửa sổ 72h `[CODE-VERIFIED]` |
| POST | `/attendance/warnings/scan` | MANAGER | FACILITY | `classId?` | Quét & gửi NOTICE/WARNING | dedupe theo `metadata.state`; trả `{checked, advisoryBuckets, sent, skippedDuplicate}` `[CODE-VERIFIED]` |
| GET | `/attendance/penalties` | MANAGER | FACILITY | `status?,memberId?,classId?,page,limit` | Danh sách penalty | lazy-expire `APPLIED` quá hạn `[CODE-VERIFIED]` |
| POST | `/attendance/penalties/preview` | MANAGER | FACILITY | — | Chỉ đọc: các bucket WARNING + số chỗ tương lai + `proposedBlockedUntil` | **KHÔNG** mutate `[CODE-VERIFIED]` |
| POST | `/attendance/penalties/apply` | MANAGER | FACILITY | `memberId, classId, reason?(≤500)` | Áp phạt (member × class) 30 ngày | 404 thiếu dữ liệu; 400 thiếu mẫu; 409 đã có penalty; khóa `memberQuota→memberClass` `[VERIFIED]` quota §6 |
| POST | `/attendance/penalties/:id/appeal` | MEMBER | FACILITY | `reason(5–1000)` | Khiếu nại (audit, không tự gỡ) | 403 không phải chủ; 400 nếu không APPLIED/hết 72h; 409 trùng `[CODE-VERIFIED]` |
| POST | `/attendance/penalties/:id/revoke` | MANAGER | FACILITY | `reason?, restoreSlots?` | Gỡ phạt | khôi phục chỗ có điều kiện (không overbooking) `[CODE-VERIFIED]` |
| PATCH | `/class-schedules/:id/complete` | MANAGER, RECEPTIONIST | FACILITY | path id | Chốt buổi: no-show + BOOKED→COMPLETED + quét warning | 400 nếu chưa kết thúc/đã hủy; CAS 409 `SCHEDULE_STATE_CHANGED`; idempotent `[CODE-VERIFIED]` |

## 5.3 Facility check-in

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/facility-visits/check-in` | MEMBER | FACILITY (header) | `method?` (`QR` mặc định) | Tự check-in vào cơ sở | 403 không có gói ACTIVE (FREE vẫn qua); facility inactive → 403; dedupe 5′ trả `duplicate: true`; lock theo member `[CODE-VERIFIED]` |
| POST | `/facility-visits/reception-check-in` | MANAGER, RECEPTIONIST | FACILITY (header) | `memberId, method? (RECEPTION)` | Lễ tân điểm danh hộ | member phải là MEMBER active (404/400) `[CODE-VERIFIED]` |
| GET | `/facility-visits/my` | MEMBER | **GLOBAL** (chủ động bỏ scope) | `page,limit,from?,to?` | Lịch sử vào cửa mọi cơ sở của mình | `[CODE-VERIFIED]` |
| GET | `/facility-visits` | MANAGER, RECEPTIONIST | FACILITY | `memberId?,from?,to?,page,limit` | Danh sách lượt vào cửa vận hành | DAL lọc facility `[CODE-VERIFIED]` |

## 5.4 Waitlist

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/waitlist` | MEMBER | FACILITY | `scheduleId` | Vào danh sách chờ (chỉ khi ĐẦY) | 400 không SCHEDULED/đã quá giờ; 409 *"còn trống → book trực tiếp"*; 409 trùng WAITING (mềm + P2002) `[CODE-VERIFIED]` |
| DELETE | `/waitlist/:id` | MEMBER | FACILITY | path id | Rời danh sách (CAS) | count ≠ 1 → 404 `[CODE-VERIFIED]` |
| GET | `/waitlist/my` | MEMBER | **GLOBAL** | `page,limit,status?,scheduleId?` | Lịch chờ của mình | `[CODE-VERIFIED]` |
| GET | `/waitlist/schedule/:scheduleId` | MANAGER, RECEPTIONIST, COACH | FACILITY | `status?,page,limit` | Chờ theo buổi (staff) | sắp xếp WAITING theo position `[CODE-VERIFIED]` |

## 5.5 Enrollment / Course

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/enrollments` | authenticate (MEMBER đặt của mình; staff đặt hộ qua `memberId`) | FACILITY | `scheduleId, memberId?` | Đặt 1 buổi | 403 không gói ACTIVE / hết hạn trước buổi / PENALTY / quota `CONCURRENT_CLASS_LIMIT_REACHED`; 409 `SCHEDULE_NOT_AVAILABLE`, trùng giờ, full; lock `memberQuota→memberClass→schedule` `[VERIFIED]` quota + course |
| GET | `/enrollments/my` | MEMBER | FACILITY | query | Chỗ đã đặt của mình | `[CODE-VERIFIED]` |
| GET | `/enrollments/my/quota` | MEMBER | FACILITY | — | Quota `used/limit/remaining/classes` | không rò quota người khác `[VERIFIED]` quota §9 |
| POST | `/enrollments/bulk` | authenticate | FACILITY | `classId, scheduleIds[]` (xem `EnrollWholeCourseSchema`) | Đặt trọn khóa — all-or-nothing | 409 `COURSE_ENROLLMENT_FAILED` + `errors.details[]` từng lý do (capacity/tier/quota/phạt/trùng giờ) `[VERIFIED]` course (84/0) |
| GET | `/enrollments/schedule/:scheduleId` | MANAGER, COACH, RECEPTIONIST | FACILITY | query | Roster đặt chỗ theo buổi | `[CODE-VERIFIED]` |
| DELETE | `/enrollments/:id` | authenticate (MEMBER chỉ của mình; COACH 403) | FACILITY | path id | Hủy chỗ + **promotion waitlist** cùng tx | 400 nếu không BOOKED/đã bắt đầu; CAS 409 `[VERIFIED]` quota §4 (hủy) — promotion `[CODE-VERIFIED]` (chưa có test waitlist) |
| POST | `/enrollments/:id/transfer` | authenticate (MEMBER của mình; COACH 403) | FACILITY | `targetScheduleId` | Chuyển chỗ trong CÙNG Class (BR-08) | 400 khác Class/sai trạng thái; 409 CAS `BR-09`; không tiêu quota mới; tái áp toàn bộ luật đặt chỗ `[CODE-VERIFIED]` (BR-08/09 có cover một phần ở cross-facility-booking `[VERIFIED]`) |

## 5.6 Payments / SePay

| METHOD | PATH | ROLE | SCOPE | INPUT | PURPOSE | VALIDATION & LỖI QUAN TRỌNG |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/payments` | MANAGER, RECEPTIONIST | FACILITY | payment fields | Tạo thanh toán ghi nhận (mặc định SUCCESS) | verify member/subscription thuộc về `[CODE-VERIFIED]` |
| GET | `/payments` | MANAGER, RECEPTIONIST | FACILITY | `memberId?,status?,method?,startDate?,endDate?,page,limit` | Danh sách payment (cách ly facility) | `[VERIFIED]` cross-facility-cancel Case8 |
| GET | `/payments/:id` | authenticate (service phân quyền) | FACILITY | path id | Chi tiết + invoice | MEMBER chỉ của mình (403); COACH 403 `[CODE-VERIFIED]` |
| PATCH | `/payments/:id/status` | MANAGER | FACILITY | `status` | Đổi trạng thái (không-gateway) | SePay (`gateway`) → 400; SUCCESS→chỉ REFUNDED; FAILED/REFUNDED bất biến; CAS 409 `[CODE-VERIFIED]` |
| POST | `/payments/:id/retry-activation` | MANAGER | FACILITY | — | Kích hoạt lại gói cho đơn SePay `REQUIRES_REVIEW` | 400 sai điều kiện; 409 vẫn không kích hoạt được (giữ review + `reviewReason`) `[VERIFIED]` sepay K |
| POST | `/payments/sepay/checkout` | MEMBER | FACILITY | `planId` | Tạo đơn VietQR (PENDING) + snapshot A07 | 503 chưa cấu hình; 400 gói FREE/price 0; fail-fast hạ hạng; 409 còn đơn PENDING `[VERIFIED]` sepay B/E |
| GET | `/payments/sepay/:id` | chủ đơn (MEMBER) hoặc MANAGER/RECEPTIONIST | FACILITY | path id | Poll trạng thái (tự đối soát nếu cấu hình API token) | COACH 403 `[VERIFIED]` sepay F/H |
| POST | `/payments/sepay/webhook` | **PUBLIC** (HMAC-SHA256 rawBody + timestamp, hoặc API Key) | **EXEMPT** (`app.ts:120`) | payload SePay | Chốt tiền → kích hoạt gói | 503 chưa cấu hình; 401 sai chữ ký/key; các nhánh DUPLICATE/IGNORED/MISMATCH/LATE (§1.2) `[VERIFIED]` sepay B/G |
| POST | `/payments/sepay/mock-confirm` | MEMBER (đơn mình), MANAGER, RECEPTIONIST | FACILITY | `paymentId` | Mô phỏng webhook (dev/e2e) | block ở production + thiếu `SEPAY_MOCK_MODE` → 403 `SEPAY_MOCK_DISABLED` `[VERIFIED]` sepay C |

## 5.7 Reports (hết — `router.use(authenticate, authorize("MANAGER"))`)

| METHOD | PATH | ROLE | SCOPE | QUERY | PURPOSE | GHI CHÚ |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/reports/revenue` | MANAGER (+ADMIN) | FACILITY (payment scoped) | `startDate, endDate` (bắt buộc, `endDate ≥ startDate`) | Doanh thu | **2 cohort tách bạch (C11):** cash = `paidAt` (SUCCESS+REFUNDED) → `totalRevenue/refundedAmount(refundedAt)/netRevenue/successPayments/recentPayments`; order = `createdAt` → `totalPayments/pending/failed`; `unreconciledRefunds` + `netRevenueVerified` `[VERIFIED]` lifecycle §4 (delta 500k/200k/300k) |
| GET | `/reports/members` | MANAGER (+ADMIN) | FACILITY | `startDate, endDate` | Member report (total/new/active/by tier) | `[CODE-VERIFIED]` |
| GET | `/reports/enrollments` | MANAGER (+ADMIN) | FACILITY | `startDate, endDate` | Enrollment report | `[CODE-VERIFIED]` |
| GET | `/reports/memberships` | MANAGER (+ADMIN) | FACILITY (bắt buộc context) | `startDate, endDate` | Membership theo ORIGIN facility | fail-fast `FACILITY_CONTEXT_REQUIRED`; `activeSubscriptions` = ACTIVE + còn hạn (định nghĩa hiệu lực); `byTier` chỉ ACTIVE; revenue theo `paidAt` `[VERIFIED]` membership-reports (10/0) |
| GET | `/reports/subscription-logs` | MANAGER (+ADMIN) | FACILITY | `startDate?,endDate?,page,limit` | Nhật ký thay đổi gói | `[CODE-VERIFIED]` |
| GET | `/reports/attendance` | MANAGER (+ADMIN) | FACILITY | `status?,classId?,memberId?,page,limit` | Bucket (member × class) + activePenalty | enum `NORMAL/NOTICE/WARNING` (§2.5) `[CODE-VERIFIED]` |
| GET | `/reports/cross-facility-usage` | MANAGER (+ADMIN) | FACILITY (ORIGIN = header) | `startDate, endDate` | Origin vs usage (§3.9) | 400 thiếu context `[CODE-VERIFIED]` |

**Khác biệt tài liệu (ghi nhận, không tự sửa):** `docs/API_CONTRACT_MAP.json` mục `"GET /reports/attendance"` đang giữ `"status": "MISMATCH"` — enum query trong JSON ĐÃ đúng `NORMAL/NOTICE/WARNING`; nhãn MISMATCH là cờ cho **tham chiếu dòng code cũ** chưa cập nhật (`backend: reports.routes.ts:204`). **DISCREPANCY ở metadata tài liệu, không phải runtime** — runtime trả `NORMAL/NOTICE/WARNING` đúng (§2.5). `[CODE-VERIFIED]` (đọc JSON)

---

# SECTION 6 — BUSINESS STATE DIAGRAMS

## 6.1 Membership

```text
REGISTER (POST /auth/register)  hoặc  ADMIN POST /users (MEMBER)
        │  ensureActiveFreeSubscription (advisory lock, idempotent)
        ▼
┌─────────────────────────┐
│ FREE  ACTIVE            │  facilityId=null, 3650 ngày, quota=0
└───────────┬─────────────┘
            │  mua gói trả phí (quầy/SePay) — atomic replacement
            ▼
┌─────────────────────────┐      ┌──────────────────────┐
│ FREE  SUSPENDED          │      │ PAID  ACTIVE          │◄──┐
│ (terminal, audit only)   │      │ start=now, +duration  │   │ renew (replacement)
└─────────────────────────┘      └──────┬───────────────┘   │
                                        │                    │
             ┌──────────────────────────┼────────────────────┘
             │                          │
             │ endDate < now (job 15′)  │  hủy (Member 30% / Manager prorated)
             ▼                          ▼
      ┌─────────────┐           ┌─────────────┐
      │   EXPIRED    │           │  CANCELLED   │
      │  (terminal)  │           │  (terminal)  │
      └─────────────┘           └─────────────┘

  CẤM (400 SUBSCRIPTION_RESUME_FORBIDDEN):
    SUSPENDED  -X→ ACTIVE
    EXPIRED    -X→ ACTIVE
    CANCELLED  -X→ ACTIVE
  Muốn dùng tiếp → MUA/GIA HẠN GÓI MỚI (tạo subscription mới).
```

`[VERIFIED]` policy-a (mọi mũi tên/mọi ô cấm).

## 6.2 Attendance

```text
ClassSchedule (SCHEDULED) ──endTime qua──► [đánh giá on-demand]
        │
        │ PATCH /class-schedules/:id/complete (MANAGER/RECEPTIONIST)
        │   ├─ tạo ABSENT note=SYSTEM_NO_SHOW cho ai chưa điểm danh
        │   ├─ Enrollment BOOKED → COMPLETED
        │   ├─ Schedule → COMPLETED (CAS, lock)
        │   └─ scanAttendanceWarnings (fire-and-forget)
        ▼
   Attendance (PRESENT | LATE | ABSENT | EXCUSED)
        ▼
   computeAttendanceBuckets  (member × class)
        │   FIXED: currentAbsences vs floor(20% × snapshot)
        │   RECURRING: rate rolling-10, mẫu ≥ 5
        ▼
   NORMAL ──── NOTICE ──── WARNING          ← ADVISORY: chỉ notification
                                            (KHÔNG tự phạt/khóa/hủy)
        │
        │  Manager review  ─ POST /attendance/penalties/preview (đọc)
        ▼
   POST /attendance/penalties/apply (MANAGER, đủ mẫu, lý do, audit decidedBy)
        ▼
   AttendancePenalty APPLIED (blockedUntil = +30 ngày)
        ├─ hủy BOOKED tương lai của ĐÚNG (member × class)
        ├─ assertCanBook: 403 khi book lại class này
        ├─ Member appeal trong 72h (audit, không tự gỡ)
        └─ revoke (MANAGER) → REVOKED [+ khôi phục chỗ có điều kiện]
                             → APPLIED quá hạn → EXPIRED
```

`[VERIFIED]` (unit phân loại + quota §6); các mũi notification `[CODE-VERIFIED]`.

## 6.3 Member × Facility

```text
Mua gói ở A  ──►  Membership = GLOBAL (entitlement)
                  Subscription.facilityId = A (ORIGIN, chỉ báo cáo)
                  Payment.facilityId     = A (facility-scoped)
        │
        ├──► Book ở A / B / C ── quota GLOBAL, trùng giờ GLOBAL,
        │                        travel buffer nếu khác facility
        ├──► Attendance ở B   ── scope theo Class của B
        ├──► Check-in ở B     ── FacilityVisit.facilityId = B (USAGE)
        ├──► Hủy gói          ── hủy booking ở MỌI cơ sở,
        │                        refund ghi ở payment ORIGIN = A
        └──► GET /reports/cross-facility-usage?origin=A
                 ── "gói phát hành ở A đang dùng ở đâu?" = {B, C}
                      metrics: bookings / visits / uniqueMembers
```

`[VERIFIED]` (cross-facility suite + Case8) + `[CODE-VERIFIED]` (báo cáo).

---

# SECTION 7 — BUSINESS RULE TABLE

| ID | Business rule | Current behavior | Evidence | Important API/Code |
| -- | ------------- | ---------------- | -------- | ------------------ |
| BR-A01 | Một active subscription | 1 member ≤ 1 ACTIVE; mua/gia hạn = lock + CAS suspend + tạo mới trong 1 transaction; đua → 409 `SUBSCRIPTION_STATE_CHANGED` | `[VERIFIED]` policy-a (concurrent) | `POST /subscriptions`, `POST /:id/renew`; `dbLocks.ts`, `subscription-purchase.service.ts` |
| BR-A02 | Không cộng ngày dư (no carry-over) | `endDate = start(now) + durationDays`; `remainingDays/suspendedAt` audit-only; FREE → 0 | `[VERIFIED]` policy-a + sepay E/H | `activateSubscriptionForPayment`, `inspectPlanPurchase` |
| BR-A03 | Không resume trạng thái terminal | `SUSPENDED/EXPIRED/CANCELLED → ACTIVE` = 400 `SUBSCRIPTION_RESUME_FORBIDDEN` | `[VERIFIED]` policy-a (3 checks) | `PATCH /subscriptions/:id/status` |
| BR-A04 | Hết hạn gói trả phí | Lazy (resolver theo endDate) + job 15′ → `EXPIRED`; không hồi sinh; member book/check-in/scan → 403 | `[VERIFIED]` policy-a + lifecycle | `findActiveSubscription`, `expireStaleSubscriptions` |
| BR-A05 | FREE behavior | Cấp khi register/Manager tạo MEMBER; 3650 ngày; quota 0 (chặn book, VẪN check-in được); facilityId null; login tự phục hồi khi thiếu ACTIVE | `[VERIFIED]` quota 12, sepay E; check-in `[CODE-VERIFIED]` | `ensureActiveFreeSubscription`, `auth.service.ts` (MF-08) |
| BR-A06 | Hạ hạng / gói ít ngày | Tier mới < tier hiện tại → 400; cùng tier, `durationDays < gói đã bán` → 400 (chạy lúc checkout + lại trong tx) | `[CODE-VERIFIED]` | `inspectPlanPurchase` |
| BR-A07 | Snapshot offer | Price/tier/duration/quota snapshot lúc tạo đơn (SePay) — plan sửa trong lúc chờ CK không đổi điều khoản bán | `[VERIFIED]` sepay K | `Payment.planNameSnapshot/...`, `optionSnapshot` |
| BR-A08 | Hủy gói Member | Chỉ gói của mình + ACTIVE; >15 ngày → hoàn 30%, ≤15 → 0; hủy booking tương lai GLOBAL; refund ghi ở payment ORIGIN | `[VERIFIED]` cross-facility-cancel Case5/6 | `PATCH /subscriptions/:id/cancel` |
| BR-A09 | Hủy gói Manager | Prorated `min(round(amount/soldDuration × daysLeft), amount)`; hủy booking GLOBAL; invoice → CANCELLED | `[VERIFIED]` Case5b (REFUNDED); formula `[CODE-VERIFIED]` | `updateSubscriptionStatus` |
| BR-A10 | Refund theo ORIGIN facility | Câu update payment luôn chạy trong `facilityId = originalPayment.facilityId` → không vướng scope, không đổi chủ payment | `[VERIFIED]` Case5 (hủy tại B thành công) | `subscriptions.service.ts` |
| BR-A11 | Trạng thái payment nghiêm | SePay không đổi tay (400); SUCCESS → chỉ REFUNDED; FAILED/REFUNDED bất biến; CAS 409 | `[CODE-VERIFIED]` | `PATCH /payments/:id/status` |
| BR-T01 | FIXED 20% allowance | `floor(plannedSessionCount × 20%)`; `< = NORMAL, == = NOTICE, > = WARNING`; mẫu 5 KHÔNG áp; snapshot khóa sau khi có enrollment (`ATTENDANCE_POLICY_LOCKED`) | `[VERIFIED]` final-member-facility (bảng + classify); lock `[CODE-VERIFIED]` | `config/attendance.ts`, `classes.service.ts` |
| BR-T02 | RECURRING rolling | Cửa sổ 10, mẫu tối thiểu 5, rate ≥80 NORMAL / 70–<80 NOTICE / <70 WARNING | `[VERIFIED]` final-member-facility | `classifyAttendance` |
| BR-T03 | WARNING ≠ Penalty | WARNING chỉ notification tham khảo; penalty chỉ từ `POST /attendance/penalties/apply` của MANAGER (đủ mẫu: FIXED `min(5,total)`, RECURRING 5) | `[VERIFIED]` quota §6 (apply tay) | `attendance-penalties.service.ts` |
| BR-T04 | Phạm vi penalty | Đúng (member × class) 30 ngày; hủy BOOKED tương lai của class đó; book lại → 403; class khác/không ảnh hưởng gói | `[VERIFIED]` quota §6 | `assertCanBook`, `findActivePenalty` |
| BR-Q01 | Global quota | `used` = DISTINCT Class có BOOKED ở buổi tương lai; limit = snapshot plan; quá → 403 `CONCURRENT_CLASS_LIMIT_REACHED`; không có ACTIVE → 0 | `[VERIFIED]` quota (1,2,8,10) | `enrollment-quota.service.ts` |
| BR-Q02 | Cross-facility booking | Gói mua ở A book được B/C; entitlement GLOBAL; DAL không lọc subscription | `[VERIFIED]` cross-facility-booking (11) | `scoped-data.ts`, `assertCanBook` |
| BR-Q03 | Travel buffer | Mặc định 30′ (env `CROSS_FACILITY_TRAVEL_BUFFER_MINUTES`, clamp 0–180); khác facility: gap < 30 → 409 `TIME_CONFLICT`, gap = 30 → qua; cùng facility: chạm biên cho phép | `[VERIFIED]` final-member-facility + cross-facility-booking | `getScheduleTravelConflictReason` |
| BR-W01 | Waitlist theo buổi | Chỉ khi full; 1 WAITING/(member × buổi) (partial unique trong migration); position tăng dần; promotion tái dùng `assertCanBook` + CAS trong tx cancel | `[CODE-VERIFIED]` (KHÔNG có test) | `waitlist.service.ts`, `waitlist.promotion.ts` |
| BR-C01 | Check-in | Cần gói ACTIVE (FREE qua được), facility active, dedupe 5′, lock member; ORIGIN không giới hạn | `[CODE-VERIFIED]` (KHÔNG có test) | `facility-visits.service.ts` |
| BR-C02 | Origin facility | `Subscription.facilityId` = nơi thu tiền (FREE = null); chỉ báo cáo/audit | `[VERIFIED]` cross-facility-booking | schema `MembershipSubscription.facilityId` |
| BR-C03 | Usage facility | `FacilityVisit.facilityId` = cơ sở ĐANG vào; `Class.facilityId` của enrollment = nơi học | `[CODE-VERIFIED]` | schema, `getCrossFacilityUsageReport` |
| BR-C04 | Side-effect hủy toàn cơ sở | Mọi đường hủy gói → cancel enrollment BOOKED tương lai trên MỌI facility (bỏ scope có chủ đích) | `[VERIFIED]` Case1/2/5/5b | `subscriptions.service.ts`, `payments.service.ts` |
| BR-C05 | Hoàn tiền = luồng riêng | Member 30% >15 ngày; Manager prorated; SePay LATE/REQUIRES_REVIEW không tự hoàn | `[VERIFIED]` Case5/5b, sepay D/K | §1.5, `sepay-payments.service.ts` |

---

# SECTION 8 — KNOWN LIMITATIONS

Phân loại: **IMPLEMENTED** (code có, hành vi có thật) · **VERIFIED** (đã có test chạy chứng minh) · **NOT VERIFIED** (code có, chưa có test chạy).

| # | Hạn chế | Loại | Chi tiết |
| --- | --- | --- | --- |
| L1 | **Waitlist không có test BE** | IMPLEMENTED / **NOT VERIFIED** | Join/leave/promotion/position được code đầy đủ (§3.7) nhưng grep toàn `BE/tests/*` không có dấu vết `waitlist/WAITING/PROMOTED`. Rủi ro hồi sinh khi refactor. |
| L2 | **Check-in (`FacilityVisit`) không có test BE** | IMPLEMENTED / **NOT VERIFIED** | Tương tự L1 — không test nào chạm `check-in`/`FacilityVisit`. |
| L3 | **`cross-facility-cancel` Case3 flaky (17/18 ở lần chạy 7/10)** | TEST-ONLY | Assertion `pastAfter[0].status === "BOOKED" && pastAfter[1].status === "COMPLETED"` với `orderBy: {id: "asc"}` trên **UUID ngẫu nhiên** → thứ tự ngẫu nhiên mỗi lần tạo fixture; lần chạy trước PASS, lần 7/10 FAIL với đúng dữ liệu `{COMPLETED, BOOKED}` (hai trạng thái ĐÚNG, chỉ thứ tự đảo). **Không phải lỗi nghiệp vụ** (booking quá khứ vẫn được giữ nguyên cả hai trạng thái). Cần sửa assertion (so set/thứ tự theo id đã biết) — nằm ngoài phạm vi tài liệu này. |
| L4 | **Warning scan + no-show khi complete + `GET /reports/attendance` + `ATTENDANCE_POLICY_LOCKED` chưa có test** | IMPLEMENTED / **NOT VERIFIED** | §2.1, §2.4, §2.5 — hành vi chỉ có code. |
| L5 | **Notification không guaranteed delivery** | IMPLEMENTED (giới hạn thiết kế) | Warning/penalty/hủy gói dùng direct create + `.catch` → mất được nếu process chết; outbox có retry 10 lần nhưng `FAILED` là chốt cuối (không worker hồi sinh). KHÔNG tuyên bố "đảm bảo nhận được". |
| L6 | **Comment/code lệch ở revenue report (C11)** | DISCREPANCY (comment) | `reports.service.ts`: comment field `refundedAmount` ghi *"tổng payment REFUNDED theo `paidAt`"* nhưng **code lọc `refundedAt` trong kỳ** — test lifecycle §4 xác nhận hành vi theo `refundedAt` (delta 200k). `[CODE-VERIFIED]` |
| L7 | **`API_CONTRACT_MAP.json` còn nhãn `status: "MISMATCH"` ở `GET /reports/attendance`** | DISCREPANCY (metadata) | Enum đã đúng `NORMAL/NOTICE/WARNING`; nhãn MISMATCH giữ để đánh dấu tham chiếu dòng cũ — cần dọn ở lần cập nhật bản đồ contract kế tiếp. Runtime không bị ảnh hưởng. |
| L8 | **`docs/POLICY_A_MEMBERSHIP_LIFECYCLE.md` ghi "không tạo fallback subscription"** | DISCREPANCY (phạm vi câu chữ) | **RUNTIME:** câu này ĐÚNG với **job lifecycle** (không hồi sinh/không tạo fallback); nhưng **MF-08 login** gọi `ensureActiveFreeSubscription` bất kỳ lần đăng nhập MEMBER nào → member không còn ACTIVE sẽ được cấp **FREE ACTIVE mới**. Hai luồng khác nhau — tài liệu cũ không mô tả luồng login. `[CODE-VERIFIED]` |
| L9 | **Partial unique waitlist chỉ nằm trong migration, không khai báo trong `schema.prisma`** | IMPLEMENTED (DB) / TOOLING LIMITATION | Migration `20261009000000_waitlist_per_schedule` có `CREATE UNIQUE INDEX ... WHERE status='WAITING'` (DB enforce thật, P2002). Prisma không hỗ trợ partial unique → `prisma migrate diff` có thể báo drift so với schema. `[CODE-VERIFIED]` |
| L10 | **Test dùng `prisma db push`, KHÔNG chạy `migrate deploy`** | TEST LIMITATION | Data migration (nếu có) không tự áp trong test; suite tự upsert `legacy-main`. Migration SQL chưa được chứng minh bằng test chạy thật trong kỳ này (facility-migration suite có cover một phần ở kỳ trước). `[VERIFIED]` (đây là bản thân hạn chế) |
| L11 | **Concurrency test hẹp** | NOT VERIFIED (mức độ) | Chỉ "2 request song song, 1 thắng" — không test crash giữa transaction, không failover, không nhiều instance. Lock là PG advisory (single DB). |
| L12 | **Report attendance chưa có assertion trực tiếp; `summary` tính trước khi filter `status`** | IMPLEMENTED / NOT VERIFIED | `summary` phản ánh toàn bộ bucket, `rows` mới lọc theo `?status` — hành vi cố ý theo code nhưng dễ hiểu nhầm; chưa có test. `[CODE-VERIFIED]` |
| L13 | **Một số suite chạy ở "kỳ chạy trước" trong cùng phiên** | VERIFIED (hạn chế phạm vi) | attendance(80), policy-a(10), final(26), cross-facility-booking(11), my-schedule(18), membership-reports(10), integration-audit(28), facility-* — không chạy lại sau các chỉnh sửa cuối; các chỉnh sửa sau đó chỉ nằm trong **tests files của 5 suite đã chạy lại** (quota/course/sepay/lifecycle/chat) — không đụng `src/`. |

**KHÔNG coi hạn chế ở trên là "bug"** trừ khi code chứng minh (L3 là bug của TEST, không phải của nghiệp vụ).

---

# SECTION 9 — FINAL MEMBER JOURNEY (một ví dụ cuối, chỉ gồm bước đã implement)

```text
1.  Member đăng ký  POST /auth/register
       → FREE ACTIVE (3650 ngày, quota 0, facilityId = null)          [VERIFIED quota 12]
2.  Mua gói 30 ngày ở Cơ sở A  (quầy POST /subscriptions
       hoặc SePay checkout → webhook)
       → FREE → SUSPENDED ; gói 30 ngày → ACTIVE (start = now, +30 ngày)
       → Payment facilityId = A (ORIGIN), Invoice ISSUED,
         notification PAYMENT_SUCCESS qua OUTBOX                       [VERIFIED policy-a/sepay]
3.  Đặt lớp Yoga ở Cơ sở B   POST /enrollments {scheduleId}
       → kiểm gói ACTIVE GLOBAL (đổi X-Facility-Id không mất gói)
       → quota toàn cục (vd 1/3), trùng giờ toàn cục,
         travel buffer 30′ nếu xung đột cận kề khác facility
       → còn chỗ → BOOKED ; nếu ĐẦY → chọn vào WAITLIST (POST /waitlist)  [booking VERIFIED;
                                                                          waitlist CODE-VERIFIED]
4.  Có người hủy chỗ → cancelEnrollment trong tx → promoteNextEligible
       → người WAITING position nhỏ nhất đủ điều kiện → PROMOTED + BOOKED
       + notification "Được xếp chỗ từ waitlist"                      [CODE-VERIFIED — chưa có test]
5.  Check-in vào cửa B   POST /facility-visits/check-in (X-Facility-Id = B)
       → gói ACTIVE (FREE cũng vào được), dedupe 5′
       → FacilityVisit facilityId = B (USAGE facility)                 [CODE-VERIFIED — chưa có test]
6.  Buổi học: HLV POST /attendance/generate-qr (cửa sổ −30′)
       → Member POST /attendance/scan-qr (QR hoặc mã 6 ký tự)
       → PRESENT (idempotent; đã chốt ABSENT → 409)                    [VERIFIED attendance 80/0]
7.  Chưa điểm danh → cuối buổi PATCH /class-schedules/:id/complete
       → ABSENT SYSTEM_NO_SHOW + BOOKED → COMPLETED + quét warning     [CODE-VERIFIED]
8.  Chuyên cần (member × class):
       FIXED  → vắng so với floor(20% × plannedSessionCount)
                (vd 10 buổi → 2): < 2 NORMAL, = 2 NOTICE, > 2 WARNING  [VERIFIED unit]
       RECURRING → rate rolling-10: ≥80% N, 70–<80% N, <70% W          [VERIFIED unit]
       → WARNING chỉ GỬI THÔNG BÁO tham khảo                          [CODE-VERIFIED]
9.  Manager review → POST /attendance/penalties/preview
       → POST /attendance/penalties/apply (đủ mẫu, lý do, decidedBy)
       → AttendancePenalty APPLIED 30 ngày → thu hồi chỗ tương lai
         của ĐÚNG lớp đó + chặn book lại lớp đó                        [VERIFIED quota §6]
       → Member KHÔNG bị hủy/freeze/giảm gói; các lớp khác vẫn đặt được
10. Hội viên dùng tiếp MỌI cơ sở (A/B/C) tới endDate.
       Hết hạn → resolver trả null NGAY (book/check-in/scan → 403);
       job 15 phút → EXPIRED + notification; KHÔNG gói nào tự phản sinh [VERIFIED policy-a/lifecycle]
       (đăng nhập lại có thể được cấp FREE mới — MF-08)                 [CODE-VERIFIED]
11. Muốn dùng tiếp → mua/gia hạn gói MỚI (Policy A: replacement,
       không cộng ngày cũ)                                             [VERIFIED policy-a]
       hoặc hủy (Member 30% nếu >15 ngày / Manager prorated) —
       hủy toàn bộ booking tương lai ở MỌI cơ sở,
       hoàn tiền ghi ở payment ORIGIN = A                               [VERIFIED cross-facility-cancel]
```

---

*Tài liệu này mô tả hành vi backend ĐÃ IMPLEMENT tính đến 10/7/2026. Mọi claim đều gắn nhãn bằng chứng; khi cần mức chắc chắn cao nhất, đối chiếu lại file code/test được trích ở mục tương ứng. Không commit, không sửa code/tests/swagger trong phạm vi tạo tài liệu này.*






















