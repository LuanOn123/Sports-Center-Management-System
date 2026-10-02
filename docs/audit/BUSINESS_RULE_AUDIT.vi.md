# Rà soát business rule — Sports Center Management System

Ngày rà soát: **17/09/2026**. Phạm vi: mã nguồn hiện có trong workspace, không chỉ snapshot Swagger.

## 1. Kết luận

Dự án đã có các luồng cốt lõi: tài khoản bốn vai trò, hồ sơ hội viên/HLV, danh mục, gói tập, đăng ký/gia hạn, đặt/hủy lớp, thu tiền, hóa đơn và báo cáo. Tuy nhiên, **chưa nên coi các luồng này là hoàn chỉnh về nghiệp vụ**. Kiểm tra đơn lẻ đã có nhưng còn thiếu kiểm tra quyền trên từng bản ghi, chuyển trạng thái, hiệu lực theo thời gian và tính nhất quán khi ghi nhiều bảng.

Những việc cần xử lý trước:

1. Khóa truy cập lịch sử gói tập của người khác; giới hạn quyền đặt/hủy/xem hội viên của HLV; xử lý token khi khóa tài khoản hoặc đổi quyền.
2. Chuẩn hóa một phép tính quyền lợi gói tập cho toàn hệ thống, bao gồm ngày bắt đầu; sửa gia hạn trùng và giao dịch bán gói bị ghi dở dang.
3. Bảo vệ sức chứa và trùng lịch khi có yêu cầu đồng thời; kiểm tra lại cả các đường sửa, kích hoạt lại và phân công HLV.
4. Ràng buộc thanh toán đúng chủ gói; định nghĩa vòng đời thanh toán/hóa đơn; chống ghi nhận thu tiền hai lần.
5. Hoàn thiện điểm danh, dữ liệu báo cáo và phân trang ở các trang hội viên. Không coi enum `COMPLETED` hoặc một màn hình đã dựng là một nghiệp vụ đã hoàn thành.

**Báo cáo này là kiểm kê và chẩn đoán, chưa sửa logic sản phẩm.** Những quy tắc đề xuất chưa được chủ dự án xác nhận được đánh dấu riêng; không tự quyết mức phạt, chính sách hoàn tiền, độ tuổi hay quyền lợi thương mại.

## 2. Cách đọc và giới hạn kiểm chứng

| Ký hiệu | Ý nghĩa |
|---|---|
| Có | Tìm thấy kiểm tra/luồng thực thi trong code; không đồng nghĩa đã kiểm thử tích hợp đầy đủ |
| Một phần | Có luồng nhưng thiếu ràng buộc, bỏ qua được bằng đường khác hoặc chưa đi hết vòng đời |
| Chưa có | Không tìm thấy model/API/luồng tương ứng trong phần mã nguồn đã rà soát |
| Cần chốt | Chính sách sản phẩm chưa đủ bằng chứng để kết luận một hành vi phải được cho phép hay cấm |
| P1 | Ưu tiên cao: quyền truy cập, tiền, quyền lợi hoặc lịch tập có thể sai |
| P2 | Ưu tiên tiếp: tính đầy đủ, nhất quán, báo cáo và vận hành |
| P3 | Hoàn thiện phạm vi sản phẩm sau khi chốt yêu cầu |

Đã đọc 14 module BE ở các lớp routes/controller/schema/service; middleware xác thực, phân quyền, validation, lỗi; Prisma schema và hai migration SQL; entry/router FE đang được sử dụng, các khu vực manager/reception/member/coach, API adapter và tài liệu FE. Đối chiếu cả đường gọi API trực tiếp, không chỉ nút trên giao diện. Các số dòng bên dưới áp dụng cho snapshot lúc rà soát và có thể dịch chuyển khi sửa code.

Đã chạy **10 phép tái hiện hành vi hiện tại** bằng [business-rule-probes.cjs](business-rule-probes.cjs): nạp service TypeScript thật, thay Prisma bằng mock trong bộ nhớ. Cả 10 đều tái hiện được điều kiện lỗi mô tả. Đây là characterization probes: **pass nghĩa là tái hiện đúng lỗi hiện tại, không phải hệ thống đạt yêu cầu**. Khi sửa cần thay bằng assertion hành vi đúng. Probe đồng thời kiểm chứng một cách xen kẽ request khả thi, không thay thế load test trên PostgreSQL.

Không đăng nhập bằng tài khoản thật, không gọi API ghi dữ liệu, không migration/reset/seed, không xác nhận cấu hình hoặc ràng buộc bổ sung ngoài repository trên máy chủ triển khai. Không chạy lại bộ UI của lần làm việc trước để làm bằng chứng cho business rule BE. Workspace chưa có bộ test business rule BE cấu hình trong `BE/package.json`; script audit dùng TypeScript đã cài ở FE, không cài thêm dependency.

## 3. Danh mục quy tắc đã có và còn thiếu

