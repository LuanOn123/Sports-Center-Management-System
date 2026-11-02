# Rà soát nghiệp vụ SCMS — 28/10/2026

## 1. Kết luận và phạm vi

**Chưa thể kết luận hệ thống đáp ứng đầy đủ requirement.** Các luồng chính đã có nhiều chốt chặn tại backend, nhưng có lỗi trong vòng đời gói trả phí, hoàn tiền, tạo tài khoản, quyền HLV và báo cáo Admin. Build thành công và test cũ qua không đủ để bảo đảm các luồng này đúng.

Đã bổ sung **10 ca tái hiện** trong `BE/tests/business-rule-audit.repro.test.ts`. Tất cả tái hiện được hành vi bất thường bằng cách chạy hàm thực của hệ thống với dependency được thay bằng fixture. Các test này **cố ý xác nhận hành vi lỗi hiện tại**, không phải bộ acceptance test chứng minh hệ thống đúng; khi sửa lỗi phải đổi assertion sang hành vi mong muốn.

Phạm vi: mã nguồn hiện tại, API/middleware, schema, transaction/lock, FE gọi API, tài liệu nghiệp vụ và các test sẵn có. Xem xét các luồng tài khoản → phân quyền → tài nguyên → lịch/HLV/nghỉ phép → mua gói/thanh toán → đăng ký/chuyển/hủy/waitlist → điểm danh → báo cáo/audit. Đây là audit mã nguồn và kiểm thử cô lập, **chưa phải nghiệm thu toàn bộ hệ thống trên DB thật hoặc kiểm thử xâm nhập**.

Không sửa nghiệp vụ ứng dụng trong lần audit này. Chỉ thêm báo cáo và file test tái hiện. Các thay đổi ứng dụng đã có sẵn trong working tree được giữ nguyên.

### Nguồn requirement và cách đối chiếu

1. Yêu cầu trực tiếp mới nhất của người dùng: phòng **INDOOR** chỉ chọn có/không dụng cụ; không quản lý tên/số lượng dụng cụ; một lớp một môn; hỗ trợ HLV phụ; theo dõi chính xác gói được dùng đăng ký lớp; thông báo và giao diện thống nhất.
2. `SCMS_Backend_Tasks.md`: các BR-AUTH, BR-ROOM, BR-SCHED, BR-ENR, BR-ATT, BR-REV, BR-AUDIT để truy vết yêu cầu cốt lõi.
3. `docs/CURRENT_BUSINESS_FLOW_AND_RULES.md`, đặc biệt **§1.00 cập nhật 25/10/2026**, cho phép gói SCHEDULED và gia hạn nối tiếp; phần này tuyên bố thay thế phần cũ mâu thuẫn phía dưới.
4. `docs/POLICY_A_MEMBERSHIP_LIFECYCLE.md`, các meeting feedback, overview và audit cũ chỉ dùng bổ sung bối cảnh. Không coi kết luận `[VERIFIED]` trong tài liệu cũ là bằng chứng đã kiểm thử ở lần này.

Chưa có một bản SRS cuối cùng được khóa phiên bản và bao phủ tất cả thay đổi. Đặc biệt không dùng quy định cũ “gia hạn luôn thay thế ngay, không queued” để kết tội luồng SCHEDULED mới. Sai lệch snapshot được đối chiếu với BR-ROOM-02; nếu nghiệp vụ đã đổi sang điều kiện môn luôn cập nhật trực tiếp thì cần sửa requirement và bỏ cách mô tả snapshot bất biến.

## 2. Phát hiện ưu tiên

Quy ước: **P1** ảnh hưởng tiền/quyền lợi hoặc tính nhất quán dữ liệu, nên sửa trước nghiệm thu; **P2** luồng chức năng sai hoặc thiếu nhất quán. Không ghi nhận P0 từ bằng chứng hiện có.

| ID | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| AUD-01 | P1 | Mua nhiều gói nối tiếp có thể cùng ngày bắt đầu và cùng thời hạn | REPRO B + đường tạo gói/job trong mã |
| AUD-02 | P1 | Lazy activation có thể kích hoạt lại gói vừa bị hủy | REPRO C, mô phỏng interleaving có kiểm soát |
| AUD-03 | P1 | Refund payment không hủy gói SCHEDULED tương ứng | REPRO D |
| AUD-04 | P1 | Admin tạo user: Mongo commit trước khi PostgreSQL tạo xong | REPRO G, chèn lỗi PostgreSQL |
| AUD-05 | P2 | Báo cáo nhu cầu gói toàn hệ thống của Admin bị middleware chặn | REPRO A + request FE |
| AUD-06 | P2 | HLV phụ mất quyền điểm danh khi buổi có HLV thay chính | REPRO F |
| AUD-07 | P2 | PATCH một ngày của kỳ học có thể làm đảo khoảng ngày | REPRO E |
| AUD-08 | P2 | Tắt tài khoản Admin lại đếm số Manager | REPRO H |
| AUD-09 | P2 | Đổi mật khẩu chưa thu hồi access token đã phát hành | REPRO I |
| AUD-10 | P2 | Có lưu snapshot điều kiện phòng nhưng xếp lịch không dùng snapshot | REPRO J; sai so với BR-ROOM-02 nếu giữ yêu cầu snapshot |

### AUD-01 — Gói nối tiếp chưa có luật xử lý hàng đợi nhiều lần mua

