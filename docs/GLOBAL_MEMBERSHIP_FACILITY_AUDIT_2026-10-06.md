# Global Membership across Facilities — Audit 2026-10-06

## 1. Executive Summary

Refactor hoàn tất: **Membership là GLOBAL cho hội viên**, `X-Facility-Id` chỉ đại diện cho cơ sở
đang thao tác, KHÔNG giới hạn quyền lợi gói.

Cách thực hiện (thay đổi tối thiểu, giữ nguyên kiến trúc):

- Gỡ `MembershipSubscription` khỏi `facilityRoots` của DAL → mọi lookup entitlement
  (gói ACTIVE, tier, quota) không còn bị cộng `AND facilityId` theo context request.
- `MembershipSubscription.facilityId` chuyển thành **ORIGIN facility** (`String?`): giữ lại làm
  thông tin báo cáo/audit (nơi phát hành gói), **không** dùng làm phạm vi hiệu lực.
- Bỏ DEFAULT `'legacy-main'` để gói FREE cấp lúc đăng ký không còn phụ thuộc facility `legacy-main`.
- Quota lớp học song song được tính trên enrollment **của mọi cơ sở**.
- Trùng giờ (schedule conflict) **vẫn** kiểm tra toàn hệ thống — không đổi.
- Báo cáo theo cơ sở được scope **rõ ràng** bằng `facilityId` origin (giữ nguyên số liệu & PII hiện tại).
- `Class` / `ClassSchedule` / `Room` / `Enrollment` / `Attendance` / `Payment` / `Invoice`
  **vẫn facility-scoped** — không bị ảnh hưởng.

Không thay đổi FE (không cần thiết: FE không cache membership theo facility key, và luôn refetch khi đổi cơ sở).

## 2. Final Business Rules

```text
MembershipPlan          = GLOBAL   (không đổi — không có facilityId)
MembershipSubscription  = GLOBAL   (entitlement; facilityId chỉ là ORIGIN/báo cáo)
Membership quota        = GLOBAL   (đếm DISTINCT class trên mọi cơ sở)
Schedule conflict       = GLOBAL   (giữ nguyên logic facilityId: undefined)
FREE provisioning       = GLOBAL   (facilityId = NULL, đúng 1 gói ACTIVE)

Class                   = FACILITY
ClassSchedule           = FACILITY
Room                    = FACILITY
Enrollment              = FACILITY (scope theo Class.facilityId — trừ khi chủ động bỏ scope)
Attendance              = FACILITY
Payment / Invoice       = FACILITY (Payment là facilityRoot; Invoice scope theo Payment)
FacilityStaff / AuditLog/ Issue / LeaveRequest / Slot / SchedulePattern = FACILITY
```

Authorization: `checkFacilityScope`, `authorize()`, kiểm tra ownership của service
(BR-01 IDOR, coach không xem tài chính, MEMBER chỉ tự hủy gói của mình) — **không đổi**.

## 3. Files Changed

| File | Lý do (1 dòng) |
|---|---|
| `BE/src/config/scoped-data.ts` | Gỡ `MembershipSubscription` khỏi `facilityRoots` + comment phân tách global/facility |
| `BE/prisma/schema.prisma` | `facilityId String @default("legacy-main")` → `String?` (ORIGIN), relation `Facility?` |
| `BE/prisma/migrations/20261006000100_membership_global_scope/migration.sql` | **Mới** — `DROP DEFAULT` + `DROP NOT NULL`, không đụng dữ liệu |
| `BE/src/modules/subscriptions/free-subscription.service.ts` | Gói FREE tạo với `facilityId: null` (global, hết phụ thuộc `legacy-main`) |
| `BE/src/modules/subscriptions/subscriptions.service.ts` | Renew ghi ORIGIN facility rõ ràng (`context ?? origin cũ`); thêm import `requestContext` |
| `BE/src/modules/subscriptions/subscription-purchase.service.ts` | Comment làm rõ `facilityId = ORIGIN` (giữ `soldPayment.facilityId`) |
| `BE/src/modules/enrollments/enrollment-quota.service.ts` | Quota đếm enrollment **toàn hệ thống** (`facilityId: undefined`); doc global |
| `BE/src/modules/reports/reports.service.ts` | 3 query báo cáo scope **rõ ràng** theo ORIGIN facility (giữ hành vi & PII cũ) |
| `BE/tests/cross-facility-booking.integration.ts` | Kỳ vọng mới + bổ sung acceptance Case 1–6, 8 |
| `BE/tests/facility-operations.integration.ts` | Gateway activation: kỳ cũ `ACTIVE` → `SUSPENDED` (luồng 1 gói ACTIVE toàn cục) |