| Nhóm | Đã thực thi | Một phần / thiếu / cần chốt |
|---|---|---|
| Đăng ký | Email đúng định dạng; mật khẩu ≥6 ký tự; tên ≥2; role đăng ký cố định MEMBER; tạo MemberProfile; hash mật khẩu; DB unique email/phone | Chưa chuẩn hóa email/phone; điện thoại rỗng/ký tự không mang ý nghĩa vẫn hợp lệ; ngày sinh chưa xác thực; chưa OTP/xác minh email/quên mật khẩu |
| Đăng nhập / phiên | Kiểm tra mật khẩu, chặn user inactive lúc login/refresh; access/refresh token; logout revoke refresh; đổi mật khẩu kiểm tra mật khẩu cũ | Access token không kiểm tra user hiện tại; đổi mật khẩu không thu hồi phiên; refresh chưa xoay vòng; đăng nhập cùng giây có nguy cơ trùng refresh token |
| Người dùng | MANAGER quản lý user; tạo profile tương ứng role; DELETE không cho tự khóa | PATCH có thể tự khóa/tự hạ quyền; chưa bảo vệ quản lý cuối cùng; đổi role còn giữ profile cũ và liên kết nghiệp vụ |
| Hội viên | STAFF/MANAGER tìm kiếm, xem, sửa; cấp độ tập luyện enum; mục tiêu/sở thích lưu được | Quyền xem của COACH chưa giới hạn theo lớp; inactive/role không được kiểm tra thống nhất ở bán gói, thu tiền, đặt hộ |
| HLV | Có hồ sơ chuyên môn/kinh nghiệm ≥0; phân công nhiều HLV vào lớp; cặp class–coach unique | Chưa kiểm tra HLV còn active/đúng role khi phân công; chưa kiểm tra trùng lịch khi đổi phân công; HLV chính chưa bảo đảm duy nhất khi đồng thời; FE coach là placeholder |
| Bộ môn | Tên unique DB; tạo/sửa/ngừng; DELETE chặn khi có lớp active | PATCH isActive bỏ qua guard; lớp/schedule/book không cùng áp dụng trạng thái bộ môn; danh sách public mặc định có thể chứa inactive |
| Phòng | Tên unique DB; capacity nguyên dương; DELETE chặn lịch sắp tới | Chưa buộc sức chứa lớp ≤ phòng; chưa bảo vệ lịch đang diễn ra; PATCH tắt phòng/giảm sức chứa bỏ qua quan hệ |
| Lớp | Bộ môn active khi tạo; capacity 1..200; REGULAR/PREMIUM; phân công HLV; DELETE chặn lịch tương lai | Sửa sportId không kiểm tra sport active; giảm capacity có thể thấp hơn số đã đặt; đổi loại lớp không xử lý quyền lợi hiện có; PATCH tắt lớp bypass guard |
| Lịch | Tạo buộc end>start; lớp/phòng active; kiểm tra giao khoảng thời gian cho phòng và HLV; hủy lịch hủy BOOKED | PATCH thiếu end>start sau khi merge; kích hoạt lại không check conflict; thiếu concurrency protection, kiểm tra sức chứa phòng, xung đột hội viên khi dời lịch; chưa quy định giờ mở cửa/ngày nghỉ |
| Gói tập | Giá >0, số ngày nguyên dương, tier MEMBERSHIP/PREMIUM; kế hoạch active khi bán/gia hạn | Tên plan chưa unique DB; update tên không kiểm tra trùng; không có version điều khoản; ngừng bán bị lẫn với quyền lợi gói đã mua; PATCH bypass DELETE guard |
| Subscription | Tạo dựa giá/thời lượng/tier plan; tạo payment+invoice; gia hạn từ endDate nếu gói còn ACTIVE và chưa hết | Future ACTIVE được dùng sớm; gia hạn nhiều lần trên cùng gói tạo các khoảng trùng; không transaction/idempotency; SUSPENDED chưa có cơ chế bảo lưu ngày; không tự chuyển EXPIRED |
| Đặt lớp | MEMBER chỉ đặt cho mình; gói active bắt buộc; PREMIUM bắt buộc cho lớp PREMIUM; lịch tương lai SCHEDULED; kiểm tra đầy/trùng/trùng giờ | COACH lọt nhánh đặt hộ; hủy xong đặt lại vi phạm unique; race sức chứa; trạng thái class/room/member không kiểm tra đủ; thời hạn gói tại thời điểm buổi học cần chốt |
| Hủy lớp đã đặt | MEMBER không hủy của người khác; chỉ BOOKED và trước startTime; lưu cancelledAt | COACH có thể hủy bất kỳ; chưa chính sách hạn hủy trước N giờ/phạt/no-show; hủy lịch và enrollment chưa atomic |
| Thanh toán | STAFF/MANAGER ghi nhận; MANAGER đổi status; amount >0; enum phương thức/trạng thái; transactionCode unique nếu có; auto invoice SUCCESS | Sai chủ subscription vẫn nhận; amount không đối chiếu nghĩa vụ; trạng thái nhảy tự do; chưa chống thu lại gói đã thu; chuyển khoản tự SUCCESS trong bán gói; chưa đối soát/hoàn tiền thực |
| Hóa đơn | Một invoice/payment; số hóa đơn unique; lưu số tiền; FAILED/REFUNDED hủy invoice ở luồng update | Payment và invoice không transaction; trạng thái có thể lệch; tên người mua/tên gói lấy dữ liệu hiện tại; chưa snapshot/điều chỉnh chứng từ; MEMBER không có API đọc hóa đơn riêng |
| Báo cáo | MANAGER, bốn nhóm report; kiểm tra thứ tự khoảng ngày; tổng hợp từ DB | Doanh thu dùng createdAt; tier đếm subscription thay vì người; nhãn totalEnrollments chỉ đếm BOOKED; thời gian server và trạng thái quá hạn chưa thống nhất |
| Mục tiêu luyện tập | Hồ sơ cá nhân và gợi ý theo trainingLevel | Gợi ý là danh sách tĩnh, chưa kế hoạch HLV giao, tiến độ/bài tập đo lường hay cá nhân hóa thật |
| Điểm danh | FE đọc enrollment COMPLETED | Chưa endpoint chuyển enrollment sang COMPLETED, chưa record điểm danh/người xác nhận/thời điểm/vắng mặt |
| Thông báo | FE dựng nhắc từ subscription và enrollment | Chưa thông báo lưu bền, đã đọc, lịch sử thay đổi, gửi nền; có thể nhắc buổi đã qua |
| AI | Có file giao diện AI riêng; README nêu future phase | Không được route trong UserLayout hiện hành, chưa BE/model/provider; không tính là đã triển khai |
| Quản trị mở rộng | Enum 4 vai trò; UI báo rõ chưa có roles/audit API | Chưa quyền tùy biến, audit trail nghiệp vụ, multi-branch, chính sách lưu trữ dữ liệu |

Nguồn chính: [BE modules](../../BE/src/modules), [schema](../../BE/prisma/schema.prisma), [FE member](../../FE/src/pages/member), [UserLayout](../../FE/src/features/user/UserLayout.tsx), [CoachLayout](../../FE/src/features/coach/CoachLayout.tsx), [README BE](../../BE/README.md).

## 4. Ma trận quyền đang thực thi trên backend

M = MANAGER; S = STAFF; C = COACH; U = MEMBER; “đã đăng nhập” bao gồm cả bốn vai trò. Tiền tố API là `/api/v1`.

| Tài nguyên / thao tác | Quyền hiện tại | Nhận xét |
|---|---|---|
| Register/login/refresh | Public | Register không nhận role tùy ý |
| Me / cập nhật me / đổi mật khẩu / logout | Đã đăng nhập | Me lấy user từ token, không từ ID client |
| Users list/create/get/patch/delete | M | Có role guard; chưa bảo vệ quản lý cuối cùng |
| Members list / patch | M,S | Profile/user được sửa ở hai lần ghi riêng |
| Member detail | M,S,C | C không cần có lớp liên quan |
| Member membership-status | M,S | U phải tự suy ra từ subscriptions trên FE |
| Coaches list / detail / patch | M,S / đã đăng nhập / M | Detail chứa email/phone/ngày sinh; cần chốt dữ liệu được công khai cho hội viên |
| Sports và plans GET | Public | Không ép isActive=true ở BE |
| Sports/plans ghi | M | Bao gồm PATCH isActive |
| Rooms/classes/schedules GET | Đã đăng nhập | Không scope theo lớp/HLV; chốt dữ liệu danh mục được xem |
| Rooms/classes/schedules ghi; gán/gỡ HLV | M | Role guard đã có |
| Subscription create/renew/detail | M,S | Có role guard |
| Subscriptions theo memberId | **Đã đăng nhập** | **Không kiểm tra owner; BR-01** |
| Subscription status | M | Chưa state machine |
| Enrollment create | **Đã đăng nhập** | U lấy profile chính mình; mọi role khác đi nhánh đặt hộ, gồm C |
| Enrollment my | U | Dùng req.user.id |
| Enrollment của schedule | M,S,C | C không kiểm tra phân công |
| Enrollment delete | **Đã đăng nhập** | Chỉ U được kiểm tra owner; C có thể hủy khác người |
| Payments create/list/detail | M,S | Status update chỉ M |
| Invoices mọi GET | M,S | Không khẳng định lỗi IDOR ở invoice route: đã có role guard |
| Reports | M | Có router-level guard |