- Nguồn: `BE/src/modules/subscriptions/subscription-purchase.service.ts:50` (`inspectPlanPurchase`), nhánh cùng hạng; `activateSubscriptionForPayment`; `BE/src/modules/subscriptions/subscription-lifecycle.service.ts:148`.
- Tình huống: gói đang ACTIVE hết ngày 10/11. Mua thêm gói cùng hạng 30 ngày, rồi mua tiếp một lần nữa trước 10/11.
- Thực tế: hàm chỉ đọc gói ACTIVE, không xét các gói SCHEDULED đã trả tiền. Hai lần đều tính `startDate = endDate` của gói ACTIVE. Đường cấp gói vẫn tạo subscription mới; không thấy quy tắc từ chối hoặc nối tiếp hàng đợi.
- Ảnh hưởng: khi tới ngày, job lần lượt kích hoạt các gói sẵn sàng; gói sau suspend gói trước. Hai khoản tiền có thể không đem lại hai chu kỳ sử dụng nối tiếp. Thứ tự khi trùng startDate cũng chưa có tie-breaker rõ ràng.
- Đã chạy: hai lần tính ngày bằng hàm thật, xác nhận cùng kết quả và cả hai query chỉ đọc ACTIVE. Chưa chạy thanh toán hai lần trên DB thật; hậu quả job được truy vết từ mã.
- Hướng sửa: khóa theo member và chốt một chính sách rõ ràng: chỉ cho tối đa một gói đang chờ, hoặc tính ngày theo cuối toàn bộ hàng đợi. Áp dụng cùng một chính sách cho đơn quầy, online, renew và kích hoạt.

### AUD-02 — Hai cơ chế kích hoạt không giữ cùng bất biến

- Nguồn: `BE/src/modules/enrollments/enrollment-quota.service.ts:52` (`findActiveSubscription`), đối chiếu job lifecycle ở trên.
- Tình huống: resolver vừa đọc một gói SCHEDULED đến hạn; giao dịch khác hủy gói; resolver tiếp tục chạy.
- Thực tế: resolver suspend mọi ACTIVE rồi `update({where:{id}, data:{status:'ACTIVE'}})` gói vừa đọc. Không kiểm tra lại `status=SCHEDULED`, không dùng cùng `lockMemberSubscription`; khi gọi bằng root client còn không gom hai ghi trong một transaction.
- Đã chạy: fixture trả snapshot đã đọc, chuyển trạng thái thực tế thành CANCELLED rồi cho resolver tiếp tục. Gói vẫn bị đổi ACTIVE, gói hiện tại bị suspend.
- Trường hợp phụ: query SCHEDULED không lọc `endDate`; một gói chờ đã quá hạn có thể làm suspend gói hiện tại rồi bị chính query cuối loại vì hết hạn.
- Hướng sửa: gom job và lazy activation vào một hàm transaction có lock chung, đọc lại trạng thái, CAS, kiểm tra hạn và điều kiện thanh toán. GET quota không nên có nhiều ghi rời rạc.

### AUD-03 — Tiền đã hoàn nhưng quyền tương lai vẫn còn

- Nguồn: `BE/src/modules/payments/payments.service.ts:130` (`updatePaymentStatus`).
- Tình huống: khoản thu quầy không có gateway, đã SUCCESS, liên kết một gói SCHEDULED; đổi payment thành REFUNDED qua đường cập nhật trạng thái.
- Thực tế: payment được ghi hoàn tiền; phần hủy subscription chỉ chạy nếu subscription là **ACTIVE**. Gói SCHEDULED được giữ nguyên và vẫn thỏa query kích hoạt sau này.
- Đã chạy: gọi service thật, xác nhận payment REFUNDED và không có lần ghi nào vào subscription SCHEDULED.
- Phạm vi quyền: route payment status dùng `authorize('MANAGER')`, nhưng router chặn MANAGER từ đầu; ADMIN được kế thừa quyền này và vẫn có thể đi vào nhánh. Không mô tả đây là thao tác Manager thực hiện được trên HTTP hiện tại.
- Hướng sửa: mọi refund cần đi qua một nghiệp vụ thống nhất, khóa payment/member và thu hồi đúng quyền liên quan cho cả ACTIVE/SCHEDULED; đồng bộ invoice và tránh hoàn trùng. Không chỉ cập nhật enum payment.

### AUD-04 — Tạo tài khoản thất bại có thể để lại dữ liệu đã commit

- Nguồn: `BE/src/modules/users/users.service.ts:96`, Mongo commit ở dòng 139, PostgreSQL user tạo ở dòng 142; profile và cấp FREE còn ở các bước sau.
- Tình huống: Admin tạo user, Mongo thành công; PostgreSQL lỗi/timeout hoặc tạo profile lỗi.
- Thực tế: Mongo transaction đã commit; catch chỉ abort nếu còn `inTransaction()`, không có bù trừ phần đã commit. Các ghi PostgreSQL user/profile ở đường này cũng chưa được gom thành một transaction duy nhất.
- Ảnh hưởng: có tài khoản xác thực nhưng thiếu projection/profile/quyền học; thử tạo lại gặp trùng email. Với HLV có thể thiếu chuyên môn; với member có thể thiếu FREE.
- Đã chạy: chèn lỗi đúng tại `prisma.user.create`, xác nhận Mongo đã commit và không rollback/bù trừ.
- Hướng sửa: transaction PostgreSQL cho toàn bộ projection/profile/quyền mặc định; cơ chế compensation hoặc trạng thái provisioning/retry giữa hai DB. Đối chiếu đường register và tạo HLV ở facility để thống nhất cùng một cơ chế.

