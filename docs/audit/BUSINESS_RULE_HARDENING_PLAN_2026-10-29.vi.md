# Phương án siết chặt nghiệp vụ SCMS — 29/10/2026

## 1. Mục tiêu và căn cứ

Phương án này chuyển các phát hiện trong `BUSINESS_RULE_REVIEW_2026-10-28.vi.md` thành các hạng mục sửa, quyết định chính sách và tiêu chí nghiệm thu. Căn cứ là mã sau merge `e7828ee`, yêu cầu trực tiếp của người dùng và chính sách mới tại `BE/docs/term-membership-policy.md`.

Đã chạy lại 10 test REPRO trên mã sau merge: cả 10 vẫn tái hiện hành vi bất thường. Đây là bằng chứng lỗi còn tồn tại, không phải 10 acceptance test đã đạt. Lần lập phương án này chưa thay đổi mã ứng dụng hoặc database.

Thứ tự ưu tiên: **tiền và quyền học → nhất quán tài khoản → phân công và phân quyền → dữ liệu kỳ/tài nguyên → báo cáo/hiệu năng → nghiệm thu tích hợp**.

## 2. Những bất biến cần bảo vệ

| Mã | Bất biến đề nghị |
|---|---|
| INV-01 | Mỗi member tối đa một subscription ACTIVE; FREE cũng thuộc bất biến này. SCHEDULED chưa cấp quyền hiện tại. |
| INV-02 | Một giao dịch thanh toán chỉ cấp quyền một lần; retry, callback lặp và đối soát không tạo thêm gói/invoice. |
| INV-03 | Quyền học phải truy về đúng subscription đã cấp quyền; không gán sang gói hiện tại chỉ vì người đó vừa mua gói mới. |
| INV-04 | Quyền đã thu hồi không được hồi sinh bởi job, lazy activation, refresh hay retry. |
| INV-05 | Hoàn tiền, hủy quyền, invoice, booking bị ảnh hưởng và nhật ký phải có trạng thái nhất quán; tiền online chưa hoàn thực tế không được hiển thị như đã hoàn xong. |
| INV-06 | Quyền học trọn kỳ theo điều kiện 50% là quyền giới hạn member × class × term × các buổi đã đăng ký, không phải kéo dài hạn gói hoặc quyền vào tập tự do. |
| INV-07 | Account chỉ được sử dụng khi provisioning user/profile/chuyên môn hoặc FREE bắt buộc đã hoàn tất. |
| INV-08 | Một buổi chỉ có một tập HLV hiệu lực dùng chung cho lịch, roster, điểm danh, thay HLV, nghỉ phép và kiểm tra trùng lịch. |
| INV-09 | Mọi thay đổi PATCH phải kiểm tra dữ liệu sau khi ghép với record hiện tại; không chỉ validate các trường gửi lên. |
| INV-10 | Tạo lịch/đăng ký hàng loạt phải hoặc thành công toàn bộ hoặc rollback toàn bộ; không âm thầm thành công một phần. |
| INV-11 | Scope cơ sở và quyền hạn do BE quyết định; không được suy rộng quyền từ việc FE có/không có nút. |
| INV-12 | Dữ liệu lịch sử, tiền đã thu, thời hạn/quota đã bán và attribution đã biết phải được giữ đúng; không tự suy đoán dữ liệu chưa có bằng chứng. |

## 3. Các chính sách cần thống nhất trước khi áp dụng

Các lựa chọn dưới đây là **đề xuất**, chưa phải chính sách đã được người dùng xác nhận.

