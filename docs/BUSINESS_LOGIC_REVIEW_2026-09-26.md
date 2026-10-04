# Sports Center Management System — Review nghiệp vụ A–N

Ngày review: 26/09/2026. Source local tại commit `bc52a4d`.

## Phạm vi, bằng chứng và giới hạn

Đây là review source, không phải xác nhận hệ thống production an toàn. Không thay đổi code ứng dụng, migration, dữ liệu hay giao dịch. Không sử dụng token người dùng từng dán trong chat.

Đã đọc schema Prisma, code thực thi của toàn bộ router nghiệp vụ, các service chính của 19 module, middleware auth/validation/error/upload, controller của các luồng nhạy cảm, cấu hình QR/SePay/quota, các migration liên quan, FE transport/SePay/membership/business rules và danh mục test. Đã trace các phát hiện chính qua route → middleware → controller → service → Prisma → schema; dự án không có tầng Repository độc lập trong các luồng này.

**Chưa thể tuyên bố đã đọc từng dòng toàn bộ project**: các trang FE còn lại, toàn bộ test/seed, tài liệu, generated code và toàn bộ controller CRUD đơn giản chưa được kiểm tra từng dòng. Không kiểm thử khai thác trên API thật, không chạy BE e2e vì có tạo/xóa dữ liệu qua Prisma và chưa có database test được xác nhận. Không xác nhận migrations đã áp dụng trên Render hay cấu hình PostgreSQL production. Các lỗi concurrency là kịch bản suy ra từ code, chưa tái hiện bằng stress test.

Ký hiệu: **XĐ** = xác định từ source; **RR** = rủi ro cần integration/concurrency test; **CS** = chính sách đề xuất, cần chủ dự án chốt. Không coi một tính năng ngoài phạm vi đồ án là bug chỉ vì chưa có.

Kiểm tra thực thi an toàn:

- `FE: npm test`: **7 file, 43/43 test đạt**. Đây là unit test, không chứng minh BE hoặc webhook thật hoạt động.
- `BE: npx tsc --noEmit`: **thất bại**. Service SePay cũ dùng các biến không có trong `env`; Prisma Client đang cài không khớp schema mới (`SEPAY`, `SepayWebhookStatus`, `gateway`, `sepayWebhookEvent`...). Chưa generate lại client, chưa sửa code để tránh làm thay đổi đối tượng review.
- Working tree sạch trước khi thêm báo cáo này.

## Domain model thực tế

| Entity | Quan hệ và ý nghĩa hiện tại |
|---|---|
| User | Email/phone unique; role MEMBER/COACH/STAFF/MANAGER; `isActive`; password hash |
| MemberProfile / CoachProfile / ManagerProfile | Mỗi loại profile 1:1 với User; đổi role không xóa profile cũ; STAFF không có entity Receptionist riêng |
| RefreshToken | N:1 User, lưu hash, hạn và revokedAt |
| MembershipPlan | Giá, durationDays, tier, quota lớp song song, isActive |
| MembershipSubscription | N:1 Member và Plan; snapshot tier/start/end, chưa snapshot đầy đủ quyền lợi/giá/thời lượng |
| Sport | N:N Class, danh sách areaTypes được hỗ trợ |
| Class | N:N Sport; N:N Coach qua ClassMember; capacity, areaType, REGULAR/PREMIUM |
| ClassMember | Thực chất CoachAssignment, unique class+coach, cờ isPrimary; không lưu lịch sử hiệu lực |
| ClassSchedule | N:1 Class và Room; thời gian và SCHEDULED/CANCELLED/COMPLETED |
| Enrollment | Booking theo buổi, N:1 Member/Class/Schedule, unique member+schedule |
| Attendance | N:1 Member/Schedule, unique member+schedule; PRESENT/ABSENT/LATE/EXCUSED, không FK tới Enrollment |
| AttendanceManualCode / Attempt | Mã dự phòng theo buổi, expiry/revocation và nhật ký nhập mã |
| AttendancePenalty | Hình phạt member×class, snapshot tỷ lệ, chỗ bị thu hồi, khiếu nại, người quyết định |
| Payment | N:1 Member; subscription/plan tùy chọn; PENDING/SUCCESS/FAILED/REFUNDED |
| SepayWebhookEvent | sepayId số nguyên unique; log xử lý callback; khác UUID của SePay API reconciliation |
| Invoice | 1:1 Payment; số hóa đơn unique; một phần snapshot người mua/gói |
| TrainingPlan / TrainingResult | Member–Coach, các kết quả tập luyện thuộc plan |
| CoachFeedback | Member–Coach–Class tùy chọn; rating và anonymous |
| Notification | N:1 User, read state; không phải immutable audit log/outbox |
| ChatMessage | Sender và receiver tùy chọn; null receiver là phòng chung; một cờ isRead |

Chuỗi quyền sử dụng: User → MemberProfile → Subscription → Plan; MemberProfile → Enrollment → Schedule → Class → Sport/Coach; Schedule → Room. Payment mua **gói hội viên**, không phải thanh toán từng lớp. Subscription và Enrollment không có FK trực tiếp để truy nguyên quyền đã dùng khi đặt chỗ.

Thiếu entity có ý nghĩa nghiệp vụ: CourseOffering/CourseRegistration (khóa có danh sách buổi cố định), PlanVersion/Entitlement, SubscriptionHistory/FreezePeriod, Refund/BankTransaction/ReconciliationCase, ScheduleCoachAssignment, Maintenance/CenterCalendar, AuditEvent/Outbox. Không nhất thiết thêm tất cả trước demo; ưu tiên theo M.

## Bản đồ tạo/sửa/xóa

| Module | Luồng hiện có và điểm cần chú ý |
|---|---|
| User/Auth | Register và manager create tạo profile + FREE trong transaction; update role/disable chưa xử lý đầy đủ lịch/quyền đã cấp; DELETE là disable |
| Member/Coach | Update User rồi Profile bằng hai lệnh riêng; có thể cập nhật nửa chừng |
| Sport | Manager create/update/disable; chặn disable khi còn class active và thu hẹp areaTypes gây invalid; thiếu khóa đồng bộ với tạo class |
| Room | Manager create/update/disable; chặn upcoming schedules; thiếu guard giảm capacity và ongoing; bulk transfer có transaction |
| Class | Staff/manager create/update/disable; kiểm tra sport/area; thiếu guard capacity/type, lịch sử coach |
| Schedule | Staff/manager create/update/cancel/complete; kiểm tra phòng/coach conflict; không kiểm tra đầy đủ tác động booking khi đổi giờ |
| Activity plan | Đã có API tạo sport tùy chọn + class + coach + nhiều schedule trong một transaction; tạo sport mới chỉ manager |
| Plan | Manager create/update/disable; DELETE có guard active subs, PATCH isActive=false không dùng guard tương đương |
| Subscription | Staff/manager mua/gia hạn; manager đổi status; member hủy của mình; các luồng không cùng một state machine |
| Payment/Invoice | Quầy ghi nhận payment; manager đổi status; SePay settlement tạo sub+invoice; invoice không có API hard delete |
| Enrollment | Member tự đặt, staff/manager đặt hộ; single/bulk/transfer; DELETE là CANCELLED giữ lịch sử |
| Attendance | Coach phụ trách/manager ghi, member scan; sửa record không có audit/correction workflow |
| Penalty | Manager áp/gỡ, member khiếu nại của mình; transaction thu hồi/khôi phục có khóa, nhưng eligibility khôi phục chưa đầy đủ |
| Training | Coach/manager tạo plan/result; member có thể đổi coach plan của mình; GET chưa scope |
| Feedback | Member tạo/upsert/xóa của mình; manager xóa vi phạm; hard delete, không lưu lý do moderation |
| Chat/Notification | Tin nhắn tạo qua REST/socket; upload local public; notification read có ownership |

Xóa assignment coach là **hard delete**. Các FK cascade trong schema có thể xóa attendance/training/feedback nếu một script/admin hard-delete parent; không được suy diễn rằng API DELETE user hiện nay thực hiện cascade (API chỉ disable).

# A. Critical Business Logic Errors

## [CRITICAL-01] FREE 10 năm bị cộng vào gói trả phí — P0, XĐ

**Module:** Subscription purchase. **Current Logic:** register cấp FREE `durationDays=3650`; `inspectPlanPurchase` tính ngày dư không phân biệt FREE/trả phí; activation cộng vào thời hạn gói mới.

**Problem:** quyền miễn phí biến thành thời gian trả phí. **Scenario:** vừa đăng ký → mua Membership 30 ngày → nhận khoảng 3.680 ngày, không phải 30. Nếu dùng renew trên FREE còn hạn thì gói trả phí lại bắt đầu gần 10 năm sau.

**Expected Business Rule:** FREE không có giá trị chuyển đổi sang paid entitlement. **Recommended Fix:** loại FREE khỏi carry-over; tách upgrade/renew; chỉ chuyển phần giá trị trả phí còn lại theo chính sách rõ ràng. Rà soát dữ liệu đã cấp trước khi sửa hàng loạt; không tự rút quyền người dùng mà thiếu đối soát.

**Files involved:** [FREE config](/C:/WDP/Sports-Center-Management-System/BE/src/config/membership.ts), [provisioning](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/free-subscription.service.ts), [purchase:34–136](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscription-purchase.service.ts:34), [renew:85](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscriptions.service.ts:85).

## [CRITICAL-02] Hoàn tiền có thể vượt tiền đã thu — P0, XĐ

**Module:** Subscription cancellation. **Current Logic:** manager refund = payment.amount / plan.durationDays × ceil(ngày còn lại), không cap; thời hạn gồm ngày chuyển từ gói khác/FREE. **Problem:** lấy mẫu số khác thời lượng đã cấp, không có refund ledger.