### AUD-05 — Báo cáo Admin mới có lỗi tích hợp FE–middleware

- Nguồn: `FE/src/features/manage/MembershipInsightsPage.tsx:48`; `FE/src/shared/api.ts:110`; `BE/src/middlewares/facilityScope.ts:45`; `BE/src/app.ts:103`.
- Tình huống: Admin mở Nhu cầu gói & lớp trong khi đã chọn một cơ sở.
- Thực tế: FE gửi `facilityId=ALL`, transport kèm header `X-Facility-Id=<cơ sở>`. Middleware thấy hai ngữ cảnh khác nhau và trả 400 `CONFLICTING_FACILITY_CONTEXT` trước controller.
- Nếu bỏ header nhưng vẫn gửi ALL, middleware lại coi ALL là ID cơ sở và lookup, không phải sentinel báo cáo.
- Đã chạy: middleware thật với đúng cặp query/header trên. Browser test mock API vẫn qua vì không chạy middleware backend.
- Hướng sửa nhỏ: không gửi query ALL ở trang này và dùng default global của controller Admin; kiểm tra cả request thực qua app. Không nới lỏng quy tắc scope toàn hệ thống để chữa một endpoint báo cáo.

### AUD-06 — Chưa thống nhất tập HLV thực sự dạy một buổi

- Nguồn: `BE/src/modules/attendance/attendance.service.ts:22`, `BE/src/modules/enrollments/enrollments.service.ts:528`, `BE/src/modules/operations/scheduling.ts:35`.
- Thực tế: validator lịch giữ HLV phụ khi có HLV thay chính, nhưng guard attendance dùng phép chọn: có `schedule.coachId` thì **chỉ** người đó được phép; không xét HLV phụ của lớp.
- Đã chạy: lớp có HLV chính + phụ, buổi có HLV thay chính, HLV phụ gọi điểm danh và bị 403.
- Nhánh roster enrollment còn dùng danh sách HLV của class, không xét người thay theo buổi. Vì vậy HLV thay có thể được điểm danh nhưng không mở được roster qua endpoint đó; HLV chính cũ vẫn thỏa guard roster.
- Hướng sửa: dùng chung `effectiveCoaches(schedule)`: HLV thay theo buổi thay cho HLV chính, cộng các HLV phụ. Dùng chung cho roster, attendance, QR, lịch cá nhân, conflict và nghỉ phép.

### AUD-07 — Validate PATCH chưa xét dữ liệu sau khi merge

- Nguồn: `BE/src/modules/terms/terms.schema.ts:67`; `BE/src/modules/terms/terms.service.ts:185`.
- Tình huống: kỳ bắt đầu 01/11, gửi riêng `{endDate:'2026-10-01T00:00:00Z'}`.
- Thực tế: schema chỉ so ngày khi cả hai field cùng xuất hiện trong request. Service có merge ngày để đếm lịch ngoài khoảng nhưng không so thứ tự ngày. Nếu chưa có lịch, dữ liệu đảo ngày vẫn được ghi.
- Đã chạy: parse schema và gọi update service với kỳ chưa có lịch; kết quả `endDate < startDate`.
- Tương tự cần kiểm tra ngày mở/đóng đăng ký và đóng đăng ký so với kết thúc kỳ khi chỉ PATCH một field.
- Hướng sửa: merge record hiện tại + patch rồi validate toàn bộ bất biến trước ghi.

### AUD-08 — Guard “Admin cuối cùng” truy vấn sai role

- Nguồn: `BE/src/modules/users/users.service.ts:280`.
- Thực tế: `deactivateUser` áp dụng cho cả MANAGER/ADMIN nhưng luôn `countDocuments({role:'MANAGER',isActive:true})`. Trong khi đường update user đếm `role:user.role`.
- Đã chạy: requester Admin khác target, target là ADMIN, count Manager bằng 1; bị từ chối với thông báo “last active MANAGER”.
- Ảnh hưởng: cùng một mục tiêu tắt tài khoản có thể có kết quả khác giữa update và deactivate. Guard không đo đúng bất biến cần bảo vệ.
- Hướng sửa: dùng role thực của target, thống nhất update/deactivate, xét thao tác đồng thời khi bảo vệ quản trị viên cuối cùng.

### AUD-09 — Đổi mật khẩu chưa kết thúc ngay mọi phiên API

- Nguồn: `BE/src/modules/auth/auth.service.ts:274`; `BE/src/middlewares/authenticate.ts:6`; `BE/src/utils/jwt.ts`.
- Thực tế: đổi mật khẩu xóa refresh token và ngắt socket. Access JWT không có phiên bản bảo mật và middleware chỉ kiểm tra user còn active/đúng role, nên token cũ vẫn dùng được đến hết TTL.
- Đã chạy: ký token, đổi mật khẩu qua service thật, gọi authenticate bằng token cũ; middleware vẫn cho qua.
- Giới hạn: mặc định access TTL 15 phút, không phải quyền truy cập vĩnh viễn; đây là khoảng trống so với kỳ vọng “đăng xuất mọi thiết bị ngay”. Reset mật khẩu cần rà cùng cơ chế.
- Hướng sửa: tokenVersion/passwordChangedAt hoặc session revocation được kiểm tra mỗi request. Nếu chủ ý chấp nhận TTL, requirement và thông báo phải mô tả đúng.

