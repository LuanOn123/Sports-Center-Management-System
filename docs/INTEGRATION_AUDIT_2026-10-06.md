# FE–BE integration audit — 06/10/2026

## Kết luận

Đã sửa các lỗi integration xác định được trong checkout, đồng bộ contract từ source BE, chạy FE/BE và kiểm thử với MongoDB/PostgreSQL thật trong database kiểm thử riêng. Đối chiếu tĩnh có **151/151 operations khớp method/path**, không còn operation FE thiếu route tương ứng trong catalogue đã kiểm tra.

**Không thể kết luận môi trường production đã ổn định:** FE đang cấu hình gọi Render, trong khi backend Render chưa đồng bộ đầy đủ với source hiện tại. `/issues` và `/slots` trả 404; Swagger Render có 117 operations, source có 151. Cần triển khai cùng phiên bản BE và migrations trước khi dùng kết quả local để đánh giá production. Audit không push, deploy hoặc mutation dữ liệu Render.

MATCH trong contract map chỉ xác nhận route registration; không có nghĩa đã thực thi tất cả 151 endpoints với mọi tổ hợp role, DTO và trạng thái.

## 1. Kiến trúc và nguồn contract

| Thành phần | Implementation hiện tại |
|---|---|
| FE | `FE/`: React 19, TypeScript, Vite 6, React Router 7, TanStack Query |
| FE entry / portal | `src/app/App.tsx`; portal ADMIN, MANAGER, RECEPTIONIST, COACH, MEMBER |
| API client | `src/shared/api.ts`, fetch; wrappers `src/api/*` dùng client chung |
| Base URL | `VITE_API_BASE_URL`, fallback Render `/api/v1`; `.env.local` có ưu tiên cao hơn `.env` |
| Contract / DTO | `src/shared/operations.json`, `generated.ts`, `docs/openapi.json`, workflow overrides |
| BE | `BE/`: Express 5, TypeScript, Zod; routes/controller/service trong `src/modules/` |
| API prefix | `/api/v1`; `/subjects` là alias hiện có của `/sports` |
| Identity | MongoDB/Mongoose: User, profile, refresh token; ID ObjectId 24-hex |
| Business data | Prisma 5/PostgreSQL: projections, facility, room, class, schedule, enrollment, subscription, payment, attendance |
| Auth | JWT access/refresh, `Authorization: Bearer`; identity xác minh qua `/auth/me` |
| Role | BE: ADMIN, MANAGER, RECEPTIONIST, COACH, MEMBER; STAFF là tương thích FE/dữ liệu lịch sử |
| Quyền | `authorize.ts` cho ADMIN kế thừa annotation MANAGER/RECEPTIONIST; service vẫn kiểm tra ownership/facility |
| Facility scope | `X-Facility-Id`, assignment và quan hệ resource; FE đổi cơ sở hủy request/reset cache |
| Response | `{ success, message, data, pagination? }`; pagination nằm cạnh data; decimal tiền có thể là string |
| Client lỗi / token | sessionStorage theo tab; refresh đồng thời dùng một request; timeout, field error, clear session khi refresh thất bại; hỗ trợ response không có body |

Database thử nghiệm dùng PostgreSQL schema và Mongo database `scms_verify_20261005`. Test mới từ chối chạy khi tên/schema không có prefix `scms_verify_`. Chỉ tạo fixture riêng và xóa dữ liệu của lượt chạy; không thay business rules để tạo kết quả PASS.

## 2. API contract map và trace

- [API_CONTRACT_MAP.md](API_CONTRACT_MAP.md): Feature, Role, FE consumer, FE API, Method, BE route, Status cho 151 operations.
- [API_CONTRACT_MAP.json](API_CONTRACT_MAP.json): thêm controller handler, body/schema, query/path parameters và status codes.
- [FE API inventory](../FE/docs/API_INVENTORY.md): schema, enum, response example và pagination.
- `scripts/audit-api-contract.mjs` đọc TypeScript AST của mount/router, không chỉ search chuỗi endpoint. Consumers của shared resource là mapping tĩnh; phải đọc tiếp service để đánh giá ownership/business rule.

Các trace đã thực thi xuyên tầng:

| Flow | Trace FE / HTTP → BE → database |
|---|---|
| Login 5 roles | Login → shared api → auth controller/service → Mongo User/refresh token → `/auth/me` → portal/profile/reload |
| Hồ sơ coach | ResourcePage → PATCH `/coaches/{User.id}` → coaches service → Mongo CoachProfile → synchronized Prisma CoachProfile |
| Profile member | PATCH `/auth/me` và `/members/{profileId}` → Mongo User/Profile → projection → đọc lại qua cả hai model |
| Phòng tập UI | ResourcePage/SchemaForm → POST/GET/PATCH/DELETE `/rooms` → rooms service → Prisma Room → list/detail/reload/inactive |
| Lịch / booking | rooms/classes/coach assignment → `/class-schedules` → schedule service → member `/enrollments` → PostgreSQL → roster |
| Điểm danh | COACH roster → POST `/attendance` → validation/service → Prisma Attendance → MEMBER `/attendance/my` |
| Thanh toán quầy | RECEPTIONIST subscription → payment → invoice → PostgreSQL; MEMBER đọc payment của mình |
| Feedback | MEMBER POST `/feedbacks` với Mongo CoachProfile ID → validation/service → relational feedback |

Body không gửi role tự chọn khi đăng ký hội viên; memberId/coachId dùng profile ID ở quan hệ nghiệp vụ, User.id ở coach PATCH. Schedule/room/class ID vẫn là UUID. Không đổi timezone/enum của BE. FE format theo locale, gửi ISO timestamps; các rule thời gian lấy BE làm chuẩn.

## 3. So sánh lịch sử

| Commit | Ý nghĩa đối với integration |
|---|---|
| `68a24fd` — fix Register & OTP | HEAD trước audit; registration và reset-password cần đối chiếu implementation mới |
| `9e6db53` — new logic and build new role | Thay đổi lớn: ADMIN/RECEPTIONIST, facility context, operations, migration và identity projection |
| `052ecd2` — resolve nested merge conflicts | FE đã được khôi phục sau merge; conflict/build check cần chạy lại |

FE catalogue trước audit đã có 151 operations, nhưng các guard, dữ liệu form, QR window và Swagger ID constraints còn lệch. Không tìm thấy thay đổi prefix/method cần tạo lại endpoint cũ trong catalogue này. Bug `generate:api -- --local` chỉ đổi tên nguồn mà không đọc Swagger BE khiến snapshot cũ dễ được giữ lại.

## 4. Các mismatch đã sửa

| Mismatch / mức độ | Trước | Sau / bằng chứng |
|---|---|---|
| BROKEN / P1 — attendance ID | Mongo MemberProfile ID bị UUID-only validator trả 400 | Chấp nhận ObjectId hợp lệ và UUID legacy; malformed vẫn 400; attendance thật lưu PostgreSQL |
| AUTH_CHANGED / P1 — ADMIN booking | Middleware cho qua nhưng controller từ chối ADMIN 403 | Resolver áp dụng quyền kế thừa đã có; ADMIN đặt hộ/hủy thành công; COACH vẫn bị chặn |
| AUTH_CHANGED / P1 — SePay status | Service không nhận ADMIN trong nhóm operator | ADMIN đọc trạng thái theo quyền hiện có; MEMBER ownership giữ nguyên; COACH 403; order vẫn PENDING |
| RESPONSE_CHANGED / P1 — projection | Sửa Mongo profile nhưng dữ liệu Prisma/nested relation giữ thông tin cũ | Đồng bộ projection sau coach/member/self-profile/avatar mutation; coach fields được upsert; đọc lại Mongo và Prisma cùng giá trị |
| AUTH_CHANGED / P2 — manager coach | UI khóa cả edit dù BE cho MANAGER PATCH | Mở edit theo BE; account creation vẫn ADMIN; form giữ User.fullName và nested chuyên môn |
| AUTH_CHANGED / P2 — receptionist operations | Shared resource UI khóa class/schedule mà BE cấp quyền | Hiển thị mutation theo route hiện tại; attendance ghi tay vẫn không cấp cho receptionist |
| AUTH_CHANGED / P2 — manager member create | FE mất tạo hội viên do `/users` chuyển ADMIN-only | Dùng equivalent `POST /auth/register`, không tạo lại staff API cũ và không gửi role |
| BROKEN / P2 — admin navigation | Dashboard shortcut sang `/manager/*` gây sai portal | Dashboard nhận base; admin links ở `/admin/*`; thêm nav hội viên |
| AUTH_CHANGED / P2 — feedback moderation | ADMIN bị FE dùng nhánh không đúng quyền kế thừa | ADMIN/MANAGER dùng endpoint moderation manager hiện có |
| AUTH_CHANGED / P2 — EXCUSED | Dropdown COACH cho chọn trạng thái service từ chối | COACH chỉ thấy trạng thái được phép; EXCUSED dành ADMIN/MANAGER; BE 403 vẫn được kiểm tra |
| REQUEST_CHANGED / P2 — QR window | FE quảng bá còn 30 phút sau kết thúc, BE đóng khi kết thúc | FE đóng đúng endTime; unit test so biên mở/đóng trực tiếp với constants BE |
| REQUEST_CHANGED / P2 — login email | Email nhập hoa khác identity lowercase lúc đăng ký | FE trim/lowercase email; login thật cả 5 roles dùng uppercase đã qua |
| REQUEST_CHANGED / P2 — snapshot | Feedback ObjectId còn Swagger format UUID; `--local` không xuất BE | Generator xuất source Swagger thật, giữ overrides; regenerated snapshot/metadata và 151 route check |