| Quyết định | Phương án khuyến nghị | Lý do và tác động |
|---|---|---|
| D-01: Có cho mua nhiều gói chờ? | Giai đoạn đầu tối đa một SCHEDULED/member. Muốn đổi gói chờ thì hủy/hoàn theo quy định rồi tạo đơn mới. | Dễ giải thích và tránh hàng đợi chồng chéo. Nếu cần bán nhiều kỳ trả trước, phải thiết kế hàng đợi nối ngày thật sự, không chỉ đổi phép tính ngày cuối. |
| D-02: Hủy sát giờ có được chuyển buổi? | Member chịu cùng cutoff cho hủy và chuyển. Staff được xử lý ngoại lệ theo quyền riêng, bắt buộc lý do/audit. | Tránh chuyển buổi để né hạn hủy; không áp dụng cutoff mới ngược vào lịch sử. |
| D-03: Điều kiện môn live hay snapshot? | Snapshot điều kiện tại lớp theo BR-ROOM-02; thay điều kiện lớp phải có thao tác riêng và xem ảnh hưởng lịch tương lai. | Giữ lớp đã mở ổn định. Dụng cụ vẫn chỉ boolean và chỉ áp dụng INDOOR. |
| D-04: Lịch vận hành có bắt buộc kỳ? | Lịch thuộc khóa đăng ký theo kỳ phải có termId. Nếu cần lịch tự do, định nghĩa loại riêng với luật riêng. | Không dùng termId null làm ngoại lệ ngầm cho mọi lịch. |
| D-05: Có cho lớp vận hành chỉ với HLV phụ? | Lớp đang hoạt động/có lịch tương lai phải có đúng một HLV chính. Có thể để lớp nháp chưa có HLV chính nhưng chưa được tạo lịch. | Vai trò chính/phụ có ý nghĩa rõ ràng; không âm thầm biến HLV phụ thành người chịu trách nhiệm chính. |

Các sửa kỹ thuật như CAS, validate merged data, sai role count, xung đột báo cáo và revoke token có thể chuẩn bị độc lập với các quyết định trên.

## 4. Đợt 1 — Sửa vòng đời gói, tiền và quyền học

### 4.1. Một cơ chế kích hoạt dùng chung — AUD-01, AUD-02

- Tách hàm đọc entitlement khỏi hàm chuyển trạng thái. `findActiveSubscription` không được tự suspend/activate bằng hai ghi rời rạc.
- Job và các lệnh cần entitlement đúng ngay tại thời điểm thao tác cùng gọi một nghiệp vụ kích hoạt nguyên tử. Trước khi book, cấp quyền trọn kỳ hoặc vào buổi học, xử lý trạng thái đến hạn trong cùng transaction phù hợp; GET quota/preview chỉ đọc hoặc tính hiệu lực theo cùng luật đã định nghĩa, không tạo đường ghi riêng.
- Dùng cùng khóa theo member, đọc lại dữ liệu sau khi lấy khóa, kiểm tra ngày và payment đủ điều kiện, rồi CAS trạng thái. Gói CANCELLED/đã refund không được trở lại ACTIVE.
- Nếu gói SCHEDULED đã qua cả endDate khi job chạy trễ: xử lý hết hạn rõ ràng và không suspend gói hợp lệ hiện tại.
- Tạo chỉ mục unique có điều kiện cho một ACTIVE/member. Nếu chọn D-01, thêm bảo vệ một SCHEDULED/member sau khi xử lý dữ liệu trùng có sẵn. Các chuyển trạng thái phải sắp xếp để không vi phạm unique trong transaction.
- Nếu dữ liệu cũ có nhiều ACTIVE/SCHEDULED: xuất danh sách đối soát, không tự chọn một dòng rồi xóa hoặc suspend các gói đã trả tiền còn lại.

**Đơn chờ và webhook:** kiểm tra điều kiện ngay khi tạo đơn để giảm việc nhận khoản thanh toán không thể cấp quyền. Trường hợp tiền vẫn đến khi trạng thái member đã đổi, ghi nhận khoản thu vào sổ đối soát và trạng thái cần xử lý, không bỏ giao dịch hoặc báo như chưa nhận tiền. Chính sách giới hạn gói chờ phải áp dụng đồng nhất cho quầy, online và renew.