**Scenario:** trả 300.000đ cho gói 30 ngày, endDate bị cộng thành 3.680 ngày → công thức khoảng **36.800.000đ** nếu hủy ngay. Đây là số hệ thống tính/thông báo, **không phải đã tự chuyển tiền ra ngân hàng**. **Expected:** refund ≤ phần tiền đã thu chưa hoàn, dựa snapshot/giá trị còn lại; tách yêu cầu và chi tiền thực tế. **Fix:** Refund entity có amount/status/reference, unique idempotency, cap, transaction và phân quyền duyệt.

**Files:** [subscriptions:245](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscriptions.service.ts:245), [FE estimate](/C:/WDP/Sports-Center-Management-System/FE/src/shared/businessRules.ts).

## [CRITICAL-03] Đọc training plan người khác và lộ password hash — P0, XĐ

**Module:** Training/Authorization. **Current Logic:** GET `/training-plans` chỉ authenticate; controller chuyển query.memberId, không actor; service không truyền memberId thì lấy toàn bộ, include coach.user:true. **Problem:** mọi tài khoản đăng nhập xem plan/results người khác và trường password của coach. **Scenario:** Member A bỏ query hoặc đổi memberId B. Không cần vượt qua giao diện FE.

**Expected:** member chỉ của mình, coach chỉ plan được giao, staff theo policy; DTO allowlist không password. **Fix:** derive actor scope ở BE, select tối thiểu, test response sâu không chứa password/token. **Files:** [routes](/C:/WDP/Sports-Center-Management-System/BE/src/modules/training-plans/training-plans.routes.ts), [controller](/C:/WDP/Sports-Center-Management-System/BE/src/modules/training-plans/training-plans.controller.ts), [service:52](/C:/WDP/Sports-Center-Management-System/BE/src/modules/training-plans/training-plans.service.ts:52).

## [CRITICAL-04] Attendance API trả password hash của hội viên — P0, XĐ

**Module:** Attendance. **Current Logic:** GET roster có scope phù hợp nhưng include member.user:true, controller json nguyên kết quả. **Problem:** coach phụ trách/staff/manager nhận hash của học viên; member cũng nhận hash của chính mình. **Scenario:** gọi GET `/attendance?scheduleId=...` khi có attendance. **Expected/Fix:** DTO chỉ gồm id/name và thông tin thực sự cần; whitelist xuyên nested relations, thêm regression test.

**Files:** [attendance:59](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance.service.ts:59), [controller](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance.controller.ts). Subscription status response cũng include member.user:true; cần sửa cùng đợt.

## [CRITICAL-05] Đổi payment status không đồng bộ subscription — P0, XĐ

**Module:** Generic payments. **Current Logic:** manager PATCH status SUCCESS chỉ tạo invoice; REFUNDED chỉ cancel invoice. Không kích hoạt/thu hồi subscription. Schema cho PENDING→REFUNDED.

**Scenario:** manager đổi SePay PENDING→SUCCESS: không có subscription; webhook sau đó gặp SUCCESS và bỏ qua activation. Ngược lại refund payment đã có gói vẫn để gói ACTIVE. **Expected:** thao tác tài chính đi qua đúng orchestration, không CRUD enum tùy ý. **Fix:** không cho generic status override online payment; command confirm-cash/refund riêng, transaction quyền+ledger+invoice và CAS. **Files:** [payments:128](/C:/WDP/Sports-Center-Management-System/BE/src/modules/payments/payments.service.ts:128), [settlement:690](/C:/WDP/Sports-Center-Management-System/BE/src/modules/payments/sepay-payments.service.ts:690), payments.routes/schema/controller.

## [CRITICAL-06] Đã nhận tiền nhưng API còn PENDING hoặc SUCCESS thiếu gói — P0, XĐ

**Module:** SePay settlement. **Current Logic:** activation bị AppError → event PROCESSED/ACTIVATION_REJECTED, payment giữ PENDING; mất plan → SUCCESS không subscription/invoice. Có notification đối soát cho một số lỗi, nhưng không có trạng thái resolution cho FE.

**Scenario:** tạo đơn Membership, sau đó đã có Premium trước khi tiền Membership đến → bị chặn downgrade, nhưng tiền thực tế đã nhận. Webhook cùng id retry bị dedupe. **Expected:** phân biệt tiền đã nhận với quyền đã cấp. **Fix:** PAID_REQUIRES_REVIEW/activationStatus, reconciliation case, tác vụ xử lý có audit; FE không khẳng định kích hoạt chỉ vì SUCCESS. **Files:** [sepay:744–815](/C:/WDP/Sports-Center-Management-System/BE/src/modules/payments/sepay-payments.service.ts:744), [FE modal](/C:/WDP/Sports-Center-Management-System/FE/src/shared/SepayCheckout.tsx).

## [CRITICAL-07] Price/benefit không được snapshot tại checkout — P0, XĐ

**Module:** Plan/Payment. **Current Logic:** Payment.amount được lưu lúc tạo, nhưng settlement đọc plan hiện tại; invoice.total lấy plan.price; duration/quota phụ thuộc cấu hình hiện tại. **Scenario:** tạo đơn 300k/30 ngày, manager sửa 500k/60 ngày rồi tiền đến: nhận 300k nhưng invoice 500k và cấp 60 ngày. **Expected:** checkout khóa offer/version và amount; invoice phản ánh tiền/cam kết đúng. **Fix:** immutable PlanVersion hoặc order snapshot; invoice dùng amount đã chốt; lịch sử không bị sửa retroactive. **Files:** [purchase:125](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscription-purchase.service.ts:125), [plans update](/C:/WDP/Sports-Center-Management-System/BE/src/modules/membership-plans/membership-plans.service.ts:50), schema Payment/Subscription.

## [CRITICAL-08] Nhiều gói ACTIVE và bypass quy tắc mua qua renew — P0, XĐ/RR

**Current Logic:** renew tạo ACTIVE mới nhưng không chuyển trạng thái gói cũ; không gọi inspectPlanPurchase; activation không khóa theo member. **Scenario:** renew từ subscription CANCELLED trong khi còn một gói active khác; hoặc hai payment khác nhau settle cùng member. **Problem:** nhiều gói có thể cùng hiệu lực, carry-over tính hai lần; renew bình thường tạo ACTIVE tương lai (không nhất thiết overlap, nhưng trái nghĩa ACTIVE hiện dùng).

**Expected:** một quyền hiện hành hoặc lịch entitlement không overlap rõ ràng. **Fix:** member-level lock dùng chung purchase/renew/refund/resume; state QUEUED cho tương lai; version/CAS, ràng buộc phù hợp. **Files:** [renew:85](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscriptions.service.ts:85), [purchase:83](/C:/WDP/Sports-Center-Management-System/BE/src/modules/subscriptions/subscription-purchase.service.ts:83), schema Subscription.

## [CRITICAL-09] Điểm danh trước/sau buổi và ghi đè kết quả đã chốt — P1, XĐ

**Current Logic:** generate QR không giới hạn lịch; scan kiểm tra booking BOOKED/COMPLETED và gói hiện tại, không kiểm tra schedule.status/start/end; upsert luôn PRESENT. **Scenario:** coach tạo QR buổi tuần sau hoặc buổi COMPLETED, member quét; bản ghi ABSENT/LATE/EXCUSED bị thay PRESENT. **Expected:** server attendance window, schedule hợp lệ; quét lặp chỉ trả kết quả cũ, sửa sau chốt phải command correction có audit. **Fix:** khóa schedule, kiểm tra window/booking/quyền theo buổi, CAS, tách correction. **Files:** [attendance:218](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance.service.ts:218), [scan:252](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance.service.ts:252).

## [CRITICAL-10] Phạt chuyên cần dùng trạng thái gói hiện tại để tính quá khứ — P1, XĐ

**Current Logic:** analytics chỉ tính lịch thuộc subscription hiện ACTIVE hoặc SUSPENDED mà suspendedAt ≤ lịch ≤ endDate. EXPIRED/CANCELLED bị bỏ. **Problem:** giai đoạn đang pause lại được tính; lịch trước lúc pause bị loại nếu không có gói khác bao phủ; hết hạn có thể xóa mẫu quá khứ. **Scenario:** không sửa attendance nào nhưng đổi status subscription làm tỷ lệ và đề xuất penalty đổi. **Expected:** entitlement lịch sử theo thời điểm học, loại đúng freeze period; hết hạn hôm nay không sửa lịch sử hôm qua. **Fix:** history/intervals và snapshot eligibility, áp phạt dựa dữ liệu đã chốt. **Files:** [analytics:104](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance-analytics.service.ts:104).

## [CRITICAL-11] Sửa lịch/sức chứa phá booking đã hợp lệ — P1, XĐ

**Current Logic:** update schedule check room/coach conflict nhưng không check member overlap/subscription coverage. Class/Room capacity update không check số booking và tương quan capacity. **Scenario:** 20 booking, giảm class 10; đổi giờ sang lúc member có lớp khác; dời lịch ra sau hạn gói. **Expected:** preview impact, reject hoặc workflow chuyển/bù có xác nhận; capacity không thấp hơn số chỗ đã giữ. **Fix:** chung khóa và revalidation đối tượng bị ảnh hưởng, audit old/new và notification sau commit. **Files:** [schedule:403](/C:/WDP/Sports-Center-Management-System/BE/src/modules/class-schedules/class-schedules.service.ts:403), [class:106](/C:/WDP/Sports-Center-Management-System/BE/src/modules/classes/classes.service.ts:106), [room update](/C:/WDP/Sports-Center-Management-System/BE/src/modules/rooms/rooms.service.ts).