Danh sách từng endpoint, middleware validation và vị trí route nằm trong [API_PERMISSION_INVENTORY.md](API_PERMISSION_INVENTORY.md).

Nguồn: các `*.routes.ts`, controller tương ứng và `enrollments.service.ts:96`. Đề xuất quyền tối thiểu: U chỉ dữ liệu mình; C chỉ danh sách cần thiết của lớp được giao; S xử lý vận hành; M quản trị. Phạm vi chi tiết của C/S và nhu cầu MEMBER xem HLV cần chủ dự án chốt.

## 5. Các phát hiện cụ thể

### BR-01 — P1: đọc lịch sử gói và thông tin thanh toán của hội viên khác

- **Bằng chứng:** `subscriptions.routes.ts:107` chỉ authenticate; controller `:19` truyền memberId từ URL; service `:131` chấp nhận profileId/userId bất kỳ và trả subscriptions kèm payments/invoice.
- **Tái hiện:** U-A gọi `GET /subscriptions/member/<id của U-B>`. Không có điều kiện gắn ID mục tiêu với req.user.id ở route/controller/service.
- **Ảnh hưởng:** lộ thời gian mua, gói, thanh toán/hóa đơn của người khác khi biết ID. UUID khó đoán không thay thế kiểm tra quyền.
- **Cần sửa:** resolve profile một lần, U chỉ chính mình; C cấm hoặc scope được chốt; S/M theo quyền vận hành. Áp dụng trước khi query nội dung. Có thể thêm `/subscriptions/my` với identity lấy từ phiên.
- **Nghiệm thu:** A đọc A được; A đọc B bị từ chối với cả userId/profileId; S/M được; C tuân theo ma trận đã chốt.

### BR-02 — P1: quyền và trạng thái tài khoản trong access token bị cũ

- **Bằng chứng:** `middlewares/authenticate.ts:14` chỉ verify JWT rồi tin role payload; `users.service.ts:95,123` đổi role/active; `auth.service.ts:147` đổi mật khẩu không thu hồi phiên. `config/env.ts` mặc định access TTL 15m, nhưng runtime có thể cấu hình khác.
- **Tái hiện:** lấy access token MANAGER, sau đó hạ role/khóa user bằng phiên khác; gọi API quản lý bằng token cũ trước hết hạn. Middleware vẫn nhận quyền cũ.
- **Cần sửa:** kiểm tra active và role hiện hành hoặc session/tokenVersion có cơ chế invalidation; định nghĩa logout/đổi mật khẩu có thu hồi mọi phiên hay chỉ phiên hiện tại. Refresh đã kiểm tra user active, nhưng không giải quyết access token còn hạn.
- **Nghiệm thu:** user bị khóa không thể tiếp tục mutation; quyền bị thu hồi có hiệu lực trong thời gian cam kết rõ ràng; không chỉ kiểm tra FE.

### BR-03 — P1: COACH có quyền đặt/hủy rộng ngoài phân công

- **Bằng chứng:** `enrollments.routes.ts:35,110` thiếu authorize; controller `:12` dùng nhánh “không phải MEMBER” cho mọi role; service cancel `:108` chỉ kiểm tra owner nếu MEMBER. List enrollment `:148` không nhận coachId/actor; `members.routes.ts:61` cho C đọc bất kỳ member.
- **Tái hiện:** C không phụ trách lớp gửi memberId để đặt hộ; hoặc DELETE enrollment của hội viên khác trước giờ học. **Probe xác nhận đường hủy**.
- **Cần sửa:** allowlist explicit cho đặt/hủy hộ; nếu HLV được xem roster, kiểm tra ClassMember của actor. Chốt có cho HLV hủy/đặt hộ hay chỉ điểm danh; không suy quyền từ `role !== MEMBER`.

### BR-04 — P1: gói chưa bắt đầu vẫn cấp quyền, gia hạn có thể chồng lấn

- **Bằng chứng:** `enrollments.service.ts:5`, `members.service.ts:118`, `reports.service.ts:70` lọc ACTIVE/endDate nhưng bỏ startDate. `subscriptions.service.ts:96` renew dùng endDate của gói đầu vào; `:108` tạo ACTIVE ngay. FE Membership `:31`, Dashboard `:38`, Notifications `:25` cũng bỏ startDate và lấy phần tử đầu.
- **Tái hiện:** PREMIUM bắt đầu tháng sau vẫn được dùng cho booking hôm nay. Renew cùng subscription cũ hai lần tạo hai gói có cùng ngày bắt đầu, vẫn thu tiền hai lần. FE lấy gói mới nhất khác với BE ưu tiên tier cao nhất.
- **Cần sửa:** dùng một phép tính entitlement `startDate <= t < endDate` (quy ước biên này là đề xuất cần thống nhất), status hợp lệ, role/active hợp lệ. Future purchase cần hiển thị “sắp hiệu lực”. Gia hạn nối từ đuôi chuỗi hợp lệ, bảo vệ concurrency và retry.
- **Nghiệm thu:** future premium không cấp sớm; gia hạn hai kỳ nối tiếp; FE/BE/report cùng một hạng tại cùng thời điểm. **Probe xác nhận thiếu startDate ở booking lookup**.

### BR-05 — P1: bán/gia hạn gói có thể lưu dở dang

- **Bằng chứng:** `subscriptions.service.ts:39–75,100–126`: suspend cũ → create subscription → payment → invoice là các lần ghi độc lập, không `$transaction`; không có idempotency key.
- **Tái hiện:** gây lỗi tạo payment/invoice sau khi gói đã tạo. Gói cũ đã SUSPENDED, gói mới ACTIVE nhưng thiếu payment/invoice; người dùng thấy lỗi rồi gửi lại có thể bị ghi thêm tiền. **Probe xác nhận khi payment lỗi, hai bước thay đổi gói đã chạy**.
- **Cần sửa:** transaction cho biến đổi dữ liệu cùng nghiệp vụ; unique operation/idempotency key; response retry trả lại kết quả cũ. Với hệ thống thanh toán ngoài, cần trạng thái chờ và reconciliation thay vì giữ DB transaction qua network.

### BR-06 — P1: đếm rồi tạo không bảo vệ sức chứa và trùng giờ khi đồng thời

- **Bằng chứng:** `enrollments.service.ts:47–83`; `class-schedules.service.ts:13–109` kiểm tra conflict rồi insert; migrations không có exclusion/lock liên quan.
- **Tái hiện:** ca còn 1 chỗ, hai người cùng nhận count cũ rồi cùng insert; hoặc tạo hai lịch cùng phòng cùng giờ đều vượt qua check. Unique member–schedule chỉ chặn cùng người/cùng ca, không chặn hai người khác nhau. **Probe tái hiện hai booking với capacity=1**.
- **Cần sửa:** chiến lược transaction/isolation/lock thực sự bảo vệ resource, retry serialization có giới hạn; serialize booking theo ca và theo member khi kiểm tra lịch; cân nhắc exclusion constraint cho room. Chỉ bọc transaction mặc định mà không bảo vệ điều kiện đọc chưa đủ.
- **Nghiệm thu:** burst song song vào một chỗ chỉ một thành công; hai lịch chồng nhau cùng resource không cùng commit; hai ca xung đột của một hội viên không cùng commit.