**Nghiệm thu:** hai lần mua/gia hạn hoặc hai callback đồng thời không mất tiền, không cấp quyền trùng, không vượt số gói chờ đã chốt; job/cancel/booking đồng thời không hồi sinh gói hoặc suspend nhầm.

### 4.2. Một nghiệp vụ hủy/hoàn tiền — AUD-03

- Gom các đường đổi trạng thái payment, cancel subscription và xử lý refund về một service nghiệp vụ; API không được tùy ý đổi enum tài chính mà không xử lý entitlement.
- Khóa theo thứ tự thống nhất, kiểm tra nguồn thanh toán và trạng thái thật trước khi thu hồi quyền/hoàn tiền; có idempotency cho việc hoàn tiền và CAS cho chuyển trạng thái.
- Với hoàn tiền mặt, staff có quyền xác nhận đã hoàn kèm lý do. Với kênh online, nếu cần gọi hệ thống ngoài thì dùng trạng thái chờ hoàn và đối soát; không tuyên bố một transaction DB có thể rollback việc chuyển tiền ngoài hệ thống.
- Phải xử lý cả ACTIVE, SCHEDULED và các quyền theo kỳ còn hiệu lực phát sinh từ subscription nguồn. Giữ invoice và lịch sử thu/hoàn theo quy định kế toán hiện có; không ghi đè số tiền đã thu.
- Thu hồi booking/grant dựa trên **subscription nguồn**, không hủy mù toàn bộ booking của member nếu booking đó được bảo đảm bởi một gói khác.
- Với enrollment cũ thiếu nguồn: đánh dấu cần đối soát; không tự gán nguồn theo gói mua gần nhất. Không được để grant mồ côi âm thầm tiếp tục có hiệu lực sau khi nguồn đã được xác nhận thu hồi.
- Lưu quyết định, actor, lý do và outbox thông báo trong transaction tương ứng; gửi thông báo sau commit.

**Nghiệm thu:** refund lặp không hoàn hai lần; refund gói chờ thì job không cấp quyền; refund gói nguồn của grant thì QR/entry/transfer không dùng được grant đó; booking từ gói khác vẫn giữ nguyên.

### 4.3. Tập trung luật quyền học theo kỳ 50%

- Không bỏ chính sách mới đã merge: đánh giá đúng tỷ lệ thời hạn tại thời điểm cấp, không làm tròn và không sửa endDate của subscription.
- Gom kiểm tra entitlement vào một nguồn dùng chung cho preview, bulk enrollment, transfer, QR, mã dự phòng, vào cơ sở và chuyên cần.
- Grant phải kiểm tra scope, hạn, nguồn cấp và trạng thái thu hồi. Hết hạn tự nhiên của gói không giống hủy/hoàn tiền: quyền theo kỳ đã cấp hợp lệ có thể tiếp tục khi hết hạn tự nhiên, nhưng không được sống lại sau thu hồi.
- Khi người dùng mua gói khác, giữ attribution của quyền cũ; không chuyển thống kê quyền theo kỳ sang gói mới.

**Nghiệm thu:** đúng 50% được cấp, dưới 50% bị chặn khi cần ngoại lệ; giữ Premium/quota/capacity/penalty; không dùng grant sang lớp/kỳ/cơ sở khác hoặc buổi chưa được quyền bao phủ.

## 5. Đợt 2 — Tài khoản và phiên đăng nhập

### 5.1. Provisioning thống nhất cho Admin/register/Manager — AUD-04