## [CRITICAL-12] Booking và hủy/đổi lịch không cùng cơ chế khóa — P1, RR

**Current Logic:** booking khóa enrollment:schedule nhưng đọc schedule trước transaction; cancel/complete schedule không lấy khóa đó, update dùng khóa room/coach. **Scenario:** request A đọc SCHEDULED; B hủy và cancel bookings; A sau đó insert BOOKED dựa object cũ → còn booking trên lịch CANCELLED. **Expected:** tất cả thao tác liên quan cùng invariant/lock order; đọc lại sau lock. **Fix:** shared schedule mutation protocol, CAS state, member entitlement lock khi cần. **Files:** [book:109](/C:/WDP/Sports-Center-Management-System/BE/src/modules/enrollments/enrollments.service.ts:109), [course:349](/C:/WDP/Sports-Center-Management-System/BE/src/modules/enrollments/course-enrollment.service.ts:349), [schedule cancellation](/C:/WDP/Sports-Center-Management-System/BE/src/modules/class-schedules/class-schedules.service.ts:384), dbLocks.ts.

## [CRITICAL-13] Hai implementation/migration SePay không nhất quán — P0 deploy, XĐ

**Current Logic:** controller import `sepay-payments.service.ts`; file `sepay-payment.service.ts` cũ vẫn nằm trong TypeScript build. Migration MoMo thêm Payment.planId/FK; migration VietQR tiếp theo lại thêm cùng cột/FK không guard.

**Scenario:** fresh DB chạy chuỗi migration theo thứ tự → duplicate column ở migration VietQR; local typecheck hiện thất bại. **Expected:** một implementation và migration chain replay được. **Fix:** kiểm kê migration đã deploy, tạo kế hoạch sửa baseline/forward migration theo thực trạng; không tự sửa migration đã áp dụng hoặc reset production. Generate client sau khi thống nhất schema, CI fresh DB. **Files:** [migration MoMo](/C:/WDP/Sports-Center-Management-System/BE/prisma/migrations/20260924220000_add_momo_online_payment/migration.sql), [migration VietQR](/C:/WDP/Sports-Center-Management-System/BE/prisma/migrations/20260925090000_add_vietqr_sepay_payment/migration.sql), hai service SePay.

## [CRITICAL-14] Reconciliation chưa chống dùng một bank transaction cho nhiều payment — P0, RR

**Current Logic:** webhook claim sepayId unique là tốt; nhưng RECONCILE bỏ claim, match nội dung bằng includes(orderCode), chỉ khóa theo payment; UUID bank transaction không có unique allocation. **Scenario cần test:** một giao dịch cùng số tiền chứa hai order code, API search trả về cho cả hai → cả hai payment có thể được cấp gói. **Expected:** một bank movement chỉ được phân bổ một lần, mọi nguồn webhook/reconcile dùng chung ledger. **Fix:** normalized BankTransaction với external identity unique và allocation unique; reject ambiguous codes; idempotency xuyên hai kênh. **Files:** [reconcile:474](/C:/WDP/Sports-Center-Management-System/BE/src/modules/payments/sepay-payments.service.ts:474), [settlement:580](/C:/WDP/Sports-Center-Management-System/BE/src/modules/payments/sepay-payments.service.ts:580), schema Payment/SepayWebhookEvent.

# B. Missing Business Rules

| ID | Thiếu/chưa rõ | Mức và đề xuất |
|---|---|---|
| B01 | Khóa học chưa có danh sách buổi/version và đăng ký cha | P1: bulk hiện chỉ gom mọi lịch tương lai; bổ sung CourseOffering/Registration nếu cam kết bán theo khóa |
| B02 | Giờ mở cửa, ngày nghỉ, lịch bảo trì, coach leave/buffer | P2/CS: calendar/resource availability; trước demo công bố giới hạn phạm vi |
| B03 | Qualification coach theo sport | P2/CS: specialization free text không chứng minh đủ chuyên môn |
| B04 | Cancellation deadline, late-cancel, waitlist, max/day/week | P2/CS: không tự hardcode số; quota hiện là số class song song, không phải số buổi |
| B05 | Gói cấp quyền theo sport/số buổi, transferable, grace period | P2/CS: hiện chỉ tier/quota; có thể chọn không hỗ trợ nhưng phải ghi đặc tả |
| B06 | Refund requested/approved/paid và đối soát exception | P0: status REFUNDED hiện không chứng minh tiền đã trả |
| B07 | Job hết hạn subscription/reminder/reconciliation tự động | P1: không thấy job được đăng ký trong server.ts; phải tách effective-state khỏi stored-state |
| B08 | Freeze quota, số lần và hạn tối đa; upgrade khác freeze | P1: hiện SUSPENDED dùng cả hai nghĩa |
| B09 | Hủy lớp sau khi mua gói: học bù/credit/refund | P2/CS: payment theo membership nên không mặc định hoàn cả gói cho mỗi buổi hủy |
| B10 | Giới hạn/gắn chủ sở hữu file, retention, virus scan | P1 security: upload chỉ limit 10MB; không có file authorization |
| B11 | Đổi role sang MEMBER phải provision FREE | P1: create/register có, updateUser chỉ upsert profile |
| B12 | Training plan đúng khoảng ngày, kết quả trong thời hạn, coach-member relation | P1: datetime có kiểm tra định dạng nhưng chưa so start/end, trạng thái plan |
| B13 | Audit actor/reason/before-after cho sửa attendance/finance/schedule/role | P1: Notification không thay thế audit |
| B14 | Email verification/password reset/rate limit đăng nhập | P2/CS cho recovery; P1 chống lạm dụng khi public deployment |

# C. Inconsistent Logic

1. **C01 — effective subscription:** quota/membership-status lọc start≤now≤end; purchase chỉ status ACTIVE; members list chọn endDate xa nhất; FE ưu tiên PREMIUM rồi endDate, không xếp MEMBERSHIP trên FREE. Cùng member có thể thấy quyền khác nhau.
2. **C02 — renew vs purchase:** renew không dùng quy tắc downgrade/carry-over; FREE renewal đặc biệt sai thời điểm. Không thể chỉ sửa nút FE.
3. **C03 — plan disable:** DELETE chặn active subs; PATCH isActive=false bỏ qua guard. Cần quyết định có cho dừng bán mà bảo toàn hợp đồng cũ không; nếu có thì DELETE guard đang quá chặt, không phải mặc định cấm PATCH.
4. **C04 — self/admin refund:** 30% khi còn >15 ngày vs prorated là chính sách có thể hợp lệ; bug là không snapshot/ledger/cap và hóa đơn không đồng bộ, không phải khác tỷ lệ tự nó là lỗi.
5. **C05 — generic refund vs cancel subscription:** generic cancel invoice không cancel entitlement; cancel subscription refund không cancel/adjust invoice.
6. **C06 — readonly report:** list penalties/reports có lazy expire (ghi DB); cần mô tả tác dụng phụ và không coi GET hoàn toàn thuần đọc.
7. **C07 — input chuẩn hóa:** register lowercase email nhưng login/manager create không đồng nhất; phone/DOB giữa self-service và manager API khác validation; tên toàn khoảng trắng có thể qua min trước trim.
8. **C08 — anonymous feedback:** list thay member object nhưng spread `...f` vẫn giữ memberId; chưa ẩn danh thật. Người có roster có thể suy ra tác giả.
9. **C09 — feedback eligibility:** học class A với coach là đủ để review class B của coach, chưa check enrollment đúng class; BOOKED tương lai cũng được review. `classId ?? ""` để tìm nhưng create null khiến feedback không class có thể tạo lặp.
10. **C10 — report member:** `tierCounts.FREE = totalMembers - activeCount` ghi đè số FREE thật; với 10 member đều FREE active cho kết quả FREE=0. activeSubs cũng không lọc user active/role nên có thể đếm sai hoặc hiệu số âm.
11. **C11 — report revenue:** status REFUNDED bị loại toàn bộ khỏi SUCCESS sum dù chỉ hoàn 30%; note “refunds not yet deducted” không mô tả đúng hiệu ứng. Ngày thu dùng paidAt nhưng count/list dùng createdAt nên không phải cùng cohort.
12. **C12 — chronology:** Swagger mô tả thao tác/expiresAt khác code ở một số nhánh; source active import đáng tin hơn comment. App local đã tắt ETag và set no-store, vì vậy GET304 lịch sử không đủ kết luận bản deploy hiện tại lỗi token hay payment.

# D. Security / Authorization Logic

## Ma trận thực tế (không thay thế ownership)

| Luồng | Member | Coach | Staff | Manager |
|---|---|---|---|---|
| User administration | Không | Không | Không | Có, chặn self-disable/self-demote |
| Sport/Room/Plan mutation | Không | Không | Không (trừ bulk room transfer) | Có |
| Class/Schedule mutation | Không | Không | Có | Có |
| Book/bulk | Chính mình | Bị controller chặn | Chọn member | Chọn member |
| Cancel/transfer booking | Có ownership | Không | Có | Có |
| Attendance write/QR generate | Chỉ scan của mình | Assigned class | Read-only | Có |
| Payments ghi nhận | Checkout của mình | Không | Cash/bank | Cash/bank và status |
| Invoice/payment detail | Own | Bị chặn | Có | Có |
| Training GET | **Không scope** | **Không scope** | **Không scope** | Có |
| Feedback | Tạo/xóa own | Đọc | Đọc | Đọc/xóa moderation |

**D01 P0:** CRITICAL-03/04, response password hash phải loại bỏ trước demo public.