### AUD-10 — Snapshot điều kiện môn chưa thực sự bảo vệ lớp cũ

- Nguồn: BR-ROOM-02 trong `SCMS_Backend_Tasks.md`; `BE/src/modules/classes/classes.service.ts:87`; `BE/src/modules/operations/scheduling.ts:26`.
- Thực tế: tạo lớp lưu `requirementsSnapshot`, nhưng `validateResources` ghép `cls.sports[].requirements` hiện tại. Update class cũng tính lại snapshot từ môn hiện tại.
- Đã chạy: snapshot lớp yêu cầu dụng cụ, môn hiện tại đã bỏ yêu cầu, phòng INDOOR không dụng cụ; validator chấp nhận.
- Ảnh hưởng: sửa cấu hình môn có thể đổi điều kiện của lớp cũ, trái yêu cầu snapshot nếu vẫn áp dụng BR-ROOM-02.
- Hướng xử lý: chọn một chính sách rõ ràng. Nếu snapshot bất biến, validator phải đọc snapshot và chỉ thay đổi qua thao tác cập nhật có chủ ý; nếu điều kiện luôn live, bỏ tuyên bố đóng băng và kiểm tra ảnh hưởng các lịch cũ trước khi sửa môn.

## 3. Các điểm đọc mã thấy đáng lo, chưa xác nhận bằng tích hợp DB

Không tính các mục dưới đây vào 10 ca tái hiện phía trên.

| ID | Tình huống cần kiểm tra | Dấu hiệu trong mã / câu hỏi dễ bị bắt bẻ |
|---|---|---|
| R-01 | Hủy sát giờ bằng cách chuyển rồi hủy | `cancelEnrollment` có cutoff, `transferEnrollment` chỉ cần buổi cũ chưa bắt đầu. Có thể chuyển t−5 phút sang buổi tương lai rồi hủy. Cần chốt transfer có cùng cutoff không; chưa chạy trọn luồng HTTP. |
| R-02 | Duyệt nghỉ cho HLV phụ khi có HLV thay chính | `operations.routes.ts:473` lọc affected: coachId bằng người nghỉ, hoặc coachId null và class chứa người nghỉ. Buổi có coachId người thay sẽ bỏ qua HLV phụ, dù validator vẫn coi HLV phụ tham gia. Cần test duyệt nghỉ với resolutions rỗng. |
| R-03 | Hai request gán HLV chính cùng lúc | `classes.service.ts:404` unset-primary rồi upsert trong transaction nhưng không thấy lock theo lớp hoặc unique chỉ một isPrimary=true. Khi lớp chưa có primary, hai transaction có thể cùng tạo primary. Cần concurrency test PostgreSQL. |
| R-04 | Gỡ HLV chính cuối cùng nhưng vẫn còn HLV phụ | `removeCoach` xóa assignment; `validateResources` kiểm tra có ít nhất một coach, không kiểm tra có primary. Cần quyết định lớp có được vận hành chỉ với HLV phụ không. |
| R-05 | Deadlock hủy chỗ có promote waitlist | Hủy giữ lock người A rồi schedule; promote tiếp tục lấy lock người B. B đang booking có thể giữ lock B và chờ schedule. Cần kiểm tra thứ tự lock và retry deadlock trong DB thật. |
| R-06 | Đánh giá sai lớp hoặc trùng đánh giá tổng quát | `feedbacks.service.ts:32` kiểm tra học cùng coach ở bất kỳ lớp nào; check classId riêng chỉ kiểm tra coach dạy lớp đó. Upsert feedback không classId lookup bằng chuỗi rỗng nhưng create để null; `CoachFeedback.classId` nullable. Cần test quyền đánh giá theo đúng lớp và unique/null trên PostgreSQL. |
| R-07 | Lách chính sách kỳ bằng lịch không term | termId vẫn optional/nullable ở schema lịch, mẫu lịch. Nếu mọi lớp bắt buộc thuộc kỳ thì đang thiếu invariant; nếu lịch tự do là nghiệp vụ hợp lệ thì phải ghi rõ ngoại lệ và loại khỏi báo cáo kỳ phù hợp. |
| R-08 | Kỳ CLOSED vẫn được chọn là “hiện tại” | `terms.service.ts` query current dùng OR giữa status và khoảng ngày, không loại CLOSED. Kỳ đóng sớm nhưng đang trong khoảng ngày vẫn có thể được trả về. Cần test UI dùng default kỳ. |
| R-09 | Tạo lịch vẫn chậm ở đường mẫu lịch | `operations.routes.ts:333` vẫn lặp `await createSchedule` từng buổi trong transaction 30 giây. Endpoint batch mới giảm roundtrip nhưng chưa thay toàn bộ đường sinh lịch. Chưa đo latency DB thật, không kết luận đã giải quyết triệt để. |
| R-10 | Tắt HLV bằng user API bỏ lại lịch tương lai | Đổi role có check engagement; `deactivateUser` không có check lịch HLV tương lai tương đương. Cần khóa/điều phối người thay trước khi vô hiệu hóa account. |