Hai lỗi attendance và ADMIN booking có bằng chứng HTTP fail trước sửa: [integration-audit-before.log](integration-audit-before.log), 23 PASS / 2 FAIL. Sau sửa: [integration-audit-final.log](integration-audit-final.log), 33 PASS / 0 FAIL.

Không bỏ validation, authentication, ownership, facility isolation, duplicate/overlap checks; không thêm fake response hay mock vào runtime.

## 5. Role checklist và phạm vi PASS

| Role | Browser thật | HTTP thật / DB side effect | Negative / restriction |
|---|---|---|---|
| ADMIN | Login → dashboard → facility → profile → reload | Catalog create/read/update; inherited booking/cancel; SePay status; refresh/logout | MEMBER/COACH quyền thấp vẫn bị chặn; route admin không đi manager (UI regression) |
| MANAGER | Login → dashboard/profile/reload; phòng create/list/detail/update/reload/deactivate | Coach Mongo/PG update; room/class/assignment/schedule; schedule cancel; catalog deactivate | Catalog/price write bị 403; overlap 409; cross-facility kiểm tra qua operations suites |
| RECEPTIONIST | Login → dashboard → facility → profile → reload | Member update; subscription → cash payment → invoice, xác nhận records DB | Không điểm danh ghi tay; không sửa global giá/catalog; UI finance hạn chế refund trong regression |
| COACH | Login → dashboard → facility → profile → reload | Assigned roster → attendance → member history | EXCUSED 403; sửa attendance 403; malformed ID 400; SePay status 403 |
| MEMBER | Login → dashboard/profile/reload; lớp đã đăng ký hiện trong UI | Register/FREE; profile; book/my-list/cancel; feedback; payment/attendance đọc của mình | Booking trùng 409; enum sai 400; guard portal; ownership/facility suites |

Mỗi role đã kiểm tra login → `/auth/me` → refresh → logout → refresh token revoked 401. Token không được in vào log. Browser thật không intercept API, fail khi có `pageerror` hoặc API lỗi ngoài dự kiến.

Operations integration suites bổ sung assignment/cross-facility isolation, issue privacy/audit, identity migration, recurrence/capability, specialization, transaction rollback, overlap, leave approval, concurrent counter confirmation/idempotency/snapshot price, subscription facility separation, course coverage/concurrency và attendance time window/reason permissions. Không đồng nhất các service-level test này với toàn bộ thao tác UI đã chạy thật.

## 6. Validation đã chạy

| Check | Kết quả / evidence |
|---|---|
| API method/path AST | PASS: 151 FE / 151 BE; missing `[]`, backendOnly `[]` |
| FE verify | PASS: conflict check, strict typecheck, 57 unit tests / 9 files, production build — [log](frontend-verify-final.log) |
| BE production build | PASS: Prisma generate + TypeScript — [log](backend-build-final.log) |
| BE real integration audit | PASS: 33 checks, 0 failure — [log](integration-audit-final.log) |
| Real UI CRUD | PASS: 3 room flows + PostgreSQL verification — [log](browser-room-real-audit.log) |
| BE operations HTTP | PASS, actual app routes with MongoDB/PostgreSQL |
| BE operations service | PASS, actual MongoDB/PostgreSQL, rollback/concurrency/business rules |
| SQL migration | PASS, legacy data preserved, default facility, STAFF rename, repeatable SePay compatibility — [log](backend-migration-audit.log) |
| FE browser regression | 164 tests đã đạt: 145 PASS ở full run, 19/19 PASS khi retry với 2 workers, không đổi code/assertion; [initial log](browser-regression-final.log), [retry log](browser-regression-retry.log). Không phải một lượt 164/164 không flaky |
| Startup | Source và server đã biên dịch đều kết nối hai databases, exposes health và Socket.io — [source log](backend-runtime-final.log), [built log](backend-runtime-built.log) |
| Health / CORS | Bản build: health 200; OPTIONS 204 cho Origin FE và headers `authorization,x-facility-id` — [log](runtime-health-cors.log) |
| Render readonly | health/sports/plans 200, users/facilities no token 401, issues/slots 404 — [log](render-readonly-audit.log) |

FE browser suite dùng fixtures/interception trong `tests/` để kiểm tra UI/requests/guards/error states/responsive/accessibility. Đây là bổ sung cho real HTTP/browser tests, không thay thế chúng. Lượt chạy đồng thời có `ERR_NETWORK_CHANGED`/offline/timeouts; toàn bộ 19 failures qua khi retry với 2 workers, không đổi code hoặc assertion. Đây là test-environment flakiness, vẫn cần theo dõi CI; không coi lượt đầu là clean PASS.