### BR-07 — P2: hủy rồi đặt lại cùng ca thất bại do unique key

- **Bằng chứng:** `enrollments.service.ts:57` chỉ từ chối existing BOOKED; `:83` luôn create; schema/migration unique(memberId,scheduleId) áp dụng cả CANCELLED.
- **Tái hiện:** đặt → hủy → đặt lại trước giờ học khi còn chỗ: lỗi P2002. **Probe xác nhận service đi vào INSERT**; unique constraint được kiểm chứng trong migration.
- **Cần sửa:** nếu cho đặt lại, cập nhật record CANCELLED về BOOKED trong transaction, reset cancelledAt, lưu lịch sử hành động riêng. Nếu cấm đặt lại thì cần rule/lỗi rõ ràng từ BE, không để lỗi unique chung quyết định chính sách.

### BR-08 — P1: sức chứa phòng, trạng thái tài nguyên và quyền lợi tương lai chưa ràng buộc

- **Bằng chứng:** createSchedule `:97` đọc room nhưng không so capacity; bookClass `:17` chỉ class.capacity, không class.isActive/room/sport; updateClass `:64`, updateRoom `:32` ghi trực tiếp.
- **Tái hiện:** phòng capacity=10 nhận lớp capacity=30; giảm class.capacity xuống dưới số BOOKED; tắt class qua PATCH nhưng ca còn SCHEDULED vẫn đặt được.
- **Cần sửa:** invariant sức chứa tại ca không vượt giới hạn phòng/lớp và số chỗ hiện có; check active xuyên suốt đường bán/đặt/phân công; khi thay đổi ảnh hưởng booking phải reject hoặc có quy trình chuyển/hủy được xác nhận.
- **Cần chốt:** gói phải còn hiệu lực lúc đặt, lúc bắt đầu ca hay suốt ca? Hiện chỉ kiểm tra lúc đặt. Không tự chọn chính sách này từ tên “ACTIVE”.

### BR-09 — P1: PATCH lịch thiếu kiểm tra khoảng thời gian hợp lệ

- **Bằng chứng:** `class-schedules.schema.ts:13` không refine; service `:132–150` merge start/end rồi lưu, không so end>start; roomId mới không kiểm tra active. POST có refine nhưng PATCH không có.
- **Tái hiện:** chỉ sửa endTime về trước startTime hiện có; hoặc chuyển vào phòng đã inactive. **Probe xác nhận khoảng thời gian ngược được gửi xuống update**.
- **Cần sửa:** validate trạng thái sau merge tại service; ngày hợp lệ, end>start, room/class hợp lệ, giới hạn quá khứ/giờ hoạt động theo chính sách. FE không đủ bảo vệ API trực tiếp.

### BR-10 — P1: phục hồi/dời lịch bỏ sót xung đột và vòng đời

- **Bằng chứng:** updateSchedule `:136` chỉ check conflict khi có start/end/room; status-only CANCELLED→SCHEDULED không check; `:141` chỉ hủy BOOKED; không kiểm tra enrollment của member khi dời ca, không chặn sửa COMPLETED.
- **Tái hiện:** hủy lịch A, tạo B cùng phòng/giờ, bật lại A bằng status-only: trùng. Dời A sang giờ hội viên đã đặt B: lịch cá nhân xung đột. **Probe xác nhận reactivation không gọi conflict lookup**.
- **Cần sửa:** state machine; mọi lần vào SCHEDULED phải check toàn bộ invariant; dời lịch xét người đã đặt, thông báo và quyền hủy; hủy enrollment + schedule trong transaction. Không tự chuyển enrollment sang COMPLETED chỉ vì lịch đã kết thúc nếu nghiệp vụ đòi điểm danh thật.

### BR-11 — P1: thay phân công HLV có thể tạo trùng lịch

- **Bằng chứng:** `classes.service.ts:70–100` không gọi conflict check; chỉ tìm CoachProfile, không user active/role. isPrimary updateMany rồi upsert không atomic; DB chỉ unique cặp classId/coachId.
- **Tái hiện:** tạo hai lịch đồng thời cho hai lớp có HLV khác nhau, sau đó gán cùng HLV vào cả hai lớp. Hai request gán primary có thể tạo nhiều primary.
- **Cần sửa:** kiểm tra toàn bộ lịch đang chịu tác động khi gán/đổi HLV; atomic primary assignment và constraint phù hợp; chốt có bắt buộc một HLV chính, cho lớp không HLV hoặc thay HLV cho từng ca không.

### BR-12 — P1: PATCH bypass các guard ngừng hoạt động

- **Bằng chứng:** services sports `:39/45`, rooms `:32/38`, classes `:64/103`, membership-plans `:41/47`: DELETE có guard, PATCH có isActive nhưng ghi trực tiếp. `users.schema.ts:21` + service `:95` cũng bypass self-deactivation check ở DELETE `:124`.
- **Tái hiện:** DELETE room có lịch trả lỗi, nhưng PATCH `{isActive:false}` được chấp nhận. **Probe xác nhận trường hợp phòng**. MANAGER có thể PATCH tự inactive/tự hạ role, không có kiểm tra quản lý cuối cùng.
- **Cần sửa:** gom invariant trong domain/service chung cho mọi entry point; bảo vệ tài khoản quản trị cuối cùng; đừng chỉ disable nút. Guard lịch hiện tại dùng start>=now còn bỏ lọt ca đang diễn ra, cần xét khoảng thời gian còn chiếm tài nguyên.

### BR-13 — P1: thanh toán có thể gắn sai chủ subscription hoặc thu không đúng nghĩa vụ

- **Bằng chứng:** `payments.service.ts:22–40` resolve member và sub riêng, chỉ kiểm tra sub tồn tại; schema chỉ amount>0. **Probe xác nhận member A + subscription B được chấp nhận**.
- **Tái hiện:** ghi payment cho A với subscriptionId của B. Gói đã tự sinh SUCCESS khi mua vẫn có thể được ghi thêm payment cùng gói, không giới hạn tổng đã thu.
- **Cần sửa:** sub.memberId phải bằng memberProfile.id; tách khoản thu gói và khoản thu khác bằng mục đích rõ ràng; tính outstanding amount, kiểm soát trùng/retry. Nếu cho trả góp/nhiều khoản thu, cần mô hình nghĩa vụ và phân bổ, không đơn giản unique(subscriptionId) cho mọi payment.
- **Cần chốt:** có cho nhân viên nhập số tiền khác giá gói, chiết khấu hoặc bù tiền nâng hạng không? Hiện chưa có quy trình phê duyệt hay lý do.

### BR-14 — P1: thanh toán/hóa đơn đổi trạng thái không nhất quán

- **Bằng chứng:** `payments.service.ts:100–122` cho mọi status enum, ghi payment trước invoice; SUCCESS chỉ tạo invoice khi chưa có, FAILED/REFUNDED hủy invoice; không đồng bộ subscription.
- **Tái hiện:** SUCCESS→REFUNDED→SUCCESS giữ invoice CANCELLED; SUCCESS→PENDING giữ invoice ISSUED; set SUCCESS nhiều lần ghi đè paidAt. **Probe xác nhận đường REFUNDED→SUCCESS**.
- **Cần sửa:** định nghĩa transition được phép, no-op cho retry cùng trạng thái, timestamp không bị ghi lại tùy ý; cùng transaction cho payment/invoice; refund có chứng từ/lý do/actor và tác động entitlement theo chính sách. Chuyển status REFUNDED hiện chỉ là ghi nhận nội bộ, không phải lệnh trả tiền ngân hàng.