## 4. Danh mục business rule đã tìm thấy

Trạng thái: **Có** = tìm được chốt chặn trong mã, chưa chứng nhận đúng dưới tải thật; **Lỗi** = có phát hiện ở phần 2; **Cần chốt/DB** = thiếu quyết định requirement hoặc chưa kiểm chứng tích hợp. Một nhóm “Có” vẫn chịu ảnh hưởng lỗi dùng chung như resolver gói.

| # | Nhóm | Business rule hiện tại | Đánh giá / nơi kiểm tra |
|---|---|---|---|
| 01 | Auth | 5 role, JWT, chặn user inactive và role đổi sau khi phát token | Có — authenticate, authorize |
| 02 | Auth | Login phải CAPTCHA hợp lệ trước kiểm tra credentials | Có — Turnstile; đã chạy test các role, timeout/replay/fail-closed |
| 03 | Auth | Manager/Reception chỉ một assignment cơ sở đang active | Có — facilityScope |
| 04 | Auth | Params/query/body/header cơ sở phải thống nhất | Có; lỗi tích hợp sentinel ALL — AUD-05 |
| 05 | Auth | Scope ở DAL cho entity và quan hệ con | Có — scoped-data, Prisma middleware; cần integration IDOR |
| 06 | Auth | Một số quyền ADMIN kế thừa MANAGER/RECEPTIONIST; authorizeExact không kế thừa | Có; phải đọc cả guard router, không chỉ tên role ở endpoint |
| 07 | Auth | Admin chỉ xem lịch; Manager thay đổi lịch | Có — route guards + Prisma chặn ghi ClassSchedule theo role ADMIN |
| 08 | Account | Không tự tắt account hoặc tự đổi role | Có — users service |
| 09 | Account | Bảo vệ role quản trị cuối cùng | Lỗi không thống nhất deactivate — AUD-08; cần DB race |
| 10 | Account | Đổi role khi có engagement cần giải quyết trước | Có nhánh kiểm tra; deactivation HLV cần kiểm tra thêm R-10 |
| 11 | Account | Tạo HLV phải có môn active/chuyên môn | Có — schema + sport count, dùng chung trường FE Admin/Manager |
| 12 | Account | User/profiles giữa hai DB phải nhất quán | Lỗi đường Admin — AUD-04 |
| 13 | Account | Đổi mật khẩu kết thúc phiên khác | Chỉ refresh/socket ngay; access token còn hạn — AUD-09 |
| 14 | Room | Capacity số nguyên dương, area INDOOR/OUTDOOR/POOL | Có — rooms schema |
| 15 | Room | Dụng cụ chỉ là có/không khi INDOOR | Có FE hai lựa chọn, BE bỏ capabilities ngoài INDOOR; tương thích dữ liệu key cũ |
| 16 | Room | Tắt/xóa mềm phòng phải xét lịch tương lai | Có — rooms service; cần kiểm thử biên buổi đang diễn ra và thao tác đồng thời |
| 17 | Room | Sửa sức chứa/khu vực/dụng cụ không làm lịch tương lai không phù hợp | Có nhánh kiểm tra/revalidate |
| 18 | Subject | Môn yêu cầu dụng cụ không xếp phòng INDOOR thiếu dụng cụ | Có — missingCapabilities; bị ảnh hưởng chính sách snapshot AUD-10 |
| 19 | Class | Mỗi lớp đúng một môn | Có schema create/update max(1); dữ liệu cũ cần kiểm tra DB |
| 20 | Class | minCapacity không vượt capacity; capacity không thấp hơn đã đăng ký | Có — classes service |
| 21 | Class | Điều kiện môn snapshot vào lớp | Có lưu nhưng không dùng nhất quán — AUD-10 |
| 22 | Coach | HLV phải active, thuộc cơ sở, đúng chuyên môn | Có — validateResources/findAssignableCoach |
| 23 | Coach | Một HLV chính, có HLV phụ | Có API; concurrency/primary cuối cần kiểm tra R-03/R-04 |
| 24 | Coach | HLV phụ được xét trùng lịch/nghỉ phép | Validator có; attendance/affected leave không đồng nhất — AUD-06/R-02 |
| 25 | Schedule | Cùng phòng/HLV không trùng khoảng giờ | Có resource locks + conflict query; cần DB race |
| 26 | Schedule | Phòng/lớp cùng cơ sở, đúng khu vực và đủ sức chứa | Có — validateResources |
| 27 | Schedule | Lịch nằm trong kỳ hợp lệ nếu có termId | Có assertCanScheduleInTerm; term optional cần R-07 |
| 28 | Schedule | Nhiều ca tạo nguyên tử qua batch | Có — createScheduleBatch/createMany; unit tests đã chạy |
| 29 | Schedule | Sửa/hủy/chốt lịch có lock và kiểm lại trạng thái | Có — update/delete/complete; cần cuộc đua với booking |
| 30 | Schedule | Không tùy ý đánh COMPLETED bằng patch trạng thái | Có dedicated complete flow, tạo attendance thiếu |
| 31 | Leave | Duyệt nghỉ phải xử lý tất cả buổi bị ảnh hưởng | Có resolutions và lock; phạm vi HLV phụ cần R-02 |
| 32 | Term | Khoảng ngày kỳ/đăng ký hợp lệ | Create có, partial update lỗi — AUD-07 |
| 33 | Term | Không thu hẹp kỳ ra ngoài lịch đã xếp; không xóa kỳ có lịch/pattern | Có — terms service |
| 34 | Plan | FREE hệ thống tự cấp, không bán/sửa/tắt từ catalog | Có — free-subscription + membership-plans |
| 35 | Plan | Giá/quota/thời lượng đã bán được snapshot | Có — subscription-purchase, payment snapshot; cần DB kiểm tra sửa plan sau bán |
| 36 | Plan | Gói hiệu lực toàn hệ thống; cơ sở phát hành dùng báo cáo | Có — resolver/global membership scope |
| 37 | Plan | Mua mới/nâng/cùng hạng/hạ hạng có ma trận ACTIVE/SCHEDULED | Có — inspectPlanPurchase; nhiều queued chưa đúng AUD-01 |
| 38 | Plan | Một member tối đa một ACTIVE, kích hoạt/hủy không hồi sinh trạng thái cuối | Job có lock/CAS; lazy resolver phá bất biến — AUD-02 |
| 39 | Plan | Hủy SCHEDULED hoàn 100%, không tự cấp quyền sớm | Có đường cancel chuyên dụng; đường refund khác lọt — AUD-03 |
| 40 | Payment | Đơn quầy PENDING, xác nhận rồi mới cấp quyền | Có — operations counter confirm, lock payment, shared activation |
| 41 | Payment | Online chỉ settlement/webhook, không sửa enum thủ công | Có — payment service chặn gateway |
| 42 | Payment | SePay xác thực, chống replay, kiểm tra tiền và đối soát | Có mã HMAC/API key/ledger/snapshot; chưa chạy live gateway/DB |
| 43 | Enrollment | Gói ACTIVE đúng thời điểm và bao phủ tới cuối khóa | Có single/bulk; chịu ảnh hưởng lazy resolver; định nghĩa class/term cần thống nhất |
| 44 | Enrollment | PREMIUM class yêu cầu PREMIUM | Có — assertCanBook và course eligibility |
| 45 | Enrollment | Quota theo DISTINCT class, dùng chung mọi cơ sở; FREE quota 0 | Có — enrollment-quota; cần DB đồng thời và snapshot legacy |
| 46 | Enrollment | Không vượt sức chứa, không trùng booking/time, có travel buffer liên cơ sở | Có — assertCanBook + locks, dùng cả khi promote |
| 47 | Enrollment | Đăng ký trọn khóa all-or-nothing, booking lại CANCELLED được tái kích hoạt | Có — course enrollment transaction; cần actual rollback DB |
| 48 | Enrollment | Chỉ chủ booking được tự hủy/chuyển; chuyển trong cùng lớp | Có — ownership/class guards; cutoff transfer cần R-01 |
| 49 | Waitlist | Ưu tiên theo position, chỉ promote người còn đủ mọi điều kiện | Có — promoteNextEligible; lock order cần R-05 |
| 50 | Attendance | QR TTL 10 phút, mã dự phòng 90 giây, cửa sổ server trước 30 phút tới hết buổi | Có — ATTENDANCE + attendance service |
| 51 | Attendance | Member chỉ điểm danh cho mình và phải có entitlement/booking | Có đường self-scan; đường staff manual có semantics riêng cần nghiệm thu |
| 52 | Attendance | Coach chỉ buổi phụ trách; sửa attendance cần quyền và lý do | Guard có nhưng sai effective coach — AUD-06 |
| 53 | Attendance | Advisory không tự phạt; penalty thủ công theo member×class, có appeal/hết hạn | Có — attendance config/penalties; cần DB lifecycle |
| 54 | Issue | Member/Coach chỉ request của mình, staff xử lý trong scope | Có — requesters service + operations; cần HTTP IDOR từng loại |
| 55 | Feedback | Chỉ học viên đã/đang học cùng coach được đánh giá, một feedback mỗi bộ khóa | Có guard một phần; đúng lớp và nullable unique cần R-06 |
| 56 | Report | Thực thu theo paidAt, hoàn thực tế theo refundedAt, không tính PENDING/FAILED vào thu | Có — reports service; không đồng nghĩa payment refund đã thu hồi entitlement |
| 57 | Report | Manager theo cơ sở; Admin tổng thể | Có service; Admin FE bị chặn middleware — AUD-05 |
| 58 | Report | Biết enrollment được dùng subscription nào, thống kê gói/lớp/member/kỳ | Có attribution mới; migration và dữ liệu legacy chưa được xác minh trên DB |
| 59 | Audit | Mutation quan trọng có actor/time/before/after cùng transaction | Có audited model set; phụ thuộc request context actor+facility; cần kiểm tra job/lazy và thao tác ngoài context |
| 60 | UX | CRUD toast, modal nổi đúng lớp, warning dark, member pricing responsive | Có và 10 browser tests mock API qua; không chứng minh API thực hợp lệ |