Không file FE nào thay đổi (`git diff --stat` xác nhận 0 file FE).

## 4. Data Model Impact

`MembershipSubscription.facilityId` **giữ nguyên tên, giữ nguyên cột, giữ nguyên FK**:

- **Trước:** `String @default("legacy-main")` — vừa là khóa phân vùng do DAL tự lọc.
- **Sau:** `String?` — thuần **ORIGIN facility** (cơ sở phát hành giao dịch cấp gói) cho
  báo cáo/audit; **không** được dùng làm phạm vi hiệu lực.

Không rename sang `originFacilityId` để tránh churn không cần thiết (schema, migration, seed,
tests, FE type đều đang dùng tên `facilityId`); ý nghĩa mới được ghi ngay trên field trong schema.

Migration **không xoá/không cập nhật row nào**:
- Mọi subscription hiện có giữ nguyên `facilityId` làm origin.
- Chỉ bỏ `DEFAULT 'legacy-main'` và `NOT NULL` để FREE toàn cục không phải trỏ về `legacy-main`.

Row có `facilityId = NULL` = gói FREE cấp tự động (không phát sinh tại cơ sở nào).

## 5. DAL / Scope Impact

Cơ chế cũ (`BE/src/config/prisma.ts` + `facilityFilter`): với `MembershipSubscription ∈ facilityRoots`,
mọi query đều bị thêm `AND: { facilityId: <context> }`, và ghi bị ép `data.facilityId = context`.

**Sau thay đổi:**

| Model | Trạng thái |
|---|---|
| `Room`, `Class`, `Payment`, `Issue`, `LeaveRequest`, `Slot`, `SchedulePattern`, `AuditLog`, `FacilityStaff` | **FACILITY** (facilityRoot — giữ nguyên) |
| `ClassSchedule`, `ClassMember`, `Enrollment`, `Attendance`, `Invoice`, `RoomCapability`, `AttendanceManualCode`, `AttendancePenalty`, `CoachFeedback` | **FACILITY** theo chuỗi cha (`parents`) — giữ nguyên |
| `MembershipSubscription` | **GLOBAL** — không filter, không ép `facilityId` khi ghi, không check 403 `FORBIDDEN_SCOPE` theo id |
| `MembershipPlan`, `User`, `MemberProfile`, `CoachProfile` | **GLOBAL** (không đổi) |

Không model nào khác bị gỡ scope → không làm rộng tài nguyên facility-scoped.

Các chỗ **chủ động bỏ scope** (giữ nguyên, phục vụ luật toàn hệ thống):
`enrollments.service.ts:90` (trùng giờ), `course-enrollment.service.ts:138`,
`class-schedules.service.ts:457` (dời lịch), `operations.routes.ts:171,354`,
`enrollment-quota.service.ts` (quota — **mới thêm**).

## 6. FREE Registration Flow

```text
POST /auth/register (KHÔNG có facility context — /auth không nằm trong danh sách scope)
  → MemberProfile (Mongo) + projection (PostgreSQL)
  → ensureActiveFreeSubscription(tx, memberProfileId)
      - idempotent qua advisory lock `membership:free-provision` (GIỮ NGUYÊN)
      - reuse FREE plan đang active (GIỮ NGUYÊN)
      - tạo MembershipSubscription { status: ACTIVE, tier: FREE, facilityId: NULL }   ← MỚI
  → hội viên thấy đúng MỘT gói FREE ở MỌI facility
```

- Hết phụ thuộc `legacy-main`: cột nullable + không còn DEFAULT nên INSERT không cần facility
  tồn tại (trước đây FK `facilityId = 'legacy-main'` bắt buộc row `legacy-main` phải có).
- Idempotency/advisory-lock **không đổi**: `ensureActiveFreeSubscription` chạy lại vẫn `created = false`.
- KHÔNG tạo 1 gói FREE cho mỗi facility.
- Verification: `test:integration:audit` — check *“register: Mongo identity + PostgreSQL profile +
  FREE entitlement; duplicate rejected”* → **PASS**; `test:operations:cross-facility` —
  *“FREE membership provisioned at registration is global (no legacy-main dependency)”* → **PASS**
  (assert `facilityId === null` + `findActiveSubscription` trả cùng id ở facility A và B).