### BR-15 — P1: bảo lưu/hủy/hết hạn gói chỉ đổi nhãn trạng thái

- **Bằng chứng:** `subscriptions.service.ts:170` update status trực tiếp; không suspensionStartedAt/remainingDays/resume history trong model; không job chuyển EXPIRED tìm thấy trong source/server. Create mới suspend mọi ACTIVE ngay cả gói đang chạy, không đợi startDate gói mới.
- **Tái hiện:** suspend 10 ngày rồi activate lại không kéo dài endDate; gói quá hạn vẫn có raw status ACTIVE; bật lại gói đã hủy không kiểm tra payment, overlap hoặc expiry.
- **Cần sửa:** chốt SUSPENDED là bảo lưu có cộng ngày hay chỉ khóa quyền; quy định thay gói/upgrade/downgrade; tách status lưu trữ với trạng thái hiệu lực suy ra. Expiry có thể tính lúc đọc hoặc có job idempotent, nhưng mọi consumer phải nhất quán.

### BR-16 — P2: đổi role để lại hồ sơ có thể tiếp tục được sử dụng

- **Bằng chứng:** `users.service.ts:99–117` upsert profile mới, giữ profile cũ; payments/subscriptions/đặt hộ chỉ tìm profile không lọc user.role/isActive. Danh sách members lại lọc role MEMBER.
- **Tái hiện:** MEMBER chuyển STAFF biến mất khỏi danh sách members nhưng profileId cũ vẫn được bán gói/thu tiền/đặt hộ. COACH chuyển role còn ClassMember.
- **Cần sửa:** quyết định user một role hiện hành hay có nhiều tư cách nghiệp vụ. Giữ lịch sử là hợp lý nhưng quyền sử dụng profile phải nhất quán; đổi role cần kiểm tra lớp, gói, người thay thế, không xóa lịch sử tài chính tùy tiện. Riêng updateUser dùng nested write của Prisma; các luồng auth.updateMe, members.updateMember và coaches.updateCoach lại ghi user/profile bằng những lần gọi riêng, cần bảo vệ atomic khi cùng sửa hai bảng.

### BR-17 — P2: định danh, ngày và giới hạn đầu vào thiếu chuẩn chung

- **Bằng chứng:** auth/users/members/coaches schema dùng phone regex `^[0-9+\-() ]*$`, DOB string tùy ý, tên min(2) không trim/max; email không canonicalize. subscriptions startDate string tùy ý; một số query date/status không qua validate hoặc chỉ string; ID nhiều chỗ chỉ min(1).
- **Tái hiện:** `phone:""`, `phone:"++"`, tên hai khoảng trắng qua schema; định dạng `090...` và `+8490...` có thể là cùng số nhưng DB xem khác; email khác casing có thể thành tài khoản khác trên DB text hiện tại. Ngày sinh không hợp lệ có thể tới Prisma và ra 500; ngày sinh tương lai chưa bị chặn.
- **Cần sửa:** chuẩn hóa trước unique check, cùng rule FE/BE; số điện thoại optional rỗng→null/omit theo hợp đồng; date parser rõ ràng, giới hạn length, amount/precision theo Decimal(12,2), ID hợp lệ, enum query thật. Tuổi tối thiểu và quy tắc số điện thoại quốc tế là quyết định sản phẩm.

### BR-18 — P2: thiếu hợp đồng error code nghiệp vụ và tiếng Việt chưa phủ hết

- **Bằng chứng:** `middlewares/errorHandler.ts:29` map P2002 đúng fields, FE `shared/apiErrors.ts` nhận duplicate phone/email chính xác nhưng chỉ dịch một số câu và giữ nguyên câu không biết. Nhiều lỗi membership/full/conflict từ services còn tiếng Anh, có câu động chèn tên/giờ.
- **Cần sửa:** `code` ổn định + field + params, ví dụ `PHONE_ALREADY_USED`, `CLASS_FULL`, `MEMBERSHIP_NOT_STARTED`, `SCHEDULE_CONFLICT`, `PAYMENT_MEMBER_MISMATCH`. FE dịch theo code, giữ mô tả gốc phục vụ debug; lỗi không biết không được tự suy thành trùng email hoặc “không có quyền trang”. Validation/FK conflict phải ra 4xx đúng nghĩa thay vì 500 chung nếu dự đoán được.
- **Nghiệm thu:** duplicate phone không thành email; 403 do hạng gói hiển thị lý do quyền lợi; lỗi phòng/HLV trùng giờ có ngày giờ Việt Nam và nội dung hữu ích; không lộ lỗi SQL/password/token.

### BR-19 — P2: số liệu hội viên/gói không dùng cùng định nghĩa

- **Bằng chứng:** `reports.service.ts:67–87`: activeMembers distinct memberId nhưng membersByTier groupBy đếm số subscription; thiếu startDate và user role/active. `:164–198` activeSubscriptions dựa raw status, không endDate. Member list/get chọn sub endDate lớn nhất còn membership-status/book ưu tiên tier.
- **Tái hiện:** một người có hai ACTIVE cùng tier → activeMembers=1, tier count=2; future gói tính active; user đổi role còn được memberProfile.count tính vào tổng; FREE và expired bị gộp cùng total-active.
- **Cần sửa:** tách metrics “người”, “hợp đồng”, “hợp đồng hiệu lực”; một entitlement/person/asOf; phân biệt chưa từng mua, đã hết, bị khóa; thống nhất phạm vi ngày là snapshot hay phát sinh trong kỳ.

### BR-20 — P2: doanh thu và lượt tham gia có định nghĩa dễ gây sai quyết định

- **Bằng chứng:** revenue `reports.service.ts:9` lọc createdAt, không paidAt; enrollment `:105` biến totalEnrollments chỉ count BOOKED nhưng top/byType lấy mọi status; membership report kết hợp tổng mọi thời điểm với new trong kỳ.
- **Tái hiện:** payment PENDING tháng 8, SUCCESS tháng 9 vẫn được gom theo ngày tạo tháng 8; một enrollment COMPLETED không góp totalEnrollments nhưng vẫn góp top class. Hủy/hoàn tiền sau này thay đổi số lịch sử vì chỉ nhìn trạng thái hiện tại.
- **Cần sửa:** chốt báo cáo cash collected, net/refund hay sales; đặt nhãn và tiêu chí đúng. Nếu báo cáo thu tiền, dùng event paid/refunded theo thời điểm ghi nhận, không chỉ current status. Định nghĩa tổng đăng ký khác số buổi thực sự tham gia.

### BR-21 — P2: FE danh sách hội viên bị cắt và hiểu sai “sắp tới”