## 5. Những câu hỏi nên chuẩn bị trước khi bảo vệ

1. **Một user trả tiền gia hạn hai lần thì nhận bao nhiêu ngày?** Hiện chưa bảo đảm hàng đợi nối tiếp; AUD-01 cần xử lý trước.
2. **Hoàn tiền xong có còn quyền học không?** Hai đường refund/cancel đang khác nhau; cần một invariant và test chung.
3. **Vì sao quota GET lại có thể thay đổi trạng thái gói?** Nếu giữ lazy activation thì phải nguyên tử và dùng cùng lock/CAS với job/hủy.
4. **HLV thay chính và HLV phụ ai được xem danh sách/điểm danh/xin nghỉ?** Hiện mỗi module hiểu khác nhau.
5. **Tạo user báo lỗi thì email đó đã tồn tại chưa?** Dual-write hiện có thể trả lỗi sau khi một DB đã commit.
6. **Sửa môn có làm lớp đã mở thay đổi điều kiện phòng không?** Tài liệu nói snapshot nhưng validator đọc live.
7. **Mua gói nối tiếp rồi có đăng ký khóa vượt ngày hết gói ACTIVE được không?** Rule hiện chỉ entitlement ACTIVE; phải mô tả rõ việc đã trả tiền cho SCHEDULED không tự có quyền hiện tại. Không nên hứa “gia hạn là đăng ký được ngay” nếu giữ rule này.
8. **Một class dùng lại qua hai kỳ thì quota và ngày cuối khóa tính theo class hay class×term?** Single booking lấy buổi cuối theo class, còn course plan có gom kỳ. Cần khóa định nghĩa khóa học để không tạo trải nghiệm khác nhau.
9. **Báo cáo gói được chọn nhiều nhất đo bán hàng hay nhu cầu học?** Phân biệt số đơn/gói đã bán, người mua distinct, lượt booking từng buổi, lượt đăng ký class distinct, người sử dụng distinct. Không gọi N buổi của một người là N người.
10. **Dữ liệu trước khi có subscriptionId thuộc gói nào?** Chưa có bằng chứng chính xác thì phải báo unattributed; không suy đoán theo gói hiện tại hay gói mua gần nhất.
11. **Mọi lớp có bắt buộc thuộc kỳ không?** Nếu có, termId optional là điểm cần khóa; nếu không, thống kê và quy định mở đăng ký phải nêu ngoại lệ.
12. **“Tất cả thiết bị đã đăng xuất” có nghĩa ngay lập tức không?** Access token hiện vẫn tồn tại tới TTL sau đổi mật khẩu.