## 7. Paid Membership Flow

```text
Member mua PREMIUM tại Facility A
  → POST /subscriptions (quầy) hoặc SePay checkout
  → activateSubscriptionForPayment():
      - inspectPlanPurchase/applyPlanSwitchRules chạy GLOBAL  ← MỚI (trước bị lọc theo facility)
      - gói ACTIVE cũ (bất kể cơ sở nào) → SUSPENDED  ⇒ đúng luật "1 member = 1 ACTIVE"
      - tạo gói mới { facilityId: ORIGIN = Payment.facilityId }   ← chỉ là thông tin nơi thu tiền
  → Member đổi X-Facility-Id sang B
  → findActiveSubscription trả CÙNG một gói ⇒ tier/quota/ngày hết hạn không đổi
```

- **Không còn** hiện tượng “mua ở B trong khi còn gói ở A ⇒ 2 gói ACTIVE cùng lúc”.
- Gia hạn (`POST /subscriptions/:id/renew`) hoạt động bất kể facility đang chọn; origin của kỳ mới
  = facility thu tiền (fallback: origin của kỳ trước).
- `cancel` / `renew` / `PATCH /:id/status` tra subscription **toàn cục** → không còn 404 khi gọi từ
  facility khác; authorization giữ nguyên (`MANAGER`/`RECEPTIONIST`/`MEMBER` + ownership).
- SePay callback không có header → vẫn tự rehydrate `facilityId` từ `Payment` đã lưu (giữ nguyên).
- Verification: Case 2 & Case 3 (cross-facility) và check
  *“gateway activation … recognises a global membership bought at another facility”* (operations) → PASS.

## 8. Quota Behavior

`getMemberConcurrentClassQuota` — **toàn cục**:

```ts
requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () =>
  db.enrollment.findMany({ ... })   // trước đây bị DAL lọc theo Class.facilityId
);
```

Giữ nguyên toàn bộ định nghĩa: chỉ tính `Enrollment.status = BOOKED` ở `ClassSchedule.SCHEDULED`
chưa bắt đầu; DISTINCT Class (1 Class = 1 quota); `limit` lấy `maxConcurrentClassesSnapshot`
fallback plan live; `remaining = max(0, limit - used)`.

Ví dụ `maxConcurrentClasses = 3`: A 1 class + B 2 classes ⇒ `used = 3` ở cả hai facility,
không được thêm class mới chỉ vì đã đổi cơ sở.

Verification (cross-facility): `used = 2`/`limit = 3` ở **cả** facility A và B; hạ snapshot xuống 1
⇒ chặn với code `CONCURRENT_CLASS_LIMIT_REACHED` → **PASS**.

## 9. Schedule Conflict Behavior

**Không đổi** — trùng giờ vẫn kiểm tra toàn hệ thống bằng cách chủ động bỏ scope:

```ts
requestContext.run({ ...ctx, facilityId: undefined }, () => tx.enrollment.findFirst({ ... }))
```

Ca: A `19:00–20:00`, B `19:30–20:30` cùng hội viên ⇒ **bị từ chối 409**.
Verification (cross-facility, PASS):
- `book A` rồi `book B` chồng giờ → 409;
- whole-course có buổi chồng → 409;
- transfer sang buổi chồng sang cơ sở khác → 409 và giữ nguyên chỗ cũ;
- dời lịch buổi đã có booking sang giờ trùng chỗ ở cơ sở khác → 409, giữ nguyên giờ cũ;
- 2 request đặt A/B trùng giờ chạy đồng thời → đúng 1 request thành công.

## 10. Tests Executed

**Môi trường test (DB riêng, KHÔNG đụng Render/production):**

- PostgreSQL do user cấp: `postgresql://postgres:***@127.0.0.1:5432/scms_test?schema=scms_verify_20261006`
- MongoDB test cục bộ do lượt chạy này khởi động: `127.0.0.1:27018`, single-node replica set `rs0`
  (bắt buộc vì `POST /auth/register` dùng Mongo transaction), database `scms_verify_20261006`