- Dùng chung orchestration cho tạo user/profile và dữ liệu bắt buộc theo role. Gom các ghi PostgreSQL vào một transaction.
- Xác định trạng thái provisioning và idempotency key; account chưa hoàn tất không được login hoặc nhận phân công vận hành như account sẵn sàng.
- MongoDB và PostgreSQL không có transaction chung: dùng quy trình bù trừ có nhật ký và tác vụ phục hồi. Nếu bù trừ thất bại, giữ account ở trạng thái chưa sẵn sàng, ghi rõ bước lỗi để retry; không trả một lỗi chung rồi bỏ lại account active.
- Email được chuẩn hóa và bảo vệ unique ở cả hai phía. Retry cùng yêu cầu phải tiếp tục/hoàn tất account đang provision, không tạo user thứ hai hoặc chiếm tài khoản đã tồn tại của yêu cầu khác.
- Cần kịch bản đối soát các account hiện có thiếu profile/FREE/chuyên môn/projection; sửa dữ liệu chỉ sau khi có báo cáo đối soát.

**Nghiệm thu:** chèn lỗi tại từng bước Mongo save/commit, PostgreSQL user/profile/FREE, hoàn tất provisioning và bù trừ; không account nửa vời dùng được; retry an toàn.

### 5.2. Guard tài khoản và thu hồi phiên — AUD-08, AUD-09

- Đếm đúng role của tài khoản mục tiêu khi bảo vệ Admin/Manager cuối cùng; dùng cùng service cho update/deactivate và serialize thao tác có thể làm mất người quản trị cuối.
- Deactivate HLV/nhân sự có lịch tương lai phải yêu cầu điều phối hoặc khóa thao tác với thông báo rõ ràng. Không tạo đường tắt qua user API để bỏ kiểm tra engagement.
- Thêm phiên bản bảo mật của account vào JWT và kiểm tra trong authenticate. Khi đổi/reset mật khẩu hoặc thu hồi mọi phiên, cập nhật password và tăng phiên bản nguyên tử ở nguồn xác thực, đồng thời xóa refresh token/ngắt socket.
- Quy định chuyển tiếp token cũ khi rollout: yêu cầu đăng nhập lại hoặc cửa sổ chuyển đổi rõ ràng; token thiếu phiên bản không được vô tình mặc định bằng phiên bản mới sau revoke.

**Nghiệm thu:** token cũ bị từ chối ngay sau đổi/reset; role change/lock vẫn có hiệu lực; hai thao tác tắt Admin không làm mất toàn bộ quản trị viên.

## 6. Đợt 3 — Phân công HLV, lịch và nghỉ phép

### 6.1. Một hàm xác định HLV hiệu lực — AUD-06, R-02/03/04/10

Đề xuất tập HLV của buổi gồm **HLV chính mặc định hoặc HLV thay chính theo buổi, cộng HLV phụ**. Người thay chính không mặc nhiên xóa vai trò HLV phụ; HLV chính cũ không còn quyền thao tác buổi đó chỉ vì còn assignment ở lớp.

- Dùng kết quả trên ở roster, attendance, QR, lịch cá nhân, conflict, danh sách buổi bị ảnh hưởng khi nghỉ phép và notification.
- Quyền sửa/chốt của Manager/Reception/Coach vẫn giữ theo ma trận role; việc thuộc tập HLV không tự cấp thêm quyền quản trị.
- Khóa theo lớp khi gán/gỡ primary; unique primary ở DB nếu chọn D-05; không cho gỡ primary cuối của lớp đang vận hành mà chưa thay người.
- Duyệt nghỉ cần tính đủ buổi của cả primary/support/substitute trước khi xác nhận resolutions, kể cả có lịch liên cơ sở.

**Nghiệm thu:** substitute + support cùng thấy đúng roster và điểm danh; primary cũ không thao tác nhầm; nghỉ HLV phụ không bỏ sót buổi; hai gán primary đồng thời không tạo hai primary.

### 6.2. Lock order và các đường tạo/chuyển/hủy lịch