Không gửi live SePay settlement hay thư OTP, không thử mutation production. SePay test tạo pending fixture chỉ để kiểm tra quyền đọc/trạng thái; không giả xác nhận nhận tiền.

## 7. Các file thay đổi

| Nhóm | Files / lý do |
|---|---|
| BE ID/quyền | `src/modules/attendance/attendance.schema.ts`, `enrollments/enrollments.controller.ts`, `payments/sepay-payments.service.ts` |
| BE Mongo/PG consistency | `auth/auth.service.ts`, `coaches/coaches.service.ts`, `members/members.service.ts`, `users/user-projection.service.ts` |
| FE auth/portal | `src/features/auth/Login.tsx`, `features/manage/AdminLayout.tsx`, `Dashboard.tsx`, `ResourcePage.tsx` |
| FE workflow | `src/shared/Attendance.tsx`, `CoachFeedback.tsx`, `QrAttendance.tsx`, `businessRules.ts` |
| Contract generation | `FE/scripts/generate-api.mjs`, `FE/docs/openapi.json`, `API_INVENTORY.md`, `FE/src/shared/operations.json`; generated types không có semantic diff |
| Regression tests | `FE/tests/businessRules.test.ts`, `FE/tests/browser/integration-audit.spec.ts`, `BE/tests/integration-audit.ts`, `BE/tests/browser-room-audit.ts` |
| Migration test repair | `BE/tests/facility-migration.integration.ts`: baseline lấy commit trước migration, cleanup khi setup lỗi; không thay migration SQL |
| Tooling / docs | `FE/package.json`, `BE/package.json`, `FE/README.md`, `scripts/audit-api-contract.mjs`, root `docs/API_CONTRACT_MAP.*`, báo cáo và evidence logs |

Không đổi dependencies hoặc secrets/env của người dùng. Không tạo commit/push/deploy. Đã dừng các FE/BE dev server do audit khởi chạy sau khi kiểm thử xong.

## 8. Vấn đề còn lại và giới hạn

| Severity / loại | Trạng thái | Việc cần làm |
|---|---|---|
| P1 — deployment version mismatch | OPEN: FE configured Render, APIs mới trả 404; Swagger ID constraint còn UUID | Triển khai BE cùng checkout, migrations và identity/role migration thích hợp; chạy protected-role smoke test trên deployment |
| Coverage limit — OTP/email | Chưa xác nhận delivery và OTP thật end-to-end; reset UI có regression fixtures | Kiểm thử bằng mailbox test/provider hợp lệ trên môi trường được cấp phép |
| Coverage limit — SePay | Chưa xác nhận tiền thật/webhook ngân hàng production | Sandbox/provider và dữ liệu giao dịch được cấp phép; kiểm tra activation/reconciliation |
| Coverage limit — services ngoài | Chưa thực thi đầy đủ live AI/chat attachment/cloud storage qua mọi role | Chạy các suite/provider smoke tương ứng với cấu hình thật |
| Coverage limit — 151 routes | Method/path được đối chiếu toàn bộ; mọi DTO/state/role combination chưa chạy động | Duy trì map và mở rộng test theo rủi ro, không gọi static MATCH là production PASS |

Các role tùy chỉnh/progress/assessment chỉ được xem là khả năng hỗ trợ khi BE có route/implementation tương ứng; audit không tạo endpoints cũ để lấp UI. Không suy ra capability bị thiếu chỉ từ Swagger thiếu schema.

## 9. Chạy lại

```powershell
# FE
cd FE
npm run generate:api -- --local
npm run check:api-contract
npm run verify
npx playwright test --workers=2

# BE (cần .env.test trỏ đến DB riêng, không phải business database)
cd ../BE
npm run build
npm run test:operations:http
npm run test:operations
npm run test:operations:migration
npm run test:integration:audit
```

Audit browser: FE dev server dùng `VITE_API_BASE_URL` trỏ BE audit local; chạy `npm run test:integration:audit:browser` với `PORT` và `AUDIT_FE_URL` tương ứng. `test:integration:room-ui` cần BE và FE đang chạy, mặc định API `127.0.0.1:8093/api/v1`, FE `127.0.0.1:5176`, có thể override `AUDIT_API_URL`/`AUDIT_FE_URL`. Fixtures cần assignment cơ sở; schema dùng `db push` sẽ không tự có seed `legacy-main` mà migration thật tạo.

**Trạng thái cuối:** source đã sửa và các luồng tích hợp trọng yếu đã xác minh; production còn điều kiện triển khai/kiểm thử như trên. Không tuyên bố toàn bộ hệ thống production PASS.