- Test DB dựng bằng `prisma db push` (đúng convention repo) + seed row `legacy-main`
  (data của migration `20261005000000`; `db push` không chạy data migration)
- Test chạy qua `node node_modules\tsx\dist\cli.mjs <file>` — tương đương npm script
  (shell của phiên này nuốt output của `npx`)

### 10.1 Kiểm tra tĩnh

| # | Command | Kết quả | Status |
|---|---|---|---|
| 1 | `npx prisma validate` | `The schema ... is valid`, exit 0 | **PASS** |
| 2 | `npx prisma generate` | `Generated Prisma Client (v5.22.0)`, exit 0 | **PASS** |
| 3 | `npx tsc --noEmit` (BE, `include: ["src"]`) | exit 0 (chạy cả baseline, trước sửa và sau sửa) | **PASS** |
| 4 | `tsc --noEmit --strict ... src\types\express.d.ts tests\cross-facility-booking.integration.ts tests\facility-operations.integration.ts` | exit 0 (tsconfig không include `tests`, nên typecheck riêng 2 file test đã sửa) | **PASS** |
| 5 | `FE: npm run typecheck` | 3 lỗi trong `src/features/ai/AIMarkdownRenderer.tsx`: `Cannot find module 'react-markdown'` / `remark-gfm` — folder `node_modules/react-markdown` thiếu `package.json`. FE **không** bị thay đổi bởi thay đổi này | **FAIL — PRE-EXISTING** |
| 6 | `FE: npm test` (`vitest run`) | `Test Files 9 passed (9)`, `Tests 57 passed (57)`, exit 0 | **PASS** |
| 7 | `node docs/audit/business-rule-probes.cjs` | `# pass 0 / # fail 10`, exit 1 — mock `mockedRequire` chỉ cho phép `prisma.js`/`errorHandler.js`/`pagination.js`, trong khi service đã import `request-context.js` từ refactor facility-scope trước đó | **FAIL — PRE-EXISTING** (xác minh bằng `git stash`: baseline cũng `0 pass / 10 fail`) |

### 10.2 Test PostgreSQL + MongoDB

| # | Command (trong `BE/`) | Kết quả | Status |
|---|---|---|---|
| 8 | `npx prisma db push --skip-generate --accept-data-loss` | `database is now in sync`, exit 0 | **PASS** |
| 9 | `npx prisma migrate deploy` (schema rỗng) | Dừng ở migration `20260925090000_add_vietqr_sepay_payment`: `P3018 / 42701 column "planId" of relation "Payment" already exists` — migration `20260924220000` đã thêm cột này. Migration của thay đổi này là #24, chưa tới lượt | **FAIL — PRE-EXISTING** (lỗi chuỗi migration có sẵn, không do thay đổi này) |
| 10 | Migration SQL probe (`db execute`: tạo bảng định dạng CŨ → chạy đúng 2 câu `ALTER` của migration mới → assert) | exit 0: 2 row — row cũ giữ nguyên `legacy-main`, row mới `facilityId IS NULL` | **PASS** |
| 11 | `test:operations:cross-facility` | exit 0 — **10/10 PASS** | **PASS** |
| 12 | `test:operations` (`facility-operations.integration.ts`) | exit 0 — **12 PASS** | **PASS** |
| 13 | `test:integration:audit` | exit 0 — **28 passed, 0 failure** | **PASS** |
| 14 | `test:operations:http` (`facility-http.integration.ts`) | exit 0 — ticket privacy, facility isolation, audit snapshots, identity migration | **PASS** |
| 15 | `test:operations:migration` (`facility-migration.integration.ts`) | exit 0 — SePay compatibility repeatable, legacy rooms, default facility, STAFF rename | **PASS** |
| 16 | `test:e2e` (`enrollment-quota.e2e.ts`) | exit 1 — `createPlan failed: 400 FACILITY_CONTEXT_REQUIRED` (HTTP helper không gửi `X-Facility-Id`), `PASS: 0 / FAIL: 1` | **FAIL — PRE-EXISTING** (xác minh bằng `git stash`: baseline y hệt) |
| 17 | `test:e2e:sepay` (`sepay-payment.e2e.ts`) | exit 1 — cùng lỗi `FACILITY_CONTEXT_REQUIRED` tại `createPlan` | **FAIL — PRE-EXISTING** (xác minh bằng `git stash`: baseline y hệt) |
| 18 | `test:e2e:course` (`course-enrollment.e2e.ts`) | exit 1 — cùng lỗi `FACILITY_CONTEXT_REQUIRED` tại `createPlan` | **FAIL — PRE-EXISTING** (cùng root cause; `facilityScope.ts`/`app.ts` không bị thay đổi) |
| 19 | `test:e2e:lifecycle` (`subscription-lifecycle.e2e.ts`) | exit 1 — cùng lỗi `FACILITY_CONTEXT_REQUIRED` tại `createPlan` | **FAIL — PRE-EXISTING** (như trên) |
| 20 | `test:e2e:attendance` (`attendance-manual-code.e2e.ts`) | exit 1 — cùng lỗi `FACILITY_CONTEXT_REQUIRED` tại `createPlan` | **FAIL — PRE-EXISTING** (như trên) |
| 21 | `test:integration:audit:browser`, `test:operations:room-ui` | Không chạy — cần Playwright browser + FE dev server đang mở | **BLOCKED** |
| 22 | `test:e2e:chat`, `test:sepay:smoke`, `test:cloudinary:check`, `test:mailer` | Không chạy — không liên quan membership (chat/smoke) hoặc cần dịch vụ ngoài (Cloudinary, mail) | **BLOCKED** |