- Lập bản đồ lock của booking, transfer, cancel, waitlist promotion, đổi lịch, nghỉ phép, mua/hủy/kích hoạt gói. Không thêm khóa membership riêng vào từng nơi mà chưa xét thứ tự với quota/schedule/payment.
- Chọn một thứ tự lấy khóa chung; với nhiều resource, sort ID ổn định. Kiểm tra vòng chờ A hủy → promote B trong khi B đang book → chờ schedule.
- Nếu cần retry deadlock/serialization, giới hạn số lần và chỉ retry nghiệp vụ idempotent; external side effect đi qua outbox/đối soát.
- Giữ batch all-or-nothing; chuyển đường schedule-pattern đang lặp createSchedule sang cùng cơ chế bulk validate/insert sau khi kiểm tra tương đương luật.
- Nếu chọn D-02, dùng cùng cutoff cho cancel/transfer và có quyền override riêng kèm lý do.

**Nghiệm thu:** DB concurrency test cho chỗ cuối, quota cuối, hai lịch cùng phòng/coach, cancel/promote/book; không vượt giới hạn, không nhân đôi, có lỗi retry hữu ích khi tranh chấp.

## 7. Đợt 4 — Kỳ học, snapshot tài nguyên, báo cáo và đánh giá

| Hạng mục | Phương án cập nhật | Tiêu chí nghiệm thu |
|---|---|---|
| AUD-07 — PATCH kỳ | Read → merge → validate toàn record → write có kiểm tra phiên bản hoặc transaction phù hợp. Kiểm tra start/end, registrationStart/End và lịch đã xếp. | PATCH riêng từng ngày không tạo khoảng ngày đảo hoặc cửa sổ đăng ký ngoài kỳ. |
| R-07/08 — term | Không chọn CLOSED làm kỳ hiện tại chỉ vì ngày còn trong khoảng; kiểm soát termId theo loại lịch đã chốt ở D-04; chuyển trạng thái kỳ theo ma trận rõ ràng. | Đóng kỳ sớm có hiệu lực thống nhất; không bỏ term để né cổng đăng ký. |
| AUD-10 — snapshot | Lưu snapshot có version gồm khu vực/boolean yêu cầu dụng cụ phù hợp thiết kế; tạo/sửa lịch đọc cùng nguồn. Thay requirement lớp phải xem ảnh hưởng lịch tương lai. | Sửa môn không âm thầm làm đổi lớp cũ; INDOOR chỉ có/không dụng cụ, OUTDOOR/POOL không bắt nhập chi tiết. |
| AUD-05 — scope report | Bỏ query ALL gây xung đột trên trang Admin, để controller chọn global theo quyền; giữ middleware scope chặt cho tài nguyên thông thường. | Test HTTP qua app thật cho Admin global và Manager scoped; cố gửi scope khác vẫn bị chặn. |
| Attribution/report | Source subscription và grant thống nhất; tách số bán, người mua, lượt booking, class distinct và người sử dụng; hiển thị unattributed cho dữ liệu cũ. | Một người dùng hai gói ở hai lớp không bị gán cả hai lớp cho cả hai gói; kỳ/cơ sở lọc đúng. |
| R-06 — feedback | Nếu đánh giá theo lớp, member phải có enrollment hợp lệ đúng lớp đó; khóa uniqueness cho feedback tổng quát null theo phương án tương thích DB. | Không đánh giá lớp chưa học chỉ vì cùng HLV; gửi lặp feedback tổng quát không tạo trùng. |
| Audit/UX | Cùng cấu trúc mã lỗi, message Việt, field errors và correlation ID; toast thành công, lỗi field giữ tại field; busy state chống gửi lặp. | Không chỉ trả “lỗi hệ thống”; Manager biết blocker và cách xử lý; log không chứa dữ liệu nhạy cảm. |

## 8. Dữ liệu và rollout