**D02 P1:** coach có thể GET `/enrollments/schedule/:scheduleId` của lớp không phụ trách: route cho COACH, controller/service không nhận actor để check assignment. `/members/:id` cũng cho coach bất kỳ mà không kiểm tra quan hệ. Khác với attendance roster đã scope đúng. Sửa scope ở service, không tin filter FE. Bằng chứng: enrollments.controller `getScheduleEnrollments`, enrollments.service:258, members.routes/controller/service.

**D03 P1:** `/uploads` là express.static công khai; file chat riêng ai biết URL cũng tải được. Upload không allowlist MIME/signature; file được ghi trước khi service kiểm tra người nhận, request bị từ chối vẫn có thể để file rác. Dùng object private/authenticated download, metadata owner/conversation, kiểm tra nội dung, cleanup, giới hạn storage. Rủi ro XSS phụ thuộc MIME/CSP thực tế, không khẳng định khai thác XSS đã được chứng minh.

**D04 P1:** socket chỉ authenticate lúc connect. Sau khóa/đổi role/token hết hạn, socket cũ còn tồn tại; public message không gọi active sender check vì assertCanContact trả sớm khi không receiver. Public broadcast/presence vẫn gửi socket cũ. Phải disconnect khi revoke hoặc revalidate event/session; typing cũng cần check contact và rate limit.

**D05 P1:** changePassword không revoke refresh tokens; refresh không rotation; logout không vô hiệu access token hiện có. Có thể chấp nhận access sống ngắn sau logout nếu đặc tả nói rõ, nhưng đổi mật khẩu vì lộ account cần revoke session. Hai login cùng user/cùng giây có thể sinh refresh JWT giống nhau (không jti) và vướng unique hash — cần test.

**D06 P0 cấu hình:** mock-confirm có BE flag nhưng không ràng NODE_ENV. Nếu bật nhầm live, member tự xác nhận tiền của mình. Không kết luận production đang bật. Tách môi trường/DB/account, chặn khi production bằng startup guard; ẩn nút FE không phải security control.

**D07 P2:** HMAC verify kiểm tra chữ ký timestamp nhưng chưa kiểm tra độ mới timestamp. Unique event chống xử lý lại event đã thấy, không hoàn toàn thay freshness policy. Cần chốt window phù hợp retry nhà cung cấp, kiểm thử contract provider độc lập. Không suy ra sai signature spec chỉ từ comment.

**Điểm đã làm đúng:** HTTP authenticate đọc DB kiểm tra user active và role từng request; memberId booking tự lấy từ session; owner invoice/payment/subscription cancellation; coach ghi attendance phải assigned; SQL weekday dùng Prisma.sql/parameters; webhook API key/HMAC timing-safe và raw body.

# E. Race Conditions

| ID | Hai thao tác đồng thời | Đánh giá và hướng sửa |
|---|---|---|
| E01 | Hai người lấy chỗ cuối | Đã có schedule advisory lock + count sau lock, không kết luận overbook cơ bản; cần test DB thật |
| E02 | Một member book hai class vượt quota | Đã có memberQuota lock; điểm tốt |
| E03 | Hai transfer từ cùng enrollment | Có memberClass lock và CAS BOOKED; điểm tốt |
| E04 | Book/bulk vs cancel/update/complete schedule | CRITICAL-12; chia sẻ lock và re-read |
| E05 | Payment A/B settle cùng member | Lock payment không khóa member; CRITICAL-08 |
| E06 | Double-click checkout cùng plan | find pending rồi create không cùng lock/unique pending → hai đơn; idempotency key/member-plan lock |
| E07 | Đơn hết TTL vs webhook | checkout update FAILED không CAS/lock payment → có thể đè SUCCESS vừa commit |
| E08 | Hai staff gia hạn | Có thể duplicate subscription/payment; member lock + request idempotency |
| E09 | Hai manager set primary coach từ lớp chưa có primary | updateMany 0 rows rồi hai insert primary; partial unique và class lock |
| E10 | Assign coach vs create schedule | Conflict check assign ngoài tx/không cùng resource lock → double-book coach |
| E11 | Giảm capacity vs booking | Capacity lấy cũ; serialize capacity và booking |
| E12 | Hai manager disable lẫn nhau | count active managers ngoài tx đều thấy 2 → còn 0; lock invariant manager-system |
| E13 | Hai request generate manual code | Revoke/create không atomic → nhiều mã valid; schedule lock/transaction |
| E14 | Burst sai manual code | Count rồi insert không atomic → vượt rate limit; atomic counter/limiter |
| E15 | Penalty revoke đồng thời | Đọc penalty trước lock, không reread/CAS → ghi đè actor/lặp notification |
| E16 | Reminder scan nhiều instance | find notification rồi create không unique → gửi trùng; event dedupe key |
| E17 | Cancel sub vs booking | Không chung member entitlement lock → chỗ mới có thể lọt sau cancel sweep |
| E18 | Bulk transfer room vs sửa/hủy lịch | Danh sách đọc trước resource lock, room snapshot ngoài tx; cần re-read và lock lịch nguồn/đích |

Không dùng “đã có transaction” làm bằng chứng không race. Transaction chỉ đủ khi isolation/locks/conditional write bảo vệ invariant và mọi writer tuân thủ cùng giao thức.

# F. Transaction Problems

- **F01 P1:** common activation và single booking gọi createNotification qua global prisma khi transaction chưa commit. Notification có thể tồn tại khi business tx rollback hoặc mất khi process chết. Outbox ghi trong tx, worker gửi sau commit; `catch(()=>{})` không bảo đảm delivery.
- **F02 P1:** auth.updateMe/member.updateMember/coach.updateCoach cập nhật User rồi Profile riêng, lỗi giữa chừng gây partial update; wrap transaction.
- **F03 P0:** đổi payment status/refund subscription không cùng orchestration entitlement/invoice/refund ledger (A05/A02).
- **F04 P1:** manual code rotate gồm revoke/create riêng; rollback thiếu.
- **F05 P2:** sau course commit còn query quota; query lỗi có thể khiến client nhận fail dù đã đăng ký. Trả committed result rõ, retry idempotent/recover by registration ID.
- **F06 P1:** upload file và message DB không atomic; dùng temporary upload/finalize + cleanup. Không thể giải quyết filesystem rollback chỉ bằng Prisma transaction.
- **F07 điểm tốt:** activity-plan transaction tạo cả class/coaches/schedules; course all-or-nothing; transfer fail rollback giữ chỗ cũ; webhook claim và payment/invoice/sub cùng tx cho nhánh thành công bình thường; penalty apply thu hồi chỗ cùng tx.

# G. Database Integrity Problems

1. **G01 P0:** migration trùng cột/FK A13. Migration replace MoMo còn đổi dữ liệu lịch sử MOMO thành SEPAY: sai provenance giao dịch; giữ legacy gateway, không đổi tên nhà cung cấp của khoản đã thu chỉ để đổi enum.
2. **G02 P0:** thiếu immutable offer snapshot, refund ledger, bank movement uniqueness xuyên reconciliation.
3. **G03 P1:** Enrollment.classId và scheduleId có FK độc lập; DB không bảo đảm schedule.classId = enrollment.classId. Chọn bỏ field trùng hoặc composite FK; API hiện thường điền đúng nhưng script/bug khác có thể phá.
4. **G04 P1:** không unique một primary coach/class; không constraint entitlement interval không overlap. Không thêm unique ACTIVE mù quáng khi renew vẫn dùng ACTIVE tương lai.
5. **G05 P1:** feedback unique(coach,member,class) có class nullable; upsert lookup empty string khác NULL; sửa explicit scope/partial index, không chỉ gọi upsert.
6. **G06 P2:** không DB CHECK cho range/amount/capacity/rating/quota trong migration đã kiểm; API validation không bảo vệ scripts/import. Thêm constraint sau audit dữ liệu cũ.
7. **G07 P1:** attendance không link enrollment; history coach không theo thời gian; penalty released IDs JSON không có FK cho từng ID. Audit sửa/xóa không đầy đủ.
8. **G08 P2:** timestamps schema/migration là TIMESTAMP(3) không timezone; cần quy ước UTC nhất quán và query conversion đúng, không tự migrate kiểu cột khi chưa biết dữ liệu đang lưu nghĩa gì.
9. **G09 P2:** plan name kiểm tra findFirst nhưng không unique DB; song song có thể trùng. Tên sport/room unique có phân biệt hoa/thường, cần policy normalization.
10. **G10 P1:** cascade Attendance/Training/Feedback là nguy cơ mất history qua admin script; API soft delete đã giảm rủi ro. Quy định retention/anonymization và restricted deletes cho tài chính.

# H. Status Transition Problems