- **Bằng chứng:** BrowseClasses page state có nhưng không có nút next/prev, limit12; MyClasses không truyền page (BE default10); ClassDetail getSchedules không startAfter/page (BE sort start asc/default10); Membership subscriptions default10; Schedule/Attendance chỉ limit50; Dashboard/Notifications chỉ BOOKED limit5, BE sort bookedAt desc.
- **Tái hiện:** hơn 12 lớp không thể xem hết; ca SCHEDULED cũ chiếm 10 kết quả khiến không thấy ca tương lai; >10 subscriptions làm gói còn hiệu lực bị đẩy khỏi trang đầu; buổi BOOKED đã qua vẫn được gọi “sắp diễn ra”.
- **Cần sửa:** endpoint phân trang/bộ lọc khoảng thời gian rõ ràng; UI đọc pagination thật; API entitlement riêng thay vì suy từ lịch sử trang1; upcoming lọc start>now và sort startTime. Kết quả rỗng phải khác lỗi query; ClassDetail hiện chưa trình bày riêng lỗi tải schedules.

### BR-22 — P2: điểm danh chưa có đường ghi dữ liệu hoàn chỉnh

- **Bằng chứng:** `AttendancePage.tsx:10` đọc COMPLETED; toàn BE enrollment chỉ có create/cancel/list. Schedule status COMPLETED không cập nhật enrollment. Không có model check-in/attendance trong Prisma.
- **Cần bổ sung:** ai điểm danh, lớp được phân công, khung thời gian, có mặt/vắng/đi trễ, chống ghi trùng, sửa điểm danh có lịch sử, dữ liệu thống kê. Không dùng “đã qua giờ” suy thành “đã tham gia”. UI đang hứa lịch sử do HLV điểm danh trong khi HLV chưa có màn hình/API ghi.

### BR-23 — P2: portal HLV chưa thực hiện nghiệp vụ

- **Bằng chứng:** `features/coach/CoachLayout.tsx` map cả dashboard/schedule/classes/profile sang Placeholder; role login/router đã có.
- **Cần bổ sung:** lịch dạy và lớp của tôi, roster có scope, hồ sơ tự xem/sửa theo quyền, điểm danh khi backend sẵn sàng. Login thành công vào coach hiện không đồng nghĩa vận hành HLV được.

### BR-24 — P2: thông báo không phải lịch sử sự kiện, kế hoạch chỉ là gợi ý tĩnh

- **Bằng chứng:** NotificationsPage tạo array từ dữ liệu hiện tại + welcome; không model notification/đọc/gửi. TrainingPage tạo recommendations từ map BEGINNER/INTERMEDIATE/ADVANCED, không gọi API kế hoạch.
- **Cần bổ sung:** tách “nhắc trên màn hình” khỏi “thông báo thay đổi lịch”; event sau commit, lưu recipient/readAt, tránh gửi trùng, retry. Kế hoạch thật cần assignment của coach, bài tập, tiến độ và phiên bản. Đây là phạm vi chưa triển khai, không khẳng định bắt buộc phải thêm AI.

### BR-25 — P2: danh mục gói và hóa đơn thiếu tính ổn định lịch sử

- **Bằng chứng:** plan create `:29` chỉ precheck name (không unique DB), update không check name; subscription lưu tier/start/end và payment lưu amount nhưng invoice include `payment.subscription.plan` và member.user lấy tên hiện tại.
- **Tái hiện:** đổi tên gói/người dùng khiến hóa đơn cũ hiển thị tên mới; đổi plan tier khiến plan.tier khác subscription.tier cũ. Hai request create plan cùng tên có thể cùng thành công.
- **Cần sửa:** xác định trường là snapshot hợp đồng/chứng từ và trường chỉ tham chiếu hiện tại; version gói/điều khoản nếu cần. DB unique tên chuẩn hóa nếu nghiệp vụ yêu cầu; không tự tính lại tiền lịch sử bằng giá plan mới. Quy định mẫu số chứng từ là quyết định vận hành; báo cáo không khẳng định đây là hóa đơn điện tử hợp lệ theo pháp luật.

### BR-26 — P2: ranh giới ngày và múi giờ chưa thống nhất

- **Bằng chứng:** schedules `:75` parse date rồi setDate; reports `:7` setHours theo timezone process; payments/invoices endDate lọc `lte new Date(endDate)` không tự hết ngày; subscription duration dùng setDate; FE dùng giờ trình duyệt.
- **Tái hiện cần integration:** lọc ngày ở server UTC so với Asia/Ho_Chi_Minh cho kết quả khác; endDate dạng YYYY-MM-DD ở payments có thể bỏ các giao dịch sau 00:00 ngày cuối, trong khi report lấy hết ngày.
- **Cần sửa:** chọn timezone nghiệp vụ, lưu instant UTC; query khoảng `[đầu ngày, đầu ngày kế tiếp)` đã quy đổi; xác định ngày gói theo lịch hay số giờ; cùng utility cho FE/BE/report. Kiểm thử sát 00:00 và đúng thời điểm hết hạn.

### BR-27 — P2: vòng đời phiên còn thiếu bảo vệ và có nguy cơ trùng token

- **Bằng chứng:** `utils/jwt.ts` ký refresh từ id/role, không jti/nonce; auth.login mỗi lần create RefreshToken có token unique. Hai login cùng user/role trong cùng giây có thể cho JWT giống nhau. Refresh trả access mới, không rotate refresh; app không có rate limiting; refresh token lưu nguyên văn trong DB.
- **Cần sửa:** session ID/jti duy nhất; lưu hash token, rotation/reuse detection nếu chọn mô hình đó; giới hạn thử login theo tài khoản/IP hợp lý, cleanup phiên hết hạn. Quên mật khẩu/email verification chưa có API trong source.
- **Giới hạn:** nguy cơ token cùng giây suy từ cấu trúc JWT/library payload, chưa chạy probe JWT hoặc thử đăng nhập thật trong audit này.

### BR-28 — P2: hợp đồng FE/API chưa phản ánh đầy đủ code BE

- **Bằng chứng:** `FE/docs/MISSING_API.md` ghi thiếu requestBody của PATCH users/members/plans, trong khi các schema BE đã định nghĩa body; snapshot operations quyết định form/action của ResourcePage. Tài liệu còn câu “FE khóa toàn bộ workspace MANAGER”, đã lỗi thời so với RoleRouter bốn vai trò hiện tại.
- **Cần sửa:** lấy routes+schema BE làm căn cứ cập nhật OpenAPI response/request/query, xác minh identifiers userId/profileId, security casing; generate types/operations và test contract. “FE chưa có form sửa do thiếu contract” phải phân biệt “BE chưa có API”. Phân trang thiếu tài liệu không đồng nghĩa BE không phân trang.

## 6. Quy tắc trạng thái cần thống nhất trước khi sửa

Đây là **đề xuất**, không phải mô tả hệ thống đã làm đúng. Chốt với chủ dự án rồi mới implement.