**Lưu ý về lần chạy #13:** lần đầu `test:integration:audit` FAIL 1/28 với
`MongoServerError: This MongoDB deployment does not support retryable writes` — do Mongo test chạy
standalone không có transaction. **Sự cố môi trường, không phải lỗi code**: khởi động lại Mongo test
với single-node replica set `rs0` → chạy lại **28/28 PASS**.

### 10.3 Acceptance cases

| Case | Kỳ vọng | Bằng chứng | Status |
|---|---|---|---|
| 1 — FREE global | Đăng ký → đúng 1 gói FREE, thấy ở mọi facility | #11 (*FREE membership provisioned at registration is global*), #13 (*register … FREE entitlement*) | **PASS** |
| 2 — Paid global | Mua ở A → đổi sang B vẫn ACTIVE | #11 (*one subscription purchased at facility A stays ACTIVE at facility B*) | **PASS** |
| 3 — Không nhân bản ACTIVE | Ở facility B, validation mua gói vẫn thấy gói hiện có | #11 (*purchase validation sees the existing global membership*), #12 (*gateway activation … recognises a global membership bought at another facility* — kỳ cũ `SUSPENDED`) | **PASS** |
| 4 — Quota global | A 1 class + B 1 class ⇒ `used = 2` ở cả hai; vượt limit → 403 `CONCURRENT_CLASS_LIMIT_REACHED` | #11 | **PASS** |
| 5 — Trùng giờ global | A 19:00–20:00 vs B 19:30–20:30 → từ chối | #11 (book / whole-course / transfer / dời lịch / race đồng thời) | **PASS** |
| 6 — Thao tác liên facility | Membership tạo ở A, thao tác khi đang ở B | #11 (*membership status operations work while another facility is selected*) | **PASS** |
| 7 — Authorization staff giữ nguyên | Thiếu/mâu thuẫn/chưa phân công facility → chặn; ghi sai facility → `FORBIDDEN_SCOPE` | #12 (*missing, contradictory and unassigned facility contexts rejected*, *scoped lists and cross-facility write denial*, *audit and business mutation roll back together*), #14 | **PASS** |
| 8 — Facility resources cách ly | Class/Room của A không hiện ở B | #11 (*facility-scoped class listings remain isolated*), #12 (*revenue … excludes other facilities*), #14 | **PASS** |

## 11. Regression / Risks

1. **`test:e2e*` (5 suite) — FAIL / PRE-EXISTING.** HTTP helper của các suite này không gửi
   `X-Facility-Id` nên bị `checkFacilityScope` trả 400 `FACILITY_CONTEXT_REQUIRED` ngay ở
   `POST /membership-plans`, trước khi chạm tới code membership. Đã xác minh baseline bằng
   `git stash` (`enrollment-quota` và `sepay-payment` chạy lại tại HEAD cho kết quả y hệt);
   `facilityScope.ts` / `app.ts` không nằm trong danh sách file thay đổi.
   **Ngoài phạm vi thay đổi này**, cần một đợt sửa riêng (gửi `X-Facility-Id` trong helper).