| Entity | Transition | Hiện tại | Quy tắc đề xuất |
|---|---|---|---|
| User | active→inactive | HTTP chặn login/request; không xử lý socket/lịch coach | Revoke session/socket; kế hoạch thay coach/chỗ học |
| Subscription | ACTIVE→SUSPENDED | Lưu ngày tròn còn lại | FreezePeriod, chính sách rounding rõ |
| Subscription | SUSPENDED→ACTIVE | Null remainingDays thành 0, không check gói khác | Chỉ resume freeze hợp lệ; không resume entitlement đã chuyển |
| Subscription | CANCELLED/EXPIRED→ACTIVE | Generic update cho qua | Chặn; renewal tạo hợp đồng mới |
| Subscription | ACTIVE→EXPIRED | Manager có thể set; không thấy scheduled job | Derived expiry + job idempotent, không đổi quyền hồi tố |
| Subscription | ACTIVE→CANCELLED | Hủy mọi future booking của member | Chỉ hủy booking không còn được entitlement nào bảo vệ |
| Subscription | Renew→ACTIVE tương lai | Có | QUEUED; activate theo thời gian, tránh pick sai |
| Payment | PENDING→SUCCESS | Webhook activation; generic status chỉ invoice | Một settlement command theo nguồn hợp lệ |
| Payment | PENDING→REFUNDED | Schema/service cho phép | Chặn nếu chưa ghi nhận tiền; refund là aggregate riêng |
| Payment | SUCCESS→REFUNDED | Ghi enum, không chứng minh chi tiền | REFUND_PENDING→PARTIALLY/FULLY_REFUNDED theo ledger |
| Payment | PENDING→FAILED | Có expiry lazy, chưa CAS | Compare-and-set với payment lock; phân biệt expired/failed |
| Schedule | SCHEDULED→COMPLETED | Chỉ sau end; tạo ABSENT/complete bookings | Giữ, thêm lock/CAS/correction policy |
| Schedule | SCHEDULED→CANCELLED | Hủy BOOKED trong tx, gửi notice | Giữ, khóa với booking/scan, xử lý attendance sớm |
| Schedule | CLOSED→SCHEDULED | Thường bị chặn service | Chỉ reopen command đặc quyền nếu đặc tả cần |
| Enrollment | CANCELLED→BOOKED | Rebook/reactivate hợp lệ sau eligibility | Giữ, audit lý do/actor, course semantics rõ |
| Enrollment | BOOKED→COMPLETED | Theo complete schedule | Không suy ra PRESENT từ COMPLETED |
| Attendance | ABSENT/LATE/EXCUSED→PRESENT | Scan upsert cho phép | Cấm self-service overwrite; correction riêng |
| Invoice | ISSUED→CANCELLED | Generic refund, không đồng nhất các luồng | Adjustment/refund document, lưu bản gốc |
| Penalty | APPLIED→REVOKED/EXPIRED | Có; PENDING chỉ reserved | CAS; revalidate restore; không phạt lặp cùng bằng chứng |
| Webhook event | PENDING→PROCESSED/MISMATCH/LATE/IGNORED | Có, duplicate dedupe | PROCESSED không đồng nghĩa quyền đã cấp; case resolution riêng |
| Class/Room/Sport/Plan | active→inactive | boolean, guard khác nhau | Tách ngừng bán, ngừng mở lớp, vận hành, archive khi cần |

Booking không cần sao chép tất cả enum trong đề bài: giữ enrollment COMPLETED và attendance PRESENT/ABSENT riêng là hợp lý, miễn API/FE không đánh đồng hai khái niệm.

## Time/date/timezone

- Quyền hiện tại là **timestamp**, không phải “hết ngày hiển thị”: `endDate >= now`; boundary bằng endDate vẫn hợp lệ. Không được ghi “còn dùng hết hôm nay” nếu hết 09:00.
- Booking kiểm tra endDate ≥ **startTime**, không endTime; buổi qua thời điểm hết hạn vẫn được đặt. Đây là policy cần chốt, không tự coi bao phủ endTime là luật sẵn có.
- `setDate` và `Math.ceil(ms/86400000)` trộn calendar-day/server-local với 24h; cộng dư có thể tặng gần một ngày mỗi lần switch/freeze. Chuẩn hóa cách tính duration/remaining value.
- `date=YYYY-MM-DD` ở schedule parse thành UTC midnight rồi setDate local; không phải VN 00:00→24:00. Report revenue đã dùng +07 boundary là điểm tốt, nhưng validator report còn cho timestamp khiến service nối chuỗi ngày sai.
- Weekday SQL `timestamp_without_tz AT TIME ZONE 'Asia/Ho_Chi_Minh'` diễn giải giá trị thành giờ VN rồi trả timestamptz, không phải chuyển UTC-naive sang VN-local. Với storage UTC và session UTC, phép này dịch ngược 7h; ví dụ UTC thứ Bảy 18:00 tương ứng VN Chủ nhật 01:00 nhưng filter có thể tính thứ Bảy. Cần xác minh `SHOW TIMEZONE`, kiểu cột và dữ liệu, rồi dùng conversion UTC→VN đúng hoặc timestamptz chuẩn. Không khẳng định đây là nguyên nhân duy nhất của ảnh lịch lệch trước đó.
- FE memberCalendar có test thứ Bảy/Chủ nhật và UTC boundary đạt; điều đó không xác nhận SQL filter BE đúng.

# I. UX Flow Problems caused by Backend Design

1. **Class wizard:** không cần bỏ Sport/Class reusable; API activity-plan đã hỗ trợ create-all transaction. Nên dùng wizard trên API này, thêm DRAFT→PUBLISHED khi đủ coach/room/lịch. Tạo class riêng hiện có thể broadcast NEW_CLASS khi chưa có buổi nào, gây “có lớp nhưng không đăng ký được”.
2. **“Trọn khóa” hiện không phải hợp đồng khóa:** bulk lấy các buổi tương lai tại thời điểm đăng ký; người đến sau học ít buổi; thêm lịch sau không tự thêm enrollment; vẫn có API hủy một slot. UI phải nói đúng hoặc BE thêm course registration/version.
3. **Payment pending không đủ thông tin:** chờ ngân hàng, đã thu cần đối soát, sai tiền, quá hạn là các trạng thái trải nghiệm khác nhau. Thêm action/status từ BE; không chỉ toast “thất bại, tạo đơn mới” khi có thể đã trả tiền.
4. **Gói đang đăng ký:** FE badge hiện dựa effective subscription, không hiện gói ACTIVE tương lai là “đang dùng”; cần nhãn “đã mua, có hiệu lực từ ...” riêng. Quyền hiện hành nên do BE resolve thay vì mỗi trang tự sort.
5. **Chat:** unread phòng chung chưa thể biểu diễn bằng một isRead; cần read cursor/receipt từng người. Không phân trang messages khiến mở hội thoại lâu năm tải toàn bộ. File lưu local, URL dựa req.protocol/host có thể sai sau reverse proxy; không kết luận host đang cấu hình sai khi chưa kiểm tra triển khai.
6. **Validation API:** lỗi không UUID/date sai có thể trở thành Prisma 500 thay vì field error. Toast mỗi polling error có thể gây nhiễu; tách background status và lỗi thao tác chủ động, luôn có mã đơn/correlation id.
7. **Create request timeout:** FE không nên hiểu timeout là chưa tạo; dùng idempotency key/status recovery. Notification “thành công” phải sau commit và theo business outcome, không chỉ HTTP200.

## Mô phỏng bốn flow end-to-end

| Flow | Hành vi hiện tại từ source | Chốt nghiệp vụ cần có |
|---|---|---|
| 1. Manager tạo sport/class/schedule/coach → booking → payment → check-in → complete | Có thể tạo schedule chưa coach; assign sau kiểm conflict riêng. Booking yêu cầu gói sẵn có, nên “book trước rồi trả gói” không phải flow hiện hỗ trợ. Scan không window; complete sau end tạo ABSENT thiếu và enrollment COMPLETED | Publish khi đủ resource; mua gói trước booking hoặc thiết kế reservation hold có TTL riêng; QR window/correction; không gọi COMPLETED là attended |
| 2. Mua gói → pay → active → book → cancel → book khác | Happy path có; lỗi FREE carry-over; cancel chỉ trước start; book lại check quota/conflict; transfer chỉ cùng class | Tách cancel+new booking khác class với atomic transfer nếu cần; idempotent purchase, snapshot quyền và cancellation policy |
| 3. Manager cancel schedule | Tx cancel lịch + BOOKED, notification member sau đó; phòng trống theo query status; không tự refund payment membership; attendance có sẵn không được giải quyết | Khóa với booking/scan; reason/audit, thông báo coach, makeup/credit policy; không refund toàn gói vô điều kiện |
| 4. Subscription qua endDate | Effective queries chặn booking/scan; login vẫn hoạt động; status có thể còn ACTIVE; purchase có thể chặn downgrade dựa gói hết hạn; không thấy sweep future bookings/job expiry | Account access khác entitlement; resolver chung; xử lý booking chịu ảnh hưởng của dời lịch/freeze, notification và không sửa attendance lịch sử |

# J. Edge Cases — 60 trường hợp cần test

Các mục ghi “nguy cơ/cần test” chưa được chạy BE integration. Cột cuối là oracle đề xuất, không phải kết quả test thực thi.