| Đối tượng | Chuyển trạng thái đề xuất | Điều kiện và tác động cần xác định |
|---|---|---|
| Subscription | Chờ hiệu lực → hiệu lực → hết hạn | “Chờ hiệu lực” có thể là trạng thái suy ra từ startDate, không nhất thiết thêm enum; không cấp sớm |
| Subscription | Hiệu lực ↔ bảo lưu; hiệu lực/bảo lưu → hủy | Ai được thao tác, lý do, có cộng ngày, số lần/ngày tối đa; hủy có hoàn tiền hay không |
| Schedule | SCHEDULED → CANCELLED hoặc COMPLETED | Hủy cùng enrollment trong transaction; complete chỉ sau end; phục hồi phải có quyền và kiểm tra lại conflict |
| Enrollment | BOOKED → CANCELLED; BOOKED → trạng thái tham dự | Cancel trước deadline; completion dựa điểm danh; CANCELLED→BOOKED chỉ nếu cho đặt lại và đủ điều kiện |
| Payment | PENDING → SUCCESS/FAILED; SUCCESS → REFUNDED | SUCCESS không quay tùy ý về PENDING; retry SUCCESS là no-op; refund đầy đủ/một phần cần mô hình phù hợp |
| Invoice | ISSUED → CANCELLED hoặc chứng từ điều chỉnh | Không tự đảo nhãn để che mất lịch sử; liên kết chứng từ cũ/mới nếu cần |
| User | Active ↔ Inactive; đổi role | Thu hồi quyền phiên; xử lý lớp/gói liên quan; bảo vệ quyền quản trị cuối cùng |

Các invariant nên kiểm tra ở service và nơi phù hợp ở DB:

- Payment.memberId khớp Subscription.memberId; Invoice.memberId khớp Payment.memberId; Enrollment.classId khớp Schedule.classId.
- start<end; amount/total không âm; discount trong miền hợp lệ; total=subtotal-discount theo quy tắc làm tròn đã chọn.
- Không vượt sức chứa, không trùng resource, không có hai primary của một lớp nếu quy định một primary.
- Mọi quyền “của tôi” xuất phát từ identity server; không tin memberId/coachId do FE gửi.
- Một yêu cầu nghiệp vụ có retry chỉ tạo một kết quả, kể cả mất mạng sau khi server commit.
- Một gói/ca bị inactive ở danh mục không được âm thầm làm mất quyền đã trả tiền; ngừng bán và vô hiệu hóa quyền lợi là hai hành động cần phân biệt rõ.

Migrations hiện có unique và FK cho từng quan hệ, **không có CHECK/EXCLUDE/TRIGGER** bảo vệ các invariant liên bảng/thời gian nêu trên. FK tồn tại không chứng minh payment thuộc đúng chủ subscription. Một số invariant cần domain transaction thay vì cố dồn hết vào schema.

## 7. Những chức năng chưa có — không tự xem tất cả là yêu cầu bắt buộc

| Hạng mục | Hiện trạng | Đề nghị |
|---|---|---|
| Điểm danh có người xác nhận | UI đọc có, backend ghi chưa có | Ưu tiên hoàn thiện vì đã xuất hiện trong điều hướng |
| Portal HLV | Placeholder | Ưu tiên lịch/lớp/roster scoped |
| Audit log | Không có model/API | Cần cho thay quyền, thu/hoàn tiền, sửa lịch, sửa điểm danh |
| Thanh toán online/webhook | Chỉ CASH/BANK_TRANSFER ghi nhận nội bộ | Chốt thanh toán thủ công trước; không gọi chuyển khoản là đã xác thực tự động |
| Refund một phần/đối soát công nợ | Chỉ enum REFUNDED và đổi trạng thái | Thiết kế nếu nghiệp vụ cần; hiện chưa có giao dịch hoàn thực |
| Đóng băng/nâng hạng/bù tiền | Chỉ status SUSPENDED và create/renew | Chốt chính sách, lịch sử, giá trị còn lại |
| Waitlist/no-show/phạt/hạn mức tuần | Chưa có model/luồng | Tùy vận hành; không tự áp phạt |
| Ngày nghỉ/giờ mở cửa/bảo trì phòng | Chưa có lịch ràng buộc riêng | Cần nếu trung tâm vận hành theo khung giờ |
| Quên mật khẩu/xác minh liên hệ | Chưa có API | Ưu tiên cho đăng ký public thực tế |
| Thông báo lưu bền/email/push | Chưa có | Thiết kế sự kiện hủy/dời lịch, expiry, payment sau khi dữ liệu core ổn |
| Kế hoạch luyện tập/tiến độ/AI | Hồ sơ + nội dung tĩnh/file UI | Future phase theo README; không quảng bá là cá nhân hóa đầy đủ |
| Quyền tùy biến nhiều vai trò | Chỉ một enum role/user | Bốn vai trò cố định có thể đủ; cần chốt trước khi xây RBAC động |
| Đặt sân riêng (ví dụ cầu lông) | Chưa có model slot/giá sân/booking sân | Lớp thể thao không đồng nghĩa thuê sân; video landing không chứng minh có nghiệp vụ này |
| Thiết bị, kho, bảo trì, chi nhánh | Chưa có | Ngoài scope core hiện tại nếu chưa được yêu cầu |
| Thuế/khuyến mãi/voucher | Invoice discount mặc định0, chưa quy trình áp dụng | Chốt yêu cầu trước; không giả định đã có vì tồn tại field discount |

## 8. Bộ tình huống nghiệm thu nên bổ sung

Mỗi case chạy qua API thực trên DB test độc lập, không chỉ mock FE. Đối với concurrency cần nhiều kết nối PostgreSQL và xác nhận trạng thái cuối DB.