1. Dựng DB test cô lập có PostgreSQL và Mongo replica set nếu transaction Mongo yêu cầu; không chạy script destructive vào DB vận hành.
2. Xuất báo cáo trước migration: nhiều ACTIVE/SCHEDULED, payment REFUNDED còn quyền, account thiếu projection/profile, class thiếu/nhiều primary, kỳ đảo ngày và enrollment/grant thiếu nguồn hoặc mồ côi.
3. Chốt phương án sửa từng nhóm dữ liệu có tiền/quyền thật. Không “dọn duplicate” tự động bằng cách giữ dòng mới nhất.
4. Thêm schema theo kiểu tương thích: provisioning/session version/revocation theo thiết kế được chọn; index unique chỉ tạo sau khi đã giải quyết dữ liệu vi phạm. Kiểm tra schema đã có các migration termMembershipGrant và subscription attribution trước khi chạy BE yêu cầu các cột đó.
5. Triển khai migration bổ sung trước, code tương thích tiếp theo; giám sát trạng thái kích hoạt/hoàn tiền/provisioning, lỗi 409, retry/deadlock và độ trễ API.
6. Có rollback code tương thích schema đã thêm. Không rollback tiền, xóa ledger hay khôi phục quyền đã thu hồi bằng thao tác SQL ngược tự động.

## 9. Cách kiểm thử và tiêu chuẩn hoàn tất

- Giữ test REPRO cũ làm lịch sử; khi sửa từng AUD chuyển sang assertion hành vi đúng và đặt tên regression tương ứng. Không giữ “test qua vì lỗi vẫn còn” trong bộ kiểm tra nghiệm thu.
- Unit test cho state machine, tính ngày, snapshot, effective coach, scope và merged validation.
- HTTP integration đi qua authenticate, facility middleware, validation và controller để bắt lỗi kiểu ALL/header mà browser mock bỏ qua.
- DB integration cho rollback, unique index, CAS, provisioning failure recovery và tranh chấp đồng thời. Chạy cả các đường gọi trực tiếp service/job và HTTP để không chỉ kiểm tra một entry point.
- Browser test cho pending/error/retry, hai loại coach, Admin/Manager report và lịch batch; ghi rõ API mock hay thật.
- Đo hiệu năng trên dataset và cấu hình DB đại diện: query count, p50/p95, lock wait, timeout cho tạo lịch theo batch và pattern. Chốt ngưỡng từ baseline và nhu cầu thực tế, không hứa số giây khi chưa đo.

Một hạng mục chỉ hoàn tất khi: **đã chốt rule → có regression test → code dùng chung mọi entry point → dữ liệu/migration có đường xử lý → integration qua → tài liệu/API/UI thống nhất**. Build hoặc mock test qua riêng lẻ chưa đủ để tuyên bố hệ thống chặt chẽ.

## 10. Các gói công việc có thể bàn giao riêng

| Thứ tự | Gói sửa | Điều kiện phụ thuộc |
|---|---|---|
| 1 | Bộ state machine + effective entitlement + lock map | Chốt D-01; đưa quyền trọn kỳ vào mô hình ngay từ đầu |
| 2 | Refund/cancel/revocation thống nhất | Gói 1 và quy trình hoàn tiền từng kênh |
| 3 | Provisioning hai DB + phục hồi + guard user/session | Có thể chuẩn bị độc lập, nghiệm thu failure injection riêng |
| 4 | Effective coaches + primary invariant + leave coverage | Chốt D-05; phối hợp lock map gói 1 |
| 5 | Kỳ/transfer cutoff/snapshot | Chốt D-02/03/04; không thay chính sách ngầm |
| 6 | Scope report + attribution + feedback | Scope report sửa độc lập; attribution/revocation bám gói 1/2 |
| 7 | Pattern bulk + error UX + audit completeness | Giữ tương đương luật với các gói trước |
| 8 | Đối soát dữ liệu + migration rehearsal + nghiệm thu DB/load | Hoàn tất các gói ảnh hưởng schema và quyền |

Không gộp các quyết định chính sách chưa chốt vào một commit “fix business rules” lớn. Mỗi gói phải có mô tả thay đổi, tình huống trước/sau, test và ảnh hưởng dữ liệu để review được.