| # | Tình huống | Hiện tại → Kỳ vọng |
|---|---|---|
| J01 | FREE mới mua 30 ngày | Cộng ~3650 ngày → chỉ entitlement trả phí |
| J02 | Renew từ FREE | Bắt đầu sau FREE → không đợi 10 năm |
| J03 | Manager hủy gói cộng dư | Refund có thể >paid → cap và ledger |
| J04 | Self cancel còn đúng 15 ngày | Không refund → test boundary theo policy hiện tại |
| J05 | Self cancel còn 15 ngày +1 giây | ceil thành16, có refund → chốt tính ngày rõ |
| J06 | Premium hết hạn nhưng status ACTIVE, mua Membership | Có thể chặn downgrade → resolver theo thời gian |
| J07 | Gói tương lai ACTIVE cùng gói hiện tại | Resolver purchase có thể chọn sai → QUEUED |
| J08 | Double-click checkout | Có thể hai PENDING → cùng order idempotent |
| J09 | Webhook cùng sepayId hai lần | Unique claim → một settlement; test lại |
| J10 | Webhook khác id cùng payment | Payment lock+SUCCESS guard → không cấp hai gói |
| J11 | Hai payment cùng member settle | Nguy cơ hai ACTIVE → member serialization |
| J12 | Amount thiếu/thừa | MISMATCH, PENDING → reconciliation case và hướng dẫn |
| J13 | Chuyển hai lần một mã | Lần2 duplicate payment → ghi unmatched credit/hoàn, không mất vết tiền |
| J14 | Một transaction chứa hai mã | Reconcile includes → cấm double allocation |
| J15 | Đổi giá khi QR pending | Invoice/benefit khác offer → snapshot |
| J16 | Plan inactive khi tiền đến | Có thể vẫn cấp theo plan live → thực hiện offer hoặc review, không im lặng |
| J17 | Plan bị hard-delete khi pending | SUCCESS thiếu gói → PAID_REQUIRES_REVIEW |
| J18 | User bị khóa sau checkout | Settlement vẫn cấp → policy bảo toàn tiền và review quyền |
| J19 | Tiền đến sau TTL nhưng chưa tạo đơn mới | PENDING vẫn settle → TTL thống nhất theo timestamp |
| J20 | Tiền đến cùng lúc checkout đóng đơn | FAILED có thể đè SUCCESS → CAS |
| J21 | Reload/đóng modal khi pending | FE có persistence/poll → xác minh exact one checkout |
| J22 | Webhook đến trước checkout response | GET cần trả SUCCESS → UI không lùi về PENDING |
| J23 | Token hết hạn lúc polling | FE shared refresh → một refresh, giữ mã đơn |
| J24 | API SePay timeout/429 | Log+giữ pending → backoff/queue và trạng thái đối soát |
| J25 | Generic SUCCESS cho SePay | Invoice không sub → chặn bypass |
| J26 | Refund payment trực tiếp | Subscription còn active → đồng bộ quyền |
| J27 | Refund chưa chuyển tiền thật | Đã REFUNDED → refund pending/paid riêng |
| J28 | Hai member chỗ cuối | Có lock → chính xác một thành công |
| J29 | Một member cùng lúc vượt quota | Có member lock → không vượt limit |
| J30 | Book cùng schedule hai lần | Unique/duplicate guard → không hai record |
| J31 | Rebook CANCELLED | Reactivate → check lại mọi eligibility |
| J32 | Book vs cancel schedule | Stale schedule → không BOOKED trên CANCELLED |
| J33 | Book khi schedule vừa bắt đầu sau chờ lock | Thời gian check cũ → kiểm tra now sau lock |
| J34 | Subscription hết trước buổi | Đã chặn start coverage → test bằng API |
| J35 | Hết hạn giữa buổi | Hiện check start → chốt end coverage hay admission-time |
| J36 | Đổi giờ sau booking gây overlap | Không check member → reject/impact workflow |
| J37 | Dời lịch sau hạn gói | Booking còn → bù quyền/rebook có policy |
| J38 | Class capacity30→10 đã book20 | Update cho qua → reject |
| J39 | Room capacity30→10, class20 | Update cho qua → reject/transfer |
| J40 | Hai lịch cùng class không coach, khác room | Room/coach checks có thể không bắt → class overlap guard |
| J41 | Assign hai primary đồng thời | Có thể hai primary → unique+lock |
| J42 | Coach inactive trước ngày dạy | User disable vẫn để assignment → substitution workflow |
| J43 | Xóa coach cuối của class | Assignment bị xóa → reject/pause registration |
| J44 | Room đang có buổi ongoing bị disable | Guard upcoming bỏ ongoing → kiểm tra end>now |
| J45 | Tạo lịch quá khứ | Validation không cấm → chỉ import/correction đặc quyền |
| J46 | Thứ Bảy UTC18h, VN Chủ nhật01h | Weekday SQL nguy cơ lệch → VN đúng |
| J47 | Buổi qua nửa đêm/ngày cuối tháng | Test date range và overlap → không mất/trùng buổi |
| J48 | Course có một buổi full | Bulk all-or-nothing → không đăng ký phần còn lại |
| J49 | Thêm buổi sau đăng ký course | Không tự có enrollment → course amendment policy |
| J50 | QR hợp lệ nhưng buổi tuần sau | Scan được nếu đủ điều kiện khác → ngoài window phải từ chối |
| J51 | QR expired/tampered/sai type | JWT checks → từ chối, không ghi attendance |
| J52 | Quét lặp sau manager EXCUSED | Bị PRESENT overwrite → giữ kết quả/correction |
| J53 | Screenshot QR cũ sau UI rotate55s | JWT còn10 phút → server revoke/version nếu yêu cầu |
| J54 | Hai generate manual code | Có thể nhiều active code → một generation hợp lệ |
| J55 | Hết hạn/đổi gói sau attendance | Analytics thay quá khứ → lịch sử ổn định |
| J56 | Gỡ penalty khi gói đã hết | Restore chưa check entitlement → không khôi phục chỗ vô hiệu |
| J57 | Member GET training của người khác | Hiện lấy được →403/own scope |
| J58 | Anonymous feedback + roster | memberId còn → ẩn định danh tác giả |
| J59 | Account khóa khi socket mở | Public chat còn dùng → revoke connection |
| J60 | Fresh migration/build trên máy khác | Duplicate planId/stale client → CI dựng sạch phải đạt |

# K. Lecturer Questions — 35 câu phản biện

Mỗi câu dưới đây có câu trả lời đúng với source hiện tại, không dùng lời hứa như đã implement.

| # | Câu hỏi | CURRENT SYSTEM RESPONSE | EXPECTED RESPONSE |
|---|---|---|---|
| K01 | Vì sao mua30 ngày được10 năm? | FREE carry-over không bị loại | FREE không chuyển paid credit, test regression |
| K02 | Có thể hoàn hơn tiền đã thu không? | Công thức hiện có thể tính như vậy | Refund ≤unrefunded paid amount, có ledger |
| K03 | Một member có mấy ACTIVE? | Không DB invariant; renew/parallel có thể nhiều | Một effective entitlement hoặc interval không overlap |
| K04 | Gia hạn khác mua mới ở đâu? | Hai service logic khác, renew bỏ switch rules | Chung engine, explicit intent và effectiveAt |
| K05 | Đổi package có sửa quyền100 người đã mua? | Quota live đổi; start/end/tier đã snapshot một phần | Versioned contracts, quyền cũ không đổi ngoài amendment |
| K06 | Giá đổi khi đang chuyển khoản? | Amount cũ, invoice/benefit mới | Offer snapshot nhất quán |
| K07 | Webhook gửi hai lần? | sepayId unique và payment lock chống trùng | Giữ, test concurrent và replay xuyên kênh |
| K08 | Hai đơn khác nhau nhận cùng bank tx? | Reconcile chưa có unique allocation | Bank transaction unique + allocation invariant |
| K09 | Tiền đã về mà downgrade bị chặn? | PENDING, event PROCESSED, note/notify | Paid-review case, không yêu cầu chuyển lại |
| K10 | Nhân viên xác nhận thanh toán có tạo gói không? | Generic SUCCESS chỉ invoice | Command settlement thống nhất |
| K11 | REFUNDED đã thực sự trả tiền chưa? | Chỉ status/note, không payout proof | Refund workflow có bằng chứng và trạng thái |
| K12 | Một chỗ cuối hai người tranh? | Advisory lock schedule rồi count | Chính xác1 thành công trong integration test |
| K13 | Đang book thì manager hủy lịch? | Không chung lock, có stale read | Serialize state và booking |
| K14 | Lịch đổi khi20 người đã đăng ký? | Check room/coach, notify, chưa check member | Impact preview/eligibility/rebooking |
| K15 | Hạ capacity dưới số đã đặt? | Chưa chặn update | Reject hoặc giải quyết chuyển chỗ trước |
| K16 | Class không có coach được mở không? | Standalone create/schedule không bắt đủ coach | Draft/publish hoặc policy explicitly cho phép |
| K17 | Hai lớp cùng coach trùng giờ? | Schedule create có lock; assign path yếu hơn | Tất cả writer dùng chung resource locking |
| K18 | Coach nghỉ việc ngày mai? | Disable account không thay lịch | Reassign/cancel và notify trước thời điểm dạy |
| K19 | Coach dạy bơi có đủ chứng chỉ? | Free-text specialization, không qualification model | Chứng chỉ/skill mapping nếu nằm trong scope |
| K20 | Quét QR tuần sau có được không? | Có thể, thiếu server window | Reject ngoài cửa sổ |
| K21 | Quét hai lần là idempotent chưa? | Không duplicate row nhưng overwrite status | Không sửa kết quả đã tồn tại bằng scan |
| K22 | QR đổi55s sao ảnh cũ còn dùng? | JWT TTL600s, UI rotate không revoke | Server session generation/revocation theo policy |
| K23 | Member đổi id xem hồ sơ luyện tập khác? | GET training không scope | Derive member from authenticated actor |
| K24 | API có trả mật khẩu không? | Một số nested User trả password hash | DTO allowlist, không hash/password/token trong response |
| K25 | Feedback ẩn danh thật không? | Vẫn memberId ngoài nested member | Public DTO bỏ identifier có thể nối ngược |
| K26 | Điểm chuyên cần có đổi khi gói hết hạn? | Có thể vì analytics dùng status hiện tại | Historical coverage độc lập current status |
| K27 | Đăng ký trọn khóa là entity nào? | Bulk Enrollment theo lịch tương lai | Registration cha, offering/version cố định |
| K28 | Thêm buổi sau khi member đăng ký? | Không tự thêm enrollment | Amendment/acceptance/reservation policy |
| K29 | Hủy lịch có refund không? | Không tự refund membership | Chính sách học bù/credit, không hoàn cả gói mặc định |
| K30 | Subscription hết hạn có khóa app? | Không khóa login, chỉ quyền booking/scan | Giữ đọc lịch sử/thanh toán, chặn quyền sử dụng đúng |
| K31 | Notification thành công trước rollback? | Global prisma có thể ghi ngoài tx | Transactional outbox |
| K32 | Login hai thiết bị cùng giây? | JWT refresh có thể giống, unique collision | jti ngẫu nhiên/session riêng và rotation |
| K33 | Khóa user có khóa socket cũ không? | Handshake-only, chưa | Disconnect/revalidate session |
| K34 | Máy giảng viên migrate sạch được không? | Chain hiện duplicate Payment.planId; typecheck fail | CI clean-db replay+generate+build |
| K35 | 43 FE test pass có chứng minh giao dịch thật không? | Không; unit/mocks, BE e2e chưa chạy | Isolated DB integration/concurrency và sandbox provider evidence |