| Case | Chuẩn bị / thao tác | Kết quả cần đạt sau khi chốt rule |
|---|---|---|
| T01 | A đọc subscriptions của B qua cả hai kiểu ID | Bị từ chối; đọc chính mình được |
| T02 | U gửi body memberId người khác khi book | Chỉ tác động chính mình hoặc reject, không đặt cho B |
| T03 | C không phụ trách lớp đọc roster/đặt/hủy hộ | Đúng allowlist + scope; không vô tình được quyền như staff |
| T04 | Khóa/hạ quyền user rồi dùng token cũ | Không mutation bằng quyền đã thu hồi |
| T05 | PATCH tự khóa quản lý cuối cùng | Bị chặn bằng invariant chung |
| T06 | Đổi mật khẩu/logout rồi thử phiên cũ | Đúng chính sách thu hồi được chốt |
| T07 | Hai login cùng giây | Hai phiên hợp lệ hoặc cùng một phiên có chủ đích; không lỗi unique |
| T08 | Duplicate phone/email chuẩn hóa, phone rỗng | Lỗi đúng field/code tiếng Việt; optional không gây unique rỗng |
| T09 | DOB sai/tương lai, amount quá precision, tên khoảng trắng | 4xx rõ ràng; không lỗi500 hoặc mất độ chính xác im lặng |
| T10 | Future PREMIUM + current MEMBERSHIP | Không dùng PREMIUM trước startDate |
| T11 | Tại đúng start/end và trước/sau1ms | Một quy ước biên duy nhất trên FE/BE/report |
| T12 | Renew cùng gói hai lần / song song | Nối kỳ hoặc idempotent theo operation, không chồng tiền/quyền lợi |
| T13 | Lỗi payment/invoice giữa bán gói | Rollback toàn bộ hoặc trạng thái pending được thiết kế rõ |
| T14 | Retry request sau timeout nhưng đã commit | Không thu hai lần, trả kết quả có thể đối soát |
| T15 | 20 người tranh một chỗ | Chỉ một booking thêm; mọi số đếm nhất quán |
| T16 | Một hội viên book hai ca giao nhau đồng thời | Không cùng commit nếu cấm trùng lịch |
| T17 | Book→cancel→rebook | Hành vi đúng chính sách, không P2002 chung |
| T18 | FREE/normal/premium đặt từng loại lớp | Ma trận quyền lợi đúng, staff không vô tình bypass điều kiện hội viên |
| T19 | Gói hết trước ngày ca / user inactive / class inactive | Quyền lợi tại thời điểm đã chốt được enforce server-side |
| T20 | Phòng nhỏ, giảm sức chứa dưới số chỗ đã đặt | Bị chặn hoặc quy trình chuyển ca rõ ràng |
| T21 | Tạo/sửa hai lịch cùng phòng/HLV đồng thời | Không overlap; hai ca sát nhau được/không theo buffer đã chốt |
| T22 | PATCH chỉ endTime<start; kích hoạt lịch đã hủy | Reject dữ liệu sai; reactivation check conflict |
| T23 | Gán HLV sau khi hai lớp đã có lịch trùng | Reject phân công hoặc yêu cầu giải quyết lịch |
| T24 | Dời ca có người đã đặt sang giờ họ bận | Không âm thầm gây xung đột; có flow thông báo/hủy theo policy |
| T25 | DELETE bị chặn rồi thử PATCH isActive=false | Cùng invariant cho user/sport/room/class/plan |
| T26 | Payment memberA + subB; sub đã đủ tiền | Không gắn sai chủ/thu trùng nghĩa vụ |
| T27 | SUCCESS lặp, SUCCESS→PENDING, REFUNDED→SUCCESS | Chuyển trạng thái hợp lệ, không thay paidAt/hóa đơn tùy ý |
| T28 | Refund và hóa đơn lỗi giữa chừng | Atomic/đối soát; quyền lợi gói nhất quán theo policy |
| T29 | Một người có nhiều gói, gói tương lai/quá hạn | Active/tier counts đếm đúng người và mốc thời gian |
| T30 | PENDING tháng trước, thu tháng này; hoàn tháng sau | Báo cáo đúng định nghĩa và kỳ kế toán/thu tiền đã chốt |
| T31 | >12 lớp, >10 lịch/gói, >50 booking | Xem đủ qua pagination/date range; total không lấy length trang1 |
| T32 | Lịch BOOKED đã qua + lịch tương lai | Upcoming không nhắc buổi quá khứ; thứ tự theo startTime |
| T33 | HLV điểm danh hai lần/sửa điểm danh | Idempotent, phân công đúng, có actor/time/history |
| T34 | Hủy/dời lịch | Thông báo gửi sau commit đúng người, không trùng do retry |
| T35 | Lọc ngày VN sát 00:00 trên server UTC | Cùng kết quả với server timezone khác |
| T36 | Sửa tên/giá plan hoặc tên người mua | Chứng từ/gói cũ giữ dữ liệu snapshot theo yêu cầu |
| T37 | Role MEMBER/STAFF/COACH/MANAGER login và deep link | Vào đúng portal, không dùng route guard thay cho API authorization |
| T38 | Mọi rule trả lỗi dự kiến | Đúng HTTP/code/field; FE hiển thị tiếng Việt đúng nghĩa |

Chạy probe hiện tại từ root:

```powershell
node --test docs/audit/business-rule-probes.cjs
```

Kết quả audit: 10 probes, 10 pass, 0 fail; không có request ra mạng hay kết nối DB. Các case T01–T38 là **kế hoạch nghiệm thu cần thực thi khi sửa**, không phải tuyên bố đã chạy.

## 9. Thứ tự triển khai đề xuất

| Đợt | Công việc | Điều kiện hoàn tất |
|---|---|---|
| 1 — Chặn quyền sai | BR-01/02/03/12 và bảo vệ quản trị cuối cùng | Test API actor×resource; token bị thu hồi; PATCH không bypass DELETE |
| 2 — Bảo vệ tiền và quyền lợi | BR-04/05/13/14/15, idempotency, transaction | Fault-injection + retry + trạng thái payment/invoice/sub nhất quán |
| 3 — Đặt lịch chắc chắn | BR-06/07/08/09/10/11 | PostgreSQL concurrency tests, capacity/time/active invariant, phân công HLV |
| 4 — Dữ liệu và trải nghiệm | BR-16..21/25..28 | Contract cập nhật, error codes dịch đủ, pagination, báo cáo/múi giờ đúng |
| 5 — Hoàn thiện module dang dở | BR-22/23/24 + audit log | Coach vận hành được; điểm danh ghi thật; thông báo có lifecycle |
| Sau đó | AI, waitlist, thuê sân, nhiều chi nhánh, khuyến mãi | Chỉ triển khai theo scope được chốt |

Không nên sửa riêng FE để che lỗi BE. Thứ tự an toàn cho mỗi rule: xác nhận chính sách → test hành vi mong đợi → service/transaction/constraint → error contract → FE → integration/concurrency test → cập nhật tài liệu. Khi thêm constraint cần kiểm tra dữ liệu cũ vi phạm trước khi migrate; báo cáo này chưa sửa/xóa dữ liệu để “làm sạch”.

## 10. Các quyết định cần chủ dự án chốt

1. Một người dùng chỉ có một vai trò hay có thể vừa HLV vừa hội viên? Khi đổi role, gói và lớp cũ xử lý thế nào?
2. HLV được xem những thông tin nào của hội viên, có đặt/hủy hộ không, chỉ lớp mình hay cả trung tâm?
3. Quyền gói kiểm tra ở lúc đặt hay lúc học? Một người có nhiều gói đồng thời không? Ưu tiên hạng cao nhất hay gói được chỉ định?
4. Gia hạn/nâng/hạ hạng áp dụng ngay hay sau kỳ hiện tại; có bù tiền/phần ngày còn lại không?
5. SUSPENDED là bảo lưu ngày hay khóa quyền; ai duyệt; số lần và thời gian tối đa?
6. Hạn hủy trước giờ học, vắng mặt, phạt và đặt lại sau hủy áp dụng ra sao?
7. Chuyển khoản do nhân viên xác nhận thủ công hay phải chờ đối soát/webhook? Cho thu nhiều đợt/chiết khấu không?
8. Khi hoàn tiền/hủy gói, các booking tương lai bị hủy, giữ hay yêu cầu mua gói khác?
9. Giờ mở cửa, ngày nghỉ, thời gian dọn phòng giữa ca; có cấm cùng lớp chạy đồng thời hai phòng không?
10. “Doanh thu”, “hội viên active”, “lượt tham gia” là chỉ số nào, tính ở mốc thời gian nào và múi giờ nào?
11. Chính sách điểm danh: người có quyền, sớm/muộn bao lâu, sửa có duyệt hay không?
12. Thông tin trên hóa đơn và điều khoản gói có cần lưu snapshot bất biến; có quy trình chứng từ điều chỉnh không?

Các câu hỏi này không ngăn việc sửa lỗi rõ ràng như đọc dữ liệu người khác, sai chủ thanh toán, PATCH end<start hoặc ghi dở dang. Chúng ngăn việc tự áp đặt một chính sách thương mại chưa được yêu cầu.