2. **`business-rule-probes.cjs` — FAIL / PRE-EXISTING** (0/10 ở cả baseline): mock require không
   phủ `request-context.js` — hệ quả của refactor facility-scope trước đó.
3. **FE `npm run typecheck` — FAIL / PRE-EXISTING** do `node_modules/react-markdown` thiếu
   `package.json`; FE không thay đổi (`git diff` = 0 file FE). `FE npm test` vẫn PASS 57/57.
4. **`prisma migrate deploy` trên DB rỗng — FAIL / PRE-EXISTING** (`20260925090000` thêm lại cột
   `Payment.planId` đã có từ `20260924220000`). Hệ quả: không replay được toàn bộ chuỗi migration
   trên DB trống để xác minh end-to-end → đã thay bằng **SQL probe** (mục 10.2 #10).
5. **Thay đổi hành vi có chủ đích cần lưu ý**
   - `deletePlan` (`membership-plans.service.ts`): guard “không deactivate plan còn subscription
     ACTIVE” giờ đếm **toàn cục** (trước theo facility) — do model đã global; là hướng chặt hơn.
   - Báo cáo `/reports/memberships`, `/reports/members`, `/reports/subscription-logs`: giữ nguyên
     phạm vi theo **ORIGIN** facility (lọc tường minh) → số liệu và PII không mở rộng sang cơ sở khác.
     Row FREE mới (`facilityId = NULL`) không thuộc báo cáo của cơ sở nào (trước đây cũng vậy,
     vì FREE từng nằm ở `legacy-main`).
   - Staff (MANAGER/RECEPTIONIST) xem/quản lý membership của hội viên **bất kể facility phát hành** —
     đúng tinh thần membership toàn cục; vai trò và ownership check giữ nguyên.
   - Dữ liệu FREE cũ đang trỏ `legacy-main` vẫn giữ nguyên giá trị (không mất), chỉ không còn là
     điều kiện để hiệu lực gói hoạt động.
6. **Chưa kiểm chứng trên production/Render** — mọi kết quả chỉ đúng với DB test local.
7. **BLOCKED**: browser/Playwright suites (mục 10.2 #21) chưa chạy, cần xác minh tay khi có môi trường.

## 12. Database / Deployment Notes

| Hạng mục | Kết luận |
|---|---|
| Loại thay đổi | **Migration required** (không chỉ code): `BE/prisma/migrations/20261006000100_membership_global_scope/migration.sql` |
| Nội dung migration | `ALTER TABLE "MembershipSubscription" ALTER COLUMN "facilityId" DROP DEFAULT;` + `... DROP NOT NULL;` — non-destructive |
| Data migration | **Không cần** — không cập nhật/xoá row nào, mọi `facilityId` hiện có được giữ làm ORIGIN |
| Thao tác DB thủ công với production | **Không cần** |
| Lệnh deploy | `npm run db:deploy` (`prisma migrate deploy`) trên database production; đã xác minh SQL chạy đúng trên DB test (probe mục 10.2 #10) |
| Rollback | Nới lỏng constraint nên rollback an toàn bằng migration đảo ngược (`SET DEFAULT 'legacy-main'` + `SET NOT NULL`) **chỉ khi** không tồn tại row `NULL`; row FREE tạo sau thay đổi có `NULL` nên phải quyết định cách xử lý trước |
| Nơi đã xác minh | PostgreSQL test local `scms_test` + schema `scms_verify_20261006` (**đã DROP**); MongoDB test cục bộ port 27018 (database test **đã drop**, instance **đã dừng**). **Không thực hiện bất kỳ lệnh ghi nào trên Render/production** |
| Lưu ý chuỗi migration | `migrate deploy` trên DB trống đang FAIL sẵn ở `20260925090000` (PRE-EXISTING); DB đã áp migration cũ thì chỉ cần áp migration mới, nhưng nên sửa riêng lỗi đó |
| FE | **Không cần thay đổi / không cần deploy lại FE** |
| Dọn dẹt đã thực hiện | DROP schema `scms_verify_20261006`; drop database Mongo test trên 27017 & 27018; dừng mongod test; xoá file tạm (`rs-init.tmp.cjs`, `mig-probe.tmp.sql`, `mongo-cleanup.tmp.cjs`) và thư mục data tạm; MongoDB service của máy (27017) giữ nguyên |