# L. Recommended Business Rule Specification

Đây là **đặc tả đề xuất** để chốt cùng chủ dự án, không tuyên bố đã implement. Những con số như cancellation window/coach buffer cần cấu hình, không tự quyết thay nghiệp vụ.

## User / Member

- BR-USER-001: HTTP và socket MUST kiểm tra account active/current role; revoke session khi khóa/đổi quyền.
- BR-USER-002: Public DTO MUST NOT chứa password hash, refresh token, secret, private gateway payload.
- BR-USER-003: Đổi role/disable MUST bảo toàn ít nhất một manager active dưới concurrency và có audit actor/reason.
- BR-USER-004: Email/phone/name/DOB MUST chuẩn hóa và validate cùng quy tắc mọi endpoint; unique DB là chốt cuối.
- BR-USER-005: Đổi mật khẩu do bảo mật MUST revoke session theo policy; refresh token có jti, expiry và rotation/reuse policy.
- BR-MEMBER-001: Tạo/chuyển role MEMBER MUST provision profile và FREE entitlement atomically nếu FREE là invariant.
- BR-MEMBER-002: FREE MUST NOT có giá trị trả phí hay refundable balance.
- BR-MEMBER-003: Profile/training/financial history MUST scoped theo owner/authorized relationship.
- BR-MEMBER-004: Bị khóa không xóa lịch sử thanh toán; xử lý pending order/bookings theo case có audit.

## Coach / Sport

- BR-COACH-001: Assign MUST dùng coach active và kiểm tra qualification nếu được yêu cầu cho sport.
- BR-COACH-002: Không được trùng lịch; buffer/leave MUST áp dụng nhất quán khi tạo/sửa/assign/transfer.
- BR-COACH-003: Một published class MUST có đúng một primary hoặc policy nhiều primary được đặc tả, enforce DB.
- BR-COACH-004: Đổi coach MUST lưu assignment hiệu lực theo buổi/thời gian, không sửa attribution lịch sử.
- BR-COACH-005: Disable coach có lịch chưa kết thúc MUST yêu cầu reassign/cancel plan.
- BR-SPORT-001: Sport là catalog reusable; areaTypes MUST có ít nhất một enum hợp lệ, không trùng.
- BR-SPORT-002: Thu hẹp/disable sport MUST không làm published class invalid; cần xử lý cùng transaction/lock.

## Class / Schedule / Room

- BR-CLASS-001: Class MUST thuộc sport phù hợp area, capacity dương; thay đổi type/area có impact validation.
- BR-CLASS-002: DRAFT có thể chưa đủ resource; PUBLISHED MUST có coach, lịch, phòng và registration window.
- BR-CLASS-003: Giảm capacity MUST NOT thấp hơn booked seats ở bất kỳ buổi còn hiệu lực.
- BR-CLASS-004: CourseOffering MUST định danh khóa/cohort, phiên bản danh sách buổi và chính sách join-late.
- BR-SCHEDULE-001: startTime < endTime; timestamp API MUST có offset; persisted instant có quy ước UTC.
- BR-SCHEDULE-002: Mọi schedule MUST phù hợp room/coach/class availability và center calendar.
- BR-SCHEDULE-003: Room/coach/class MUST NOT có overlap [start,end); khóa dùng chung cho mọi writer.
- BR-SCHEDULE-004: Tạo lịch quá khứ MUST chỉ qua quyền import/correction riêng; horizon cấu hình.
- BR-SCHEDULE-005: Sửa lịch có booking MUST validate member conflict, entitlement, attendance và notify tác động.
- BR-SCHEDULE-006: Cancel/complete MUST là conditional transition dưới shared schedule lock, atomic với enrollment.
- BR-SCHEDULE-007: Complete chỉ sau end; attendance corrections sau chốt MUST có actor/reason/history.
- BR-ROOM-001: Room active/area/capacity MUST phù hợp class khi create, update và bulk transfer.
- BR-ROOM-002: Maintenance MUST là interval unavailable; buổi ongoing cũng phải được xem là engagement.
- BR-ROOM-003: Disable/reduce capacity MUST giải quyết lịch ảnh hưởng trước, không chỉ sửa boolean.

## Booking / Course registration

- BR-BOOKING-001: Member MUST active; subscription MUST effective theo resolver chuẩn; check dưới lock khi ghi.
- BR-BOOKING-002: Entitlement MUST bao phủ thời điểm admission hoặc toàn buổi theo policy đã chọn; khuyến nghị toàn buổi cho course.
- BR-BOOKING-003: Tier/sport/quota/penalty MUST được xác thực ở BE; không tin FE canBook.
- BR-BOOKING-004: Chỉ future SCHEDULED/published/open-registration được book; đọc lại sau lock.
- BR-BOOKING-005: Unique member+schedule; confirmed seats MUST NOT vượt capacity dưới concurrency.
- BR-BOOKING-006: Member MUST NOT có overlap; quota là DISTINCT class với definition rõ cho ongoing/future.
- BR-BOOKING-007: Bulk course MUST all-or-nothing, idempotent và gắn CourseRegistration cùng course version.
- BR-BOOKING-008: Cancel/late-cancel/transfer MUST có deadline, status matrix và audit; transfer fail giữ chỗ cũ.
- BR-BOOKING-009: Khi cancel entitlement MUST chỉ hủy booking không còn quyền khác bao phủ; giữ history.
- BR-BOOKING-010: Waitlist nếu có MUST allocate dưới cùng capacity lock; không overbook từ worker.

## Attendance / QR / Penalty

- BR-ATTENDANCE-001: Attendance MUST gắn eligible enrollment và đúng schedule; không nhận memberId tự do ở scan.
- BR-ATTENDANCE-002: Server MUST kiểm tra attendance window, active account, schedule state và entitlement theo policy.
- BR-ATTENDANCE-003: Scan trùng MUST trả kết quả cũ; không đổi ABSENT/LATE/EXCUSED đã chốt.
- BR-ATTENDANCE-004: Late threshold lấy server time; manual override MUST có actor/reason/audit.
- BR-ATTENDANCE-005: Analytics MUST dùng historical entitlement intervals, loại freeze/cancelled sessions, không biến đổi bởi status gói hôm nay.
- BR-ATTENDANCE-006: Penalty MUST dựa sample đã chốt; unique evidence window chống phạt lặp, appeal/revoke CAS.
- BR-ATTENDANCE-007: Restore chỗ MUST recheck membership/tier/time/capacity/conflict; quota exemption phải explicit, không tự suy diễn.
- BR-QR-001: Credential MUST signed, schedule-bound, audience/type-bound, expiry server-side; secret tách theo purpose là khuyến nghị.
- BR-QR-002: Rotation MUST có generation/revocation nếu cam kết QR cũ vô hiệu; refresh UI không đủ.
- BR-QR-003: QR screenshot vẫn có thể chia sẻ trong window; không cam kết chứng minh hiện diện vật lý nếu không thêm biện pháp phù hợp.
- BR-QR-004: Manual code rotate MUST atomic; rate limit theo member/IP/session và chống denial-of-service mã lớp.

## Package / Subscription

- BR-PACKAGE-001: Published offer MUST immutable/versioned: price/currency/duration/tier/quota/benefits/refund policy.
- BR-PACKAGE-002: Ngừng bán không thay đổi hợp đồng đã mua; pending quote honor hoặc review rõ ràng.
- BR-PACKAGE-003: Currency precision MUST thống nhất; VND quote/settlement/invoice không tự round khác nhau.
- BR-SUB-001: Một member MUST có một effective entitlement hoặc tập non-overlap được đặc tả; tương lai dùng QUEUED.
- BR-SUB-002: Payment PENDING/FAILED MUST NOT cấp paid entitlement; tiền đã thu nhưng lỗi activation phải có review state.
- BR-SUB-003: Renew/upgrade/purchase MUST qua chung engine và member lock/idempotency.
- BR-SUB-004: Carry-over chỉ dùng giá trị paid chưa tiêu thụ; FREE=0; chuyển tier cần value-conversion policy rõ.
- BR-SUB-005: Freeze khác replaced/upgraded; lưu freeze intervals/remaining value; không resume phần đã chuyển sang gói mới.
- BR-SUB-006: CANCELLED/EXPIRED không được generic reactivate; correction/renewal có audit riêng.
- BR-SUB-007: Expiry effective theo timestamp độc lập background job; job chỉ đồng bộ stored state/notice idempotent.
- BR-SUB-008: Hợp đồng tương lai không được làm mất quyền gói hiện tại ngay khi mua.

## Payment / Invoice / Notification