## 6. Kiểm thử đã chạy và giới hạn bằng chứng

| Kiểm tra | Kết quả |
|---|---|
| FE `npm run verify` | Qua: kiểm tra conflict, typecheck, 109 unit tests, production build |
| BE `npx tsc --noEmit` | Qua |
| BE coach-changes + schedule-batch + membership-attribution + turnstile | 50 test qua, gồm các subtest Turnstile |
| BE coach-specialization + facility-limits + terms | 16 test con qua (node:test còn tính các suite wrapper vào tổng) |
| Audit reproduction riêng | 10/10 ca tái hiện hành vi bất thường thành công |
| FE Playwright crud-improvements + membership-insights | 10/10 qua; API được mock |

Lệnh chạy lại phần bằng chứng audit, từ thư mục BE:

```powershell
npx tsx --test tests/business-rule-audit.repro.test.ts
```

Các test đặt URL PostgreSQL/Mongo về cổng local không có dịch vụ và thay dependency trong từng case; không truy cập dữ liệu thật. Chỉ chứng minh nhánh logic dưới các trạng thái được thiết lập, chưa chứng minh timing/race trên database.

Trong phiên này không có DATABASE_URL/DIRECT_DATABASE_URL/MONGO_URI cấu hình cho ứng dụng và BE chỉ có `.env.example`; Docker daemon chưa chạy. Vì vậy **chưa chạy integration PostgreSQL/MongoDB, SePay thật, kiểm tra dữ liệu production, stress test hoặc đo tốc độ xếp lịch thực tế**. Không dùng build/unit/browser mock để khẳng định các phần đó đã đạt.

Migration attribution `BE/prisma/migrations/20261028160000_enrollment_subscription_attribution/migration.sql` có trong working tree; phiên audit này **không áp dụng migration** và không xác minh schema nào ở môi trường triển khai đã có cột đó. Cần migrate và kiểm tra tính tương thích khi deploy; dữ liệu enrollment cũ có thể vẫn unattributed.

Build FE có cảnh báo chunk lớn hơn 500 kB; chưa có bằng chứng cảnh báo này là nguyên nhân tạo lịch chậm. Đường API mẫu lịch lặp từng buổi cần đo riêng.

`git diff --check` trên working tree hiện tại còn báo trailing whitespace trong `FE/src/shared/operations.json` đã thay đổi từ trước. Không chỉnh lại file sinh này trong phạm vi audit.

## 7. Checklist nghiệm thu trên DB cô lập trước khi chốt hệ thống