- BR-PAYMENT-001: Checkout MUST dùng snapshot offer, idempotency key và immutable expiresAt/bank receiving identity.
- BR-PAYMENT-002: Settlement MUST xác thực provider, amount/account/order và một bank transaction chỉ allocate một lần xuyên webhook/reconcile.
- BR-PAYMENT-003: Chốt paid/subscription/invoice/outbox MUST atomic; mọi writer tuân thủ payment+member lock order.
- BR-PAYMENT-004: Tiền về sai/thừa/thiếu/muộn MUST lưu reconciliation case; không đồng nhất “chưa nhận” với “đã nhận cần xử lý”.
- BR-PAYMENT-005: Refund MUST có requested/approved/paid/failed, amount/reference/audit; tổng refund không vượt net paid.
- BR-PAYMENT-006: Generic enum PATCH MUST NOT bypass settlement; payment pending không refund như đã thu.
- BR-PAYMENT-007: Mock MUST không chạy trên production/live DB; backend guard, không dựa FE flag.
- BR-PAYMENT-008: Invoice MUST phản ánh giá/số tiền snapshot; adjustment không xóa provenance; report có gross/refund/net và date semantics.
- BR-PAYMENT-009: Reconciliation MUST có bounded retry/global limiter/multi-instance coordination; không lệ thuộc việc người dùng mở modal.
- BR-NOTIFICATION-001: Business event MUST ghi outbox trong transaction, gửi sau commit, retry và dedupe key.
- BR-NOTIFICATION-002: Message MUST mô tả outcome thật, không báo activated khi thiếu subscription.
- BR-NOTIFICATION-003: Read state scoped owner; public chat cần read cursor mỗi người; audit không được thay bằng notification có thể thay đổi.
- BR-NOTIFICATION-004: Schedule/coach/room changes MUST gửi đúng đối tượng bị ảnh hưởng với old/new/time/reason.

# M. Priority và thứ tự sửa

| Priority | Công việc | Điều kiện hoàn thành |
|---|---|---|
| P0 — security/data/payment | A01/A02 FREE+refund; A03/A04 data leak; A05–08 settlement/snapshot/entitlement; A14 bank allocation; mock production guard | Regression API + isolated DB; không lộ secret; đúng amount/entitlement dưới race |
| P0 — deployment gate | A13 migration/source/client conflict | Fresh DB migration replay, prisma generate, tsc/build đạt; không reset dữ liệu thật |
| P1 — major business | A09–12 attendance/analytics/capacity/schedule race; D02–05 ownership/socket/files/session; B01 course semantics | Negative tests và concurrency tests; invariant kiểm qua DB |
| P2 — edge/policy | Weekday/date filtering, feedback/report correctness, cancellation windows, future badge, partial update, reconciliation UX | Boundary timezone, policy approved, đúng response và recovery |
| P3 — improvement | Advanced waitlist, qualification workflow, calendar maintenance automation, full observability | Sau khi core invariants ổn; giảm scope rõ nếu chưa làm |

Một số mục P2 có thể nâng P1 nếu đang dùng để phạt/ra quyết định thật; ví dụ attendance report hoặc revenue sai không chỉ là lỗi giao diện.

Thứ tự thực hiện khuyến nghị: (1) khóa lỗ hổng trả dữ liệu và mock; (2) thống nhất source/schema/migration; (3) FREE/refund/plan snapshot/settlement; (4) shared locks/state machines; (5) course và attendance semantics; (6) polish UX/report. Không sửa UI để che trạng thái BE sai.

# N. Final Project Assessment

## 1. Đã làm tốt

- Có domain tương đối đầy đủ, RBAC bốn role và dynamic HTTP auth; nhiều owner checks đúng.
- Booking có unique constraint, quota/member/schedule advisory locks; transfer có CAS; không còn là CRUD đơn thuần.
- Bulk course và quick-create activity có transaction; room/coach conflict và area/capacity được kiểm khi tạo lịch.
- SePay có signature/API key verification, raw body, unique webhook claim, payment lock, amount/account checks và reconciliation fallback.
- Attendance có unique row, manual code expiry, penalty/appeal/revoke workflow; notification read ownership.
- FE có shared refresh single-flight, contract guard, pending QR recovery/poll, error toast và test boundary lịch VN.

## 2. Kết luận nghiêm khắc

**Chưa sẵn sàng vận hành với tiền thật/hàng nghìn member.** Vấn đề chính không phải giao diện hay số tính năng: entitlement FREE bị biến thành paid years, refund không đúng accounting, một số API lộ dữ liệu, state machine phân tán và chưa có invariant xuyên mọi writer. Có nền tảng tốt cho đồ án nhưng các lỗi P0 đủ để bị trừ nặng khi bảo vệ.

Không chấm điểm số giả tạo khi chưa có rubric và chưa chạy BE integration. Không tuyên bố giao dịch SEVQR43641644 ngoài thực tế gặp đúng nhánh nào: cần Payment/WebhookEvent/log đối soát của server, không thể suy ra chỉ từ HTTP304 hoặc source local.

## 3. Cần sửa trước demo

FREE carry-over và renew FREE; refund cap/ledger tối thiểu; training scope và nested password; build/migration consistency; generic online payment status bypass; QR time window/idempotency; capacity guards. Nếu chưa làm được accounting thật, demo bằng sandbox/mock tách biệt và ghi rõ “giả lập”, không dùng tiền thật để chứng minh một flow chưa an toàn.

## 4. Có thể để sau khi công bố giới hạn

Waitlist nâng cao, coach qualifications nhiều cấp, bảo trì tự động, holiday calendar, grace-period linh hoạt, metrics nâng cao. Không được để sau ownership/data leak/paid entitlement/refund correctness với lý do “đồ án”.

## 5. Retest ngay

Tạo member mới → mua gói30 ngày → kiểm tra endDate/amount/invoice → hủy bởi member/manager. Hai thanh toán một member cùng lúc. Hai member chỗ cuối. Book vs cancel schedule. Sửa lịch có overlap/member hết hạn. Scan trước giờ/sau complete/quét lại EXCUSED. Member đọc training người khác. Nhận file private khi chưa đăng nhập. Fresh DB replay migrations. Giá gói đổi khi QR pending. Payment refunded nhưng enrollment vẫn hoạt động.

## 6. Checklist trước bảo vệ

- [ ] Chốt glossary: class vs khóa/cohort vs buổi; membership payment không phải class fee.
- [ ] Có bảng role/action/ownership và test negative cho cả REST/socket.
- [ ] Không response nested nào chứa password/hash/token/secret.
- [ ] Một source SePay và schema/client/migration khớp; dựng sạch được trên máy khác.
- [ ] Không FREE carry-over; refund không vượt số tiền đã thu; không tự nhận đã payout.
- [ ] Snapshot offer và test đổi plan khi checkout pending.
- [ ] Webhook duplicate/concurrent/reconcile có exactly-once allocation effect trong DB.
- [ ] Không success activated nếu subscription chưa được cấp.
- [ ] Concurrency tests chạy trên PostgreSQL test, không chỉ mock Promise hoặc FE fixture.
- [ ] Book/cancel/schedule mutation/attendance dùng state và locks thống nhất.
- [ ] Date-only VN và timestamp UTC có tài liệu và test gần nửa đêm/cuối tháng.
- [ ] QR ngoài window bị chặn, screenshot threat nói đúng, correction có audit.
- [ ] Membership expiry không làm biến mất lịch sử chuyên cần.
- [ ] Course thêm/hủy buổi có policy, không gọi bulk slots là khóa bất biến nếu chưa implement.
- [ ] Test rollback/outbox/process crash, recovery khi timeout và khi ngân hàng đã thu.
- [ ] Tắt mock ở live, tách credentials/DB test, không đưa secret vào FE/tài liệu demo.
- [ ] Báo cáo tiền có gross/refund/net và được reconcile với invoice/ledger.
- [ ] Lưu bằng chứng test: request/response đã che dữ liệu nhạy cảm, DB assertions, commit/version deploy.

## Phụ lục: nguồn để sửa theo module

- [Prisma schema](/C:/WDP/Sports-Center-Management-System/BE/prisma/schema.prisma)
- [HTTP app/cache/uploads](/C:/WDP/Sports-Center-Management-System/BE/src/app.ts)
- [Dynamic authenticate](/C:/WDP/Sports-Center-Management-System/BE/src/middlewares/authenticate.ts)
- [DB lock helpers](/C:/WDP/Sports-Center-Management-System/BE/src/utils/dbLocks.ts)
- [Room transfer và update](/C:/WDP/Sports-Center-Management-System/BE/src/modules/rooms/rooms.service.ts)
- [Feedback](/C:/WDP/Sports-Center-Management-System/BE/src/modules/feedbacks/feedbacks.service.ts)
- [Reports](/C:/WDP/Sports-Center-Management-System/BE/src/modules/reports/reports.service.ts)
- [Penalty restoration](/C:/WDP/Sports-Center-Management-System/BE/src/modules/attendance/attendance-penalties.service.ts)
- [Chat socket](/C:/WDP/Sports-Center-Management-System/BE/src/modules/chat/chat.socket.ts)
- [Notifications](/C:/WDP/Sports-Center-Management-System/BE/src/modules/notifications/notifications.service.ts)
- [SePay config](/C:/WDP/Sports-Center-Management-System/BE/src/config/sepay.ts)
- [FE transport](/C:/WDP/Sports-Center-Management-System/FE/src/shared/api.ts)
- [FE MembershipPage](/C:/WDP/Sports-Center-Management-System/FE/src/pages/member/MembershipPage.tsx)

Các đề xuất trong báo cáo chưa được triển khai. Bước tiếp theo phải sửa theo nhóm invariant và bổ sung test, không vá từng toast hay đổi enum riêng lẻ.