| Nhóm | Ca âm/đồng thời bắt buộc | Kết quả mong đợi |
|---|---|---|
| Account | Mongo thành công nhưng PostgreSQL user/profile/FREE thất bại | Không để account dùng được ở trạng thái thiếu dữ liệu; retry có thể phục hồi |
| Account | Hai Admin đồng thời tắt/đổi role nhau | Luôn còn người quản trị hợp lệ; thông báo đúng role |
| Scope | Manager/Reception A gửi ID tài nguyên B qua path/query/body/header | Không đọc/ghi chéo scope; không rò roster/thông tin thanh toán |
| Scope | Admin mở global report có selected facility | Request thực 200, số liệu bao phủ đúng scope |
| Plan | Gia hạn hai lần trước ngày hết hạn | Chặn rõ hoặc nối hàng đợi, không chồng mất thời hạn đã trả |
| Plan | Job/lazy/checkout/cancel chạy cùng thời điểm | Không >1 ACTIVE, không hồi sinh CANCELLED, không suspend nhầm |
| Plan | Job trễ qua cả endDate của gói chờ | Không cấp quyền hết hạn và không phá gói đang hợp lệ |
| Plan | Gói hết hạn, bị suspend, downgrade, FREE và gói SCHEDULED | Mọi nút/UI/API thống nhất entitlement thật |
| Payment | Bấm confirm lặp / callback SePay lặp / callback và đối soát đồng thời | Một lần cấp gói, một invoice, tiền/ledger không nhân đôi |
| Payment | Refund ACTIVE/SCHEDULED qua mọi endpoint hợp lệ | Payment, invoice, entitlement, booking nhất quán, hoàn không trùng |
| Payment | Sửa giá/quota/duration sau tạo đơn, trước confirm/webhook | Cấp theo snapshot đơn đã bán |
| Payment | Chuyển thiếu/thừa/sai mã, giao dịch đến trễ, hoàn khác kỳ thu | Không cấp quyền sai; số liệu đối soát và net revenue giải thích được |
| Room | Tắt/sửa phòng đồng thời với tạo lịch | Không commit lịch dùng tài nguyên không còn hợp lệ |
| Room | INDOOR có/không dụng cụ, đổi OUTDOOR/POOL rồi đổi lại | Đúng hai trạng thái, không giữ chi tiết dụng cụ hoặc quyền giả từ dữ liệu cũ |
| Schedule | Hai lịch tranh cùng room/coach; hai ca chạm biên | Chỉ xung đột thật bị chặn; không phát sinh overbooking |
| Schedule | Batch có một ca lỗi giữa danh sách | Rollback toàn bộ, không tạo một phần |
| Schedule | Mẫu lịch vài tuần/vài tháng qua cả hai endpoint | Đo p50/p95, query count, timeout; không chỉ dựa thời gian UI |
| Coach | Hai gán primary song song / gỡ primary cuối | Bất biến primary theo requirement luôn được giữ |
| Coach | Có substitute + support: roster, attendance, QR, lịch, nghỉ phép | Một tập HLV hiệu lực thống nhất |
| Leave | Approve thiếu một resolution, resolution buổi cơ sở khác | Không duyệt bỏ sót; đúng quyền điều phối liên cơ sở |
| Term | PATCH riêng từng ngày và CLOSED trước hạn | Không đảo ngày, không chọn kỳ đã đóng thành kỳ hiện tại |
| Term | Xóa term của lịch / lịch không term / đăng ký ngoài cửa sổ | Không né chính sách kỳ nếu requirement bắt buộc term |
| Enrollment | Hai người tranh chỗ cuối / một người book hai lớp cuối quota | Không vượt capacity/quota, một request thắng rõ ràng |
| Enrollment | Hai request transfer cùng booking sang hai buổi khác nhau | Chỉ một chỗ đích, chỗ cũ không bị nhả hai lần |
| Enrollment | Bulk một buổi full/overlap/gói không bao phủ | Không tạo booking một phần; lỗi chỉ rõ blocker |
| Enrollment | Hủy sát giờ và transfer sát giờ rồi hủy | Cùng chính sách cutoff đã chốt |
| Waitlist | Cancel + promote + người chờ booking song song | Không deadlock kéo dài, không mất chỗ, không vượt quota |
| Attendance | Trước/sau biên giờ, QR hết TTL, mã sai nhiều lần | Server chặn chính xác, không phụ thuộc đồng hồ trình duyệt |
| Attendance | Complete lặp / correction không reason / penalty hết hạn | Không attendance trùng, không tự phạt, đúng audit |
| Feedback | Review lớp chưa học, feedback không classId gửi lặp | Đúng quyền và quy tắc một đánh giá |
| Report | Một người mua hai gói, mỗi gói dùng lớp khác, chuyển/hủy rồi đăng ký lại | Đúng attribution; không đếm nhầm người/lớp/lượt |
| Audit | Force rollback xác nhận tiền/đổi lịch/duyệt nghỉ | Audit rollback cùng dữ liệu; khi commit đủ actor/reason/before/after |

## 8. Thứ tự xử lý đề nghị

1. Sửa chung vòng đời gói: AUD-01/02/03; một cơ chế cấp/thu hồi quyền, một lock và state machine. Viết acceptance test cho chuỗi mua → chờ → kích hoạt → đăng ký → refund.
2. Sửa provisioning tài khoản AUD-04; không để lỗi một DB trở thành account nửa vời.
3. Sửa effective coach AUD-06 và rà lại nghỉ phép/roster; kiểm tra primary đồng thời.
4. Sửa tích hợp báo cáo AUD-05, PATCH kỳ AUD-07, guard user AUD-08; chốt snapshot AUD-10 và token revocation AUD-09.
5. Chạy checklist DB cô lập, chốt các câu hỏi policy, cập nhật một bản requirement cuối; sau đó mới đánh giá đạt nghiệm thu và tối ưu hiệu năng bằng số đo.
