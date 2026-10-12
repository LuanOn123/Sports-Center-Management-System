# SCMS — Đặc tả nghiệp vụ và ràng buộc triển khai cho AI

Phiên bản: 1.0 | Ngày: 04/10/2026 | Ngôn ngữ đặc tả: Tiếng Việt

## 0. Cách dùng và mức độ ràng buộc

Đây là tài liệu định hướng triển khai Sports Center Management System (SCMS) theo mô hình 5 role. AI phải đọc toàn bộ tài liệu trước khi phân tích hoặc sửa code. Tài liệu mô tả hành vi mong muốn; không khẳng định các entity, API hoặc tính năng này đã tồn tại trong repository.

Ba nhãn sử dụng xuyên suốt:

- **CORE**: yêu cầu trực tiếp từ chủ dự án và các ràng buộc tối thiểu để yêu cầu đó hoạt động nhất quán.
- **DEFAULT**: chính sách đề xuất nhằm đóng các điểm còn mơ hồ. Đây là giả định cho bản triển khai đầu tiên, không phải quyết định đã được chủ dự án xác nhận. Tập trung các giá trị này vào cấu hình/chính sách; báo rõ khi triển khai. Nếu code hiện tại có chính sách khác ảnh hưởng dữ liệu hoặc quyền lợi người dùng, trình bày khác biệt trước khi chuyển đổi.
- **EXTENSION**: ý tưởng mở rộng chưa chốt. Không triển khai trừ khi được yêu cầu riêng.

Khi mâu thuẫn: chỉ dẫn mới và rõ ràng của chủ dự án > CORE của tài liệu này > DEFAULT > hành vi cũ trong code. Không dùng hành vi cũ để bỏ qua CORE. Không tự thay đổi CORE khi gặp khó khăn kỹ thuật.

Mục tiêu chống lệch phạm vi: triển khai một chuỗi nghiệp vụ đầy đủ từ cơ sở, tài nguyên, lớp học đến đăng ký, buổi học, điểm danh và thanh toán. Không biến mỗi entity thành CRUD độc lập thiếu kiểm tra liên quan.

## 1. Mục tiêu và phạm vi

**CORE**: Hệ thống quản lý nhiều cơ sở thể thao. Mỗi cơ sở có phòng/khu tập; bộ môn có yêu cầu tài nguyên; Manager tạo lớp và lịch dựa trên phòng phù hợp, Coach phù hợp và các slot thời gian. Member đăng ký cả lớp theo quyền lợi gói. Receptionist hỗ trợ tư vấn, ghi nhận đến cơ sở và bán gói tại quầy. Coach quản lý buổi học và điểm danh lớp. Admin quản trị dữ liệu dùng chung, cơ sở, tài khoản và doanh thu toàn hệ thống.

Trong tài liệu, “phòng” bao gồm phòng có dụng cụ, phòng không có dụng cụ, hồ bơi và sân thể thao. “Member miễn phí” là tài khoản Member chưa có gói hợp lệ, không phải role thứ sáu.

Luồng dữ liệu chính:

`Facility → Room + Capabilities → Subject + Requirements → Class + SchedulePattern → Sessions → Enrollment → Attendance`

Luồng quyền lợi:

`MembershipPlan → Order → VerifiedPayment → Subscription → Enrollment eligibility`

## 2. Từ điển nghiệp vụ — không dùng lẫn khái niệm

| Khái niệm | Ý nghĩa | Không được hiểu thành |
|---|---|---|
| Facility | Cơ sở có địa chỉ, giờ hoạt động và nhân sự | Một phòng tập |
| Room | Tài nguyên/khu tập thuộc đúng một cơ sở | Một lớp học |
| Subject | Bộ môn như Yoga, Bơi, Bóng đá; có yêu cầu chuyên môn và tài nguyên | Một khóa có ngày khai giảng |
| Class | Một khóa cụ thể, có bộ môn, cơ sở, thời gian, sĩ số và danh sách đăng ký | Một buổi học đơn lẻ |
| SchedulePattern | Quy tắc lặp theo thứ trong tuần và slot của một lớp | Dữ liệu điểm danh |
| Session | Một buổi học cụ thể, có thời điểm bắt đầu/kết thúc, phòng và Coach thực tế | Toàn bộ khóa |
| Slot | Khung giờ được cấu hình cho việc xếp lịch | Chỉ một tên hoặc số để so sánh trùng lịch |
| Enrollment | Đăng ký tham gia cả khóa | Booking riêng một buổi |
| MembershipPlan | Mẫu gói, giá, thời hạn và quyền lợi | Gói đang có hiệu lực của một Member |
| Subscription | Quyền lợi gói đã mua của một Member, có khoảng hiệu lực | Chỉ thông tin tên gói |
| FacilityCheckIn | Ghi nhận Member đã đến cơ sở | Kết luận đã tham gia lớp |
| ClassAttendance | Kết quả tham dự một Session | Lịch sử ra vào cơ sở |
| MemberIssue | Phản ánh/khiếu nại do Member gửi | Báo cáo thống kê doanh thu |

**CORE**: Không tạo role `PREMIUM` hoặc `MEMBERSHIP`. Hai mức đó là quyền lợi của Member. `Guest` là trạng thái chưa đăng nhập, không phải role nhân sự.

## 3. Role và phạm vi truy cập

### BR-AUTH-01 — Năm role chính [CORE]

Tên chuẩn dùng trong tài liệu: `ADMIN`, `MANAGER`, `COACH`, `RECEPTIONIST`, `MEMBER`. Khi code cũ dùng `manage` hoặc `reception`, tạo mapping/migration tương thích; không duy trì hai tập quyền mâu thuẫn.

### BR-AUTH-02 — Quyền theo cơ sở và tài nguyên [CORE]

- Admin có phạm vi toàn hệ thống.
- Manager và Receptionist chỉ thao tác dữ liệu của cơ sở được phân công.
- Coach chỉ vận hành Session/lớp được phân công, kể cả phân công thay thế hợp lệ.
- Member chỉ sửa dữ liệu cá nhân và thao tác Enrollment, Subscription, Attendance, Issue của mình.
- Role hợp lệ chưa đủ: backend phải kiểm tra cả cơ sở, quan hệ với tài nguyên, trạng thái và hành động cụ thể.
- API danh sách, chi tiết, cập nhật, thống kê, export và chat đều phải áp dụng scope. Không chỉ ẩn nút trên frontend.
- Không tin `facilityId`, `memberId`, `role`, `price` hoặc `maxActiveClasses` do client gửi như bằng chứng quyền.

### BR-AUTH-03 — Phân công nhân sự [CORE + DEFAULT]

**CORE**: Một cơ sở có thể có nhiều Manager, Coach và Receptionist. Dùng quan hệ phân công nhân sự theo cơ sở thay vì chỉ một `managerId` trong Facility.

**DEFAULT**: Một tài khoản nhân sự có thể được phân công nhiều cơ sở. Mỗi hành động dùng role hiệu lực tại cơ sở đang thao tác. Nếu hệ thống hiện có một role trên User, giữ mô hình đó trong giai đoạn đầu và bổ sung phân công cơ sở; không tự viết lại toàn bộ hệ thống đa role.

### Ma trận quyền bắt buộc

| Nghiệp vụ | Admin | Manager | Coach | Receptionist | Member |
|---|---|---|---|---|---|
| Tạo/sửa/ngừng hoạt động cơ sở | Toàn hệ thống | Xem cơ sở phụ trách | Xem thông tin cần dùng | Xem cơ sở phụ trách | Xem cơ sở công khai |
| Tạo/sửa phòng, capability, sức chứa | Có | Xem, đề nghị xử lý sự cố | Xem phòng buổi dạy | Xem phòng cơ sở | Xem thông tin công khai |
| Quản lý bộ môn và requirement | Có | Chọn dữ liệu có sẵn | Xem bộ môn được giao | Xem để tư vấn | Xem |
| Tạo/sửa giá và quyền lợi gói | Có | Xem | Không | Chọn để bán | Xem để mua |
| Tạo Admin/Manager, gán role, khóa User | Có | Không gán role đặc quyền | Không | Không | Không |
| Phân công Coach/Receptionist vào cơ sở | Có | Có trong cơ sở phụ trách theo BR-STAFF-01 | Không | Không | Không |
| Tạo lớp, sinh lịch, đổi phòng/Coach, hủy buổi | Xem/giám sát | Có trong cơ sở phụ trách | Gửi yêu cầu | Xem để hỗ trợ | Xem lịch đăng ký |
| Gửi yêu cầu nghỉ/đổi lịch | Không áp dụng | Tiếp nhận | Cho lịch của mình | Không | Xin nghỉ buổi của mình nếu được hỗ trợ |
| Duyệt nghỉ và xử lý thay Coach | Không vận hành thường ngày | Có trong scope | Không tự duyệt | Không | Không |
| Ghi nhận đến cơ sở | Xem thống kê | Xem trong scope | Xem khi cần | Có trong scope | Xem lịch sử của mình |
| Chốt/sửa điểm danh lớp | Không mặc định | Sửa ngoại lệ có lý do | Cho buổi được giao | Không | Xem của mình |
| Tư vấn, nhắc lịch | Giám sát theo quyền | Giám sát trong scope | Chat lớp/buổi được giao | Chat Member cần hỗ trợ | Chat tư vấn/lớp của mình |
| Bán gói tại quầy | Xem/giám sát | Xem | Không | Có trong scope | Là người mua |
| Xem doanh thu | Tất cả cơ sở | Cơ sở phụ trách | Không | Giao dịch quầy thuộc scope công việc | Thanh toán của mình |
| Tiếp nhận/xử lý phản ánh | Theo dõi/escalation | Xử lý trong cơ sở | Gửi sự cố hoặc phản hồi được giao | Tiếp nhận/chuyển xử lý | Tạo/xem phản ánh của mình |

**CORE**: Admin không mặc nhiên có quyền điểm danh, thay Coach hoặc sửa giao dịch thanh toán thông qua quyền quản trị User. Nếu cần quyền hỗ trợ đặc biệt, phải được định nghĩa riêng và có audit.

### BR-STAFF-01 — Ranh giới quản lý User và nhân sự [CORE + DEFAULT]

Admin quản lý danh tính, role toàn hệ thống, khóa/mở User, phân công Manager. Manager quản lý phân công, lịch làm việc và trạng thái làm việc của Coach/Receptionist tại cơ sở mình; không khóa toàn cục một tài khoản đang làm ở cơ sở khác.

**DEFAULT**: Manager phân công tài khoản Coach/Receptionist có sẵn; tạo tài khoản nhân sự mới là quyền Admin cho bản đầu. Không tự mở rộng quyền tạo role đặc biệt.

Ngừng phân công Coach phải xử lý các Session tương lai bị ảnh hưởng. Không xóa lịch sử giảng dạy, điểm danh hoặc giao dịch khi nhân sự nghỉ việc.

## 4. Cơ sở, phòng, capability và bộ môn

### BR-FAC-01 — Cấu trúc cơ sở [CORE]

Facility tối thiểu có: mã/ID, tên, địa chỉ, thông tin liên hệ, múi giờ, lịch mở cửa và trạng thái. Mỗi Room thuộc đúng một Facility. Class thuộc một Facility; Room và nhân sự dùng cho mỗi Session phải có quan hệ hợp lệ với cơ sở đó.

### BR-FAC-02 — Giờ hoạt động và đóng cửa [CORE]

Mọi Session phải nằm trong giờ mở cửa cơ sở và thời gian Room khả dụng. Ngày đóng cửa, bảo trì hoặc khóa tài nguyên phải được xét theo ngày/giờ cụ thể. Phòng đang Active hôm nay vẫn có thể không dùng được ở ngày học tương lai.

Không ngừng hoạt động cơ sở/phòng có Session tương lai mà bỏ mặc lịch. Phải liệt kê lịch bị ảnh hưởng và chọn đổi tài nguyên, dời hoặc hủy buổi theo quy trình. Lịch sử giữ nguyên; không cascade delete.

### BR-ROOM-01 — Loại phòng không thay thế capability [CORE]

Room có `roomType` để phân nhóm; capability để kiểm tra yêu cầu. Ví dụ loại: phòng có dụng cụ, phòng không có dụng cụ, hồ bơi, sân bóng. Không giới hạn tất cả bộ môn vào bốn enum cứng nếu đã có hệ thống capability.

Capability có thể là `POOL`, `FOOTBALL_FIELD`, `OPEN_SPACE`, `YOGA_MAT`, `DUMBBELL`... Mỗi capability phải xác định rõ là dạng có/không hoặc dạng số lượng. Sức chứa và số lượng dụng cụ không được âm.

### BR-SUBJECT-01 — Requirement của bộ môn [CORE]

Subject có tên, trạng thái và tập requirement bắt buộc. Một Subject có thể yêu cầu nhiều capability đồng thời. Ví dụ Yoga cần không gian phù hợp và một thảm/người; Bơi cần hồ bơi. Tên và số lượng trong ví dụ là dữ liệu minh họa, không phải seed mặc định bắt buộc.

Phân biệt:

- Yêu cầu dạng có/không: Room phải có capability.
- Yêu cầu số lượng cố định: `availableQuantity >= requiredFixedQuantity`.
- Yêu cầu theo người: `availableQuantity >= quantityPerMember × class.maxMembers`.
- Sức chứa: `class.maxMembers <= room.capacity`.

Kiểm tra theo sĩ số tối đa đã công bố, không chỉ số người hiện đăng ký. Không chờ lớp gần đầy mới phát hiện thiếu dụng cụ. Dụng cụ dùng chung hoặc cho thuê giữa phòng là EXTENSION; bản đầu coi tài nguyên gắn với Room.

### BR-ROOM-02 — Phòng phù hợp tại từng buổi [CORE]

Mỗi Session phải dùng Room đáp ứng requirement, sức chứa và trạng thái khả dụng. Frontend lọc trước các phòng phù hợp; backend kiểm tra lại khi lưu. Không dùng lọc frontend làm điều kiện duy nhất.

Nếu Room thay đổi ở từng buổi, tất cả Room phải đáp ứng cùng sĩ số lớp. Tăng sĩ số, đổi bộ môn, đổi requirement hoặc giảm tài nguyên phải phân tích ảnh hưởng đến toàn bộ Session tương lai trước khi áp dụng.

**DEFAULT**: Snapshot requirement của Subject khi công bố Class. Sửa danh mục Subject áp dụng cho lớp mới; cập nhật lớp đã công bố phải là thao tác rõ ràng, có kiểm tra lại tài nguyên và audit. Không tự thay đổi lớp đang học chỉ vì Admin sửa danh mục.

### BR-COACH-01 — Chuyên môn và khả dụng [CORE]

Coach phải có chuyên môn tương ứng Subject, phân công hợp lệ tại Facility, tài khoản hoạt động, không nghỉ được duyệt và không trùng lịch. Nếu bộ môn cấu hình chứng chỉ bắt buộc, chứng chỉ phải hợp lệ vào thời điểm Session; không bắt tất cả bộ môn có chứng chỉ chỉ vì schema có trường đó.

Lọc Coach phù hợp khi tạo/đổi lịch và kiểm tra lại ở backend. Đổi Coach không bỏ qua các điều kiện này.

## 5. Lớp học, slot và sinh Session

### BR-CLASS-01 — Đăng ký theo khóa [CORE]

Một Class là khóa có ngày khai giảng/kết thúc, thường khoảng một tháng, thông thường học hai ngày/tuần theo slot. Member đăng ký một lần vào cả Class và xuất hiện trong roster các Session hợp lệ của Class.

**DEFAULT**: Cho cấu hình ngày bắt đầu/kết thúc và số ngày/tuần, preset khoảng một tháng và hai ngày/tuần. Không hard-code 30 ngày hoặc đúng 8 buổi; số buổi phụ thuộc lịch thực tế và ngày nghỉ.

### BR-SLOT-01 — Slot được quản lý tập trung [CORE + DEFAULT]

Slot có mã, giờ bắt đầu/kết thúc và trạng thái; thời lượng phải dương. Manager chọn slot có sẵn khi lập pattern, không tự nhập giờ tùy ý trong luồng chuẩn.

**DEFAULT**: Admin cấu hình slot theo cơ sở. Các khung 06:00–07:30, 18:00–19:30... chỉ là ví dụ, không tự seed nếu chưa có quyết định.

Session phải lưu thời điểm thực tế. Sửa Slot không được âm thầm đổi giờ các Session đã sinh. Hai slot khác mã vẫn có thể chồng giờ; luôn kiểm tra khoảng thời gian.

### BR-CLASS-02 — Trạng thái lớp [DEFAULT]

`DRAFT → OPEN_FOR_REGISTRATION → IN_PROGRESS → COMPLETED`

`DRAFT`, `OPEN_FOR_REGISTRATION` hoặc `IN_PROGRESS` có thể sang `CANCELLED` qua thao tác hợp lệ có lý do. `COMPLETED` và `CANCELLED` là trạng thái cuối của luồng chuẩn.

- Draft không cho Member đăng ký.
- Chỉ mở đăng ký sau khi các Session dự kiến đã sinh và vượt kiểm tra.
- Khi bắt đầu khóa, đóng đăng ký thông thường.
- Chỉ Completed khi mọi Session còn phải tổ chức đã kết thúc/được xử lý; không chỉ dựa vào ngày kết thúc cũ nếu có học bù.
- Hủy Class phải xử lý các Session tương lai, Enrollment và thông báo. Không xóa lịch sử.

### BR-SESSION-01 — Trạng thái buổi [DEFAULT]

`SCHEDULED → IN_PROGRESS → COMPLETED`; từ `SCHEDULED` có thể sang `CANCELLED`.

Dời buổi giữ nguyên ID Session và lưu lịch sử giờ/phòng/Coach trước đó. Không tạo bản sao khiến một buổi có hai roster/điểm danh. Không dùng `RESCHEDULED` như trạng thái cuối khiến không rõ buổi còn học hay không.

### BR-SCHED-01 — Sinh lịch lặp [CORE]

Pattern gồm thứ trong tuần, slot, Room mặc định và Coach mặc định. Sinh tất cả Session trong khoảng ngày của Class theo múi giờ Facility. Giữ kết quả preview: ngày, giờ, Room, Coach và các lỗi theo từng buổi.

**DEFAULT**: Ngày nghỉ phải hiện trong preview để Manager chủ động chọn bỏ buổi hoặc dời; không âm thầm bỏ buổi và làm giảm thời lượng khóa đã công bố.

Việc công bố lịch phải có tính toàn vẹn: có lỗi ở một buổi thì không mở đăng ký với một bộ lịch thiếu. Có thể giữ bản Draft để sửa, nhưng không công bố một phần như lớp đã hoàn chỉnh. Gọi sinh lịch lại không được tạo Session trùng.

### BR-SCHED-02 — Xung đột tài nguyên [CORE]

Hai khoảng `[startA, endA)` và `[startB, endB)` chồng nhau khi:

```text
startA < endB AND startB < endA
```

Chặn Session còn hiệu lực nếu trùng Room, trùng Coach hoặc trùng một Class. Kiểm tra cả các Session vừa sinh trong cùng request và lịch đã có. Lịch Cancelled không giữ tài nguyên. Session Completed giữ lịch sử và không cho tạo lại lịch quá khứ để né kiểm tra.

**DEFAULT**: Hai buổi liền nhau có thể tiếp giáp nếu chưa có buffer. Thời gian chuẩn bị phòng, di chuyển giữa cơ sở và buffer theo môn là chính sách mở rộng; không tự đặt một con số rồi coi đã được chốt.

### BR-SCHED-03 — Sửa lịch đã có người học [CORE]

Khi đổi giờ, phòng, Coach, pattern hoặc kéo dài khóa: kiểm tra lại requirement, sức chứa, nhân sự, nghỉ phép, xung đột và giờ hoạt động. Kiểm tra thêm lịch và quyền lợi gói của tất cả Member bị ảnh hưởng; không chỉ kiểm tra của người đang thao tác.

Không viết lại Session quá khứ/đã chốt điểm danh khi sửa pattern tương lai. Không xóa rồi sinh lại toàn bộ Session làm mất Attendance. Mọi thay đổi đã công bố cần lý do, audit và thông báo đúng người bị ảnh hưởng.

**DEFAULT**: Nếu thay đổi gây trùng lịch Member hoặc vượt hiệu lực gói, chặn thao tác thông thường và trả danh sách xung đột để Manager chọn phương án khác. Gia hạn miễn phí, chuyển lớp hoặc hoàn tiền là quy trình riêng chưa được chốt; không tự kích hoạt.

## 6. Gói tập và đăng ký lớp

### BR-PLAN-01 — Ba mức quyền lợi [CORE]

| Mức | Xem lớp sắp khai giảng | Tư vấn Receptionist | Đăng ký lớp | Giới hạn |
|---|---|---|---|---|
| Free / không có gói hợp lệ | Có | Có | Không | 0 |
| Membership | Có | Có | Có khi gói hợp lệ | 3 lớp |
| Premium | Có | Có | Có khi gói hợp lệ | 6 lớp |

**CORE**: “Gói bình thường” trong mô tả được hiểu là Free khi không có quyền đăng ký. Nếu code hiện tại có một gói trả phí tên Basic, không tự xóa/gộp dữ liệu; xác định mapping trước.

### BR-PLAN-02 — Snapshot gói [CORE]

Plan có tên/tier, giá, đơn vị tiền tệ, thời hạn, `maxActiveClasses`, phạm vi cơ sở và trạng thái bán. Giá không âm, thời hạn dương, giới hạn không âm. Free không cần một Subscription trả phí giả.

Order và Subscription giữ snapshot giá/quyền lợi đã mua. Admin đổi Plan không làm thay đổi hồi tố giá hoặc quyền lợi của Subscription đã bán. Ngừng bán Plan không làm mất quyền của người đã mua còn hiệu lực.

**DEFAULT**: Giá cấu hình bằng VND với kiểu dữ liệu tiền phù hợp; không dùng phép tính float thiếu kiểm soát. Quyền lợi Membership/Premium chỉ khác số lớp trong MVP. Không tự thêm ưu tiên, freeze hoặc lớp đặc biệt.

### BR-ENR-01 — Cách tính 3/6 lớp [DEFAULT]

Chọn `maxActiveClasses`: số Enrollment đang giữ chỗ trong các Class sắp bắt đầu hoặc đang học tại thời điểm đăng ký.

```text
countedEnrollment = Enrollment.ACTIVE
                    AND Class.status IN (OPEN_FOR_REGISTRATION, IN_PROGRESS)
allowNewEnrollment = countedEnrollmentCount + 1 <= maxActiveClasses
```

Không tính Class Completed/Cancelled hoặc Enrollment đã hủy hợp lệ. Tính cả các lớp sắp khai giảng đã đăng ký, kể cả khác tháng; đây là cách giữ quota đơn giản của bản đầu. Không hiểu là 3/6 buổi, 3/6 môn hoặc 3/6 lớp trong toàn bộ đời tài khoản. Hoàn thành/hủy hợp lệ giải phóng quota.

Đây là mặc định cần báo rõ. Nếu chủ dự án muốn “3 lớp/tháng” hoặc giới hạn theo khoảng thời gian chồng nhau, cần thay chính sách và tiêu chí test, không sửa riêng một màn hình.

### BR-SUB-01 — Hiệu lực gói [CORE + DEFAULT]

**CORE**: Gói phải thanh toán thành công, không bị thu hồi, có quyền đăng ký và đủ phạm vi cơ sở. Phải kiểm tra ở backend khi đăng ký và khi điểm danh.

**DEFAULT**: Một Member có tối đa một Subscription hiệu lực tại một thời điểm. Gia hạn tạo khoảng quyền lợi kế tiếp liên tục; không cộng quota của nhiều gói đồng thời. Upgrade/downgrade và quy đổi tiền chưa nằm trong MVP.

**DEFAULT**: Gói áp dụng cho một cơ sở; Membership và Premium có cùng phạm vi. Bán tại quầy phải chỉ rõ cơ sở sử dụng. Gói dùng nhiều cơ sở chỉ bật khi có chính sách rõ; không suy ra Premium dùng toàn hệ thống.

### BR-SUB-02 — Gói bao phủ toàn khóa [DEFAULT, chính sách strict]

Tại thời điểm đăng ký, Member phải có gói đang hiệu lực. Quyền lợi đã thanh toán của cùng Member phải bao phủ liên tục từ Session đầu đến Session cuối, với scope/tier đủ quyền trong toàn khoảng đó. Có thể dùng các kỳ gia hạn đã thanh toán nối tiếp; không dựa vào lời hứa sẽ gia hạn.

Nếu dùng một Subscription:

```text
subscription.validFrom <= firstSession.startAt
subscription.validUntil >= lastSession.endAt
```

`validUntil` là mốc hết hiệu lực loại trừ; tại đúng mốc này gói đã hết hạn. Buổi kết thúc đúng `validUntil` có thể được bao phủ bởi khoảng `[startAt, endAt)`. Không so sánh chỉ ngày khai giảng hoặc ngày cuối khóa lúc 00:00. Dùng Session cuối thực tế, bao gồm buổi học bù.

Ví dụ: gói hết 20/10, khóa còn buổi ngày 31/10 → từ chối đăng ký và yêu cầu gia hạn đủ thời hạn. Đổi lịch sang tháng sau phải áp dụng BR-SCHED-03, không tự bỏ kiểm tra.

### BR-ENR-02 — Điều kiện đăng ký đồng thời [CORE]

Một Enrollment chỉ được tạo khi tất cả điều kiện đạt:

1. User là Member hoạt động, thao tác cho chính mình hoặc được hỗ trợ qua endpoint có quyền rõ.
2. Class đang mở đăng ký và chưa bắt đầu theo chính sách bản đầu.
3. Có quyền lợi gói hợp lệ, bao phủ khóa và đúng cơ sở.
4. Chưa có Enrollment đang hiệu lực của Member vào Class này.
5. Chưa vượt quota 3/6 lớp.
6. Class còn chỗ.
7. Member không trùng Session tương lai với lớp khác đã đăng ký.

Kiểm tra và giữ chỗ phải là thao tác nguyên tử, phù hợp database hiện có. Hai request đồng thời không được làm vượt sĩ số/quota hoặc đăng ký trùng. Retry cùng thao tác phải trả cùng kết quả hoặc báo đã đăng ký, không tạo thêm bản ghi.

### BR-ENR-03 — Sức chứa [CORE]

`activeEnrollmentCount <= class.maxMembers <= capacity/resourceLimitOfEverySessionRoom`.

Không giảm `maxMembers` xuống dưới số đang đăng ký. Không chuyển buổi sang phòng nhỏ hơn hoặc thiếu dụng cụ. Lớp đủ chỗ trên UI vẫn có thể hết chỗ khi lưu; backend trả lỗi rõ và UI cập nhật lại.

### BR-ENR-04 — Hủy đăng ký và nghỉ buổi [DEFAULT]

- Trước Session đầu: Member có thể hủy Enrollment, giải phóng chỗ/quota; giữ lịch sử.
- Sau khi khóa bắt đầu: rút khỏi khóa qua Manager, có lý do; không tự cho Member liên tục bỏ/đăng ký khóa để đổi quota.
- Xin nghỉ một Session không hủy Enrollment và không giải phóng quota.
- Member vắng một buổi không tự bị xóa khỏi khóa.
- Khi Class Completed/Cancelled, quota được giải phóng dù tiến trình nền chưa đổi trạng thái Enrollment; truy vấn phải xét cả trạng thái Class.

Chưa có rule “hủy trước 12 giờ”, phạt vắng hoặc hạn chế booking tự động. Những ý này là EXTENSION cho chính sách Session riêng, không được áp vào đăng ký cả khóa một cách máy móc.

## 7. Nghỉ phép, thay Coach, bảo trì và hủy lớp

### BR-LEAVE-01 — Yêu cầu nghỉ [CORE]

Coach gửi khoảng nghỉ hoặc các Session bị ảnh hưởng kèm lý do. Chỉ Manager có scope phù hợp được duyệt/từ chối. Coach không tự duyệt, không tự đổi Coach trên lịch và không sửa yêu cầu đã duyệt để mở rộng khoảng nghỉ.

**DEFAULT**: Trạng thái yêu cầu: `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`. Yêu cầu Pending chưa làm mất quyền dạy theo lịch đang công bố.

### BR-LEAVE-02 — Không bỏ trống Session [CORE]

Trước khi hoàn tất duyệt nghỉ, mọi Session bị ảnh hưởng phải có phương án: Coach thay phù hợp, dời lịch hoặc hủy. Hệ thống có thể gợi ý Coach, Manager là người chọn; không tự gán ngẫu nhiên.

Áp dụng lại BR-COACH-01 và BR-SCHED-02. Coach thay có quyền roster/điểm danh cho đúng Session được giao; Coach gốc không tiếp tục sửa buổi đã chuyển giao, trừ quyền sửa ngoại lệ được định nghĩa.

**DEFAULT**: Duyệt nghỉ và áp dụng phương án lịch trong cùng quy trình toàn vẹn; nếu phương án chưa đạt thì yêu cầu vẫn Pending. Nếu Coach làm nhiều cơ sở, mỗi cơ sở xử lý các buổi thuộc scope; không coi một Manager đã duyệt là mọi cơ sở đều đã có người thay.

### BR-OPS-01 — Đóng phòng/cơ sở hoặc hủy khóa [CORE]

Phải có danh sách Session, Member và nhân sự bị ảnh hưởng. Không đơn giản chuyển trạng thái Room sang Maintenance rồi để buổi tiếp tục check-in bình thường.

Hủy buổi/khóa cần lý do và audit; khóa thao tác check-in/điểm danh mới vào buổi đã hủy; thông báo người liên quan. Attendance và thanh toán lịch sử giữ nguyên. Không tính Member vắng ở buổi hệ thống hủy.

**DEFAULT**: MVP không tự tính hoàn tiền hoặc cộng ngày gói. Khi hủy giữa khóa, ghi nhận vấn đề cần xử lý quyền lợi và hiển thị cho Manager/Admin; không đánh dấu đã hoàn tiền khi chưa có giao dịch hoàn tiền thực.

## 8. Check-in và điểm danh

### BR-ATT-01 — Hai nghiệp vụ tách biệt [CORE]

FacilityCheckIn chứng minh Member đã đến cơ sở. ClassAttendance chứng minh Member đã tham dự một Session. Member đến cơ sở không mặc nhiên Present ở lớp. Receptionist không được thay đổi kết luận học tập do Coach chốt.

### BR-ATT-02 — Điều kiện điểm danh lớp [CORE]

Phải có Enrollment hiệu lực vào Class, Session chưa hủy, đúng cơ sở, trong cửa sổ điểm danh và có gói hợp lệ tại thời điểm check-in. Gói hết hạn/thu hồi thì từ chối, kể cả đã qua kiểm tra lúc đăng ký.

QR phải gắn Session/cơ sở, có hạn dùng và được kiểm tra ở backend; không tin Session ID hoặc ảnh QR như quyền tham dự. Ngăn scan trùng; mỗi cặp `(sessionId, memberId)` có tối đa một bản ghi Attendance nghiệp vụ hiện hành.

**DEFAULT**: Cửa sổ check-in lớp từ 30 phút trước bắt đầu đến thời điểm kết thúc; Late nếu ghi nhận sau 10 phút từ bắt đầu. Hai mốc này là cấu hình đề xuất, không phải rule đã được xác nhận. Check-in cơ sở và tư vấn có thể phục vụ người chưa có gói, nhưng không tạo quyền vào lớp.

### BR-ATT-03 — Chốt và sửa điểm danh [CORE + DEFAULT]

Coach xem roster, ghi nhận và chốt trạng thái `PRESENT`, `LATE`, `ABSENT`, `EXCUSED` của buổi được giao. QR/check-in có thể là dữ liệu xác nhận ban đầu theo thiết kế hiện có; Coach chịu trách nhiệm kết luận lớp.

Không có bản ghi scan không đồng nghĩa Absent khi buổi chưa kết thúc. Việc tính vắng chỉ dựa trên roster hợp lệ và buổi thực sự đã tổ chức.

**DEFAULT**: Sau khi Coach chốt, sửa qua Manager của cơ sở hoặc quy trình yêu cầu sửa được duyệt, bắt buộc lý do, người sửa, thời điểm và giá trị trước/sau. Không cho Receptionist hoặc Member tự sửa. Sửa Attendance không được dùng để bỏ qua điều kiện Enrollment/gói.

## 9. Receptionist, tư vấn và nhắc lịch

### BR-REC-01 — Danh sách sắp đến [CORE]

Dashboard hiển thị Session sắp diễn ra của cơ sở, roster Member đang đăng ký, trạng thái đã đến/chưa đến, dữ liệu liên hệ được phép và lịch sử nhắc. Không dùng danh sách mọi Member của toàn hệ thống.

Receptionist có thể nhắn tin, mở thao tác gọi điện và ghi nhận đã liên hệ. Nút gọi hoặc nhật ký “đã liên hệ” không được trình bày như hệ thống có tích hợp gọi tự động nếu chưa có dịch vụ tương ứng.

### BR-MSG-01 — Phạm vi chat [CORE]

- Member Free có thể nhắn Receptionist để tư vấn.
- Receptionist chỉ xem hội thoại được gán hoặc thuộc cơ sở mình hỗ trợ.
- Coach nhắn lớp/buổi được phân công; không truy cập hội thoại tư vấn riêng của mọi Member.
- Member chỉ đọc/gửi trong hội thoại mình là thành viên.
- Khi đổi Coach, quyền chat theo lớp phải cập nhật đúng; không tự cấp quyền đọc hội thoại cá nhân trước đó.

**DEFAULT**: Chat nội bộ và thông báo trong hệ thống là phạm vi đầu tiên. SMS, gọi qua nhà cung cấp và email reminder là EXTENSION nếu chưa có hạ tầng sẵn. Nhắc tự động trước 24 giờ/2 giờ chỉ bật khi được chốt; nếu triển khai phải chống gửi trùng và hủy nhắc cho buổi đã hủy/dời.

### BR-ISSUE-01 — Phản ánh Member [CORE + DEFAULT]

Member gửi phản ánh gắn cơ sở, Class hoặc Session nếu có. Receptionist tiếp nhận/chuyển; Manager xử lý trong scope; Admin theo dõi hoặc nhận escalation. Chỉ người liên quan được đọc; không đưa nội dung nhạy cảm vào dashboard công khai.

**DEFAULT**: Trạng thái `OPEN → IN_REVIEW → RESOLVED → CLOSED`, có người xử lý và lịch sử phản hồi. Đây là nghiệp vụ ticket, tách khỏi report thống kê. Không tự thêm đánh giá sao công khai hoặc xếp hạng Coach trong MVP.

## 10. Bán gói, thanh toán và doanh thu

### BR-PAY-01 — Bán gói tại quầy [CORE]

Luồng: tìm/tạo hồ sơ Member bằng quyền được cấp → chọn Plan đang bán → backend lấy giá/quyền lợi → tạo Order tại cơ sở → nhận/xác nhận Payment hợp lệ → tạo/kích hoạt Subscription đúng một lần → trả biên nhận.

Receptionist không tạo Plan, sửa giá gốc, tăng quota hoặc tự cộng hạn gói. Hỗ trợ tạo hồ sơ Member không đồng nghĩa được tạo tài khoản nhân sự.

### BR-PAY-02 — Chỉ kích hoạt từ thanh toán xác minh [CORE]

- Order Pending hoặc Payment Failed/Cancelled không cấp quyền lợi.
- Thanh toán online chỉ xác nhận từ nguồn backend có xác minh; không tin callback/client chuyển `paid=true`.
- Thanh toán tiền mặt phải đi qua hành động riêng có quyền, số tiền, cơ sở và người thu; không cho cập nhật trực tiếp trạng thái DB qua API chung.
- Payment callback/retry trùng không tạo nhiều Subscription, biên nhận hay cộng doanh thu nhiều lần.
- Lưu giá snapshot và số tiền thực thu; không suy ra doanh thu từ Plan hiện tại.
- Không sửa/xóa giao dịch đã xác nhận để “làm đẹp” report. Điều chỉnh/hoàn tiền cần chứng từ và audit.

**DEFAULT**: Receptionist được xác nhận đã thu tiền mặt tại quầy trong scope. Bank transfer thủ công chỉ xác nhận sau đối soát; nếu chưa có quy trình thì không tự coi ảnh chụp chuyển khoản là Payment verified.

### BR-REV-01 — Phạm vi và cách tính báo cáo [CORE + DEFAULT]

Admin xem tổng và từng cơ sở; Manager chỉ cơ sở phụ trách. Bộ lọc thời gian phải dùng cùng múi giờ/ngữ nghĩa ở tất cả dashboard. Manager không sửa transaction từ màn hình báo cáo.

**DEFAULT**: Bản đầu báo cáo dòng tiền đã thu, không triển khai phân bổ doanh thu kế toán theo từng buổi:

```text
grossCollected = SUM(verified successful payments in reporting period)
refundedAmount = SUM(successful refunds in reporting period)
netCollected = grossCollected - refundedAmount
```

Ghi rõ nhãn “thực thu”, không gọi là doanh thu đã phân bổ nếu chưa có nghiệp vụ đó. Cơ sở ghi nhận doanh thu là `saleFacilityId` trên Order, cố định lúc bán. Refund quy về giao dịch/cơ sở gốc. Scope sử dụng gói và cơ sở bán là hai khái niệm riêng; không đếm một giao dịch ở nhiều cơ sở.

**DEFAULT**: Đơn online thuộc một cơ sở được Member chọn và xác thực khi mua; không dùng cơ sở do browser tự suy ra. Pending, Failed, Cancelled và giao dịch trùng bị loại khỏi thực thu.

### BR-PAY-03 — Hoàn tiền [EXTENSION có ràng buộc nền]

Chưa chốt công thức hoàn tiền, phí hủy hoặc bồi thường khi hủy giữa khóa. Không tự triển khai hoàn tiền theo số buổi. Nếu code hiện có refund, không phá bỏ; đối chiếu quy trình hiện hành và đảm bảo không hoàn vượt số thực thu còn lại, có quyền phê duyệt, có liên kết giao dịch gốc và audit.

## 11. Mô hình dữ liệu tối thiểu định hướng

Tên dưới đây là tên nghiệp vụ, không bắt buộc tạo collection/table đúng tên nếu repository đã có entity tương đương. Không xây một mô hình song song khiến có hai nguồn dữ liệu cho cùng nghiệp vụ.

| Entity | Nội dung/quan hệ cần có |
|---|---|
| User | Danh tính, role, trạng thái; dữ liệu cá nhân |
| Facility | Cơ sở, múi giờ, giờ hoạt động, trạng thái |
| FacilityStaff | User–Facility, role hiệu lực/phân công, thời gian hiệu lực |
| Room | Facility, loại, sức chứa, trạng thái |
| RoomCapability | Room, capability và số lượng nếu áp dụng |
| ResourceUnavailability | Khoảng đóng cửa/bảo trì và tài nguyên bị khóa |
| Subject / SubjectRequirement | Bộ môn và các yêu cầu bắt buộc |
| CoachSpecialization | Coach–Subject, chứng chỉ nếu yêu cầu, thời hạn hiệu lực |
| Slot | Cơ sở, giờ bắt đầu/kết thúc, trạng thái |
| Class | Facility, Subject, ngày khóa, sĩ số, trạng thái, snapshot requirement |
| SchedulePattern | Class, thứ/slot, Room và Coach mặc định |
| Session | Class, thời điểm thực tế, Room, Coach thực tế, trạng thái, lịch sử đổi |
| Enrollment | Member–Class, trạng thái, thời gian đăng ký/hủy, căn cứ quyền lợi |
| MembershipPlan | Tier, giá, thời hạn, quota, scope, trạng thái |
| Subscription | Member, khoảng hiệu lực, snapshot quyền lợi, liên kết Order/Payment |
| Order / Payment | Cơ sở bán, số tiền, trạng thái, nguồn và mã chống trùng |
| FacilityCheckIn | Member, Facility, thời điểm, người/nguồn ghi nhận |
| ClassAttendance | Member–Session, trạng thái, người chốt/sửa, lịch sử |
| LeaveRequest | Coach, thời gian, các buổi bị ảnh hưởng, quyết định và phương án |
| Conversation / Message | Thành viên hội thoại, scope, nội dung, thời điểm |
| MemberIssue | Member, cơ sở, nội dung, trạng thái và người xử lý |
| AuditLog / Notification | Dấu vết thay đổi và thông báo gắn sự kiện nghiệp vụ |

Lưu trữ thời điểm theo UTC hoặc chuẩn nhất quán của hệ thống, tính lịch theo múi giờ Facility. Giá trị giờ hiển thị không được dùng trực tiếp thay timestamp để kiểm tra conflict.

Ràng buộc tối thiểu: duy nhất Enrollment hiệu lực cho một Member–Class, duy nhất Attendance hiện hành Member–Session, duy nhất khóa Payment/idempotency phù hợp, Session không trùng do chạy lại generator. Cách dùng transaction, lock, unique index hoặc conditional update tùy database thực tế; AI phải giải thích cách bảo vệ cạnh tranh và test được nó.

## 12. Lỗi nghiệp vụ và audit

### BR-ERR-01 — Lỗi rõ nguyên nhân [CORE]

Trả mã nghiệp vụ ổn định theo cấu trúc API hiện có; UI chuyển thành thông điệp dễ hiểu. Các mã gợi ý:

| Mã | Tình huống |
|---|---|
| FORBIDDEN_SCOPE | Sai cơ sở/quyền đối với tài nguyên |
| ROOM_REQUIREMENT_NOT_MET | Phòng thiếu capability hoặc dụng cụ |
| ROOM_CAPACITY_EXCEEDED | Sĩ số vượt sức chứa |
| ROOM_UNAVAILABLE | Phòng đóng/bảo trì trong thời gian học |
| COACH_NOT_QUALIFIED | Coach không đủ chuyên môn/chứng chỉ cần thiết |
| COACH_UNAVAILABLE | Coach nghỉ hoặc không có phân công hợp lệ |
| SCHEDULE_CONFLICT | Trùng Room/Coach/Class |
| OUTSIDE_OPENING_HOURS | Lịch ngoài giờ hoạt động |
| MEMBERSHIP_REQUIRED | Chưa có quyền đăng ký |
| MEMBERSHIP_NOT_COVERING_CLASS | Gói không bao phủ toàn khóa |
| MEMBERSHIP_EXPIRED_OR_REVOKED | Gói hết hạn/thu hồi khi thực hiện hành động |
| MEMBERSHIP_FACILITY_NOT_ALLOWED | Gói không dùng được tại cơ sở này |
| CLASS_LIMIT_REACHED | Vượt quota 3/6 |
| CLASS_FULL | Lớp hết chỗ |
| ALREADY_ENROLLED | Đã có đăng ký hiệu lực |
| MEMBER_SCHEDULE_CONFLICT | Lịch Member bị trùng |
| INVALID_STATE_TRANSITION | Hành động không hợp lệ với trạng thái hiện tại |
| PAYMENT_NOT_VERIFIED | Chưa xác minh thanh toán |
| ATTENDANCE_WINDOW_CLOSED | Ngoài thời gian điểm danh |

Không tiết lộ dữ liệu cơ sở khác trong lỗi sai scope. Lỗi lịch có thể trả ngày/giờ, tài nguyên và requirement thiếu cho người có quyền xem.

### BR-AUDIT-01 — Thao tác phải có dấu vết [CORE]

Ghi người thực hiện, thời điểm, cơ sở, đối tượng, hành động, lý do và thay đổi trước/sau cho: role/phân công, giá/quyền lợi Plan, ngừng tài nguyên, đổi/hủy lịch, duyệt nghỉ, thay Coach, sửa điểm danh, xác nhận thu tiền và refund. Không ghi mật khẩu, token hoặc dữ liệu nhạy cảm không cần thiết.

Thông báo chỉ phát sau khi thao tác thành công; retry không được phát lặp vô hạn. Lỗi gửi thông báo không được tạo lại Payment/Enrollment/Session. UI không báo “đã gửi SMS” khi chỉ tạo thông báo nội bộ.

## 13. Danh sách mở rộng — mặc định không triển khai

Các ý trong tư vấn trước đây là đề xuất, không tự trở thành yêu cầu chỉ vì xuất hiện trong hội thoại:

- Waitlist, ưu tiên Premium và tự chuyển waitlist thành Enrollment.
- Freeze gói, upgrade/downgrade, quy đổi tiền, dùng nhiều cơ sở.
- Phạt no-show, tự khóa booking, phí hủy hoặc quy tắc hủy trước 12 giờ.
- Booking từng buổi độc lập, học thử, đăng ký giữa khóa hoặc chuyển lớp tự động.
- Hoàn tiền tự động, prorate theo buổi, tự gia hạn khi hủy lịch.
- Lớp riêng, PT, lớp đặc biệt cho Premium, rating công khai.
- AI tự xếp lịch/tự chọn Coach thay, quản lý tồn kho dụng cụ dùng chung.
- SMS, gọi điện tự động, reminder 24 giờ/2 giờ khi chưa có cấu hình và hạ tầng.
- Tự hủy lớp do không đủ số học viên; mức tối thiểu phải được quyết định trước.
- Buffer di chuyển/chuẩn bị, bảng lương và phân bổ doanh thu kế toán.

Nếu repo đã có tính năng mở rộng, giữ tương thích và chỉ sửa phần cần thiết để đáp ứng CORE. Không mở rộng hoặc xóa bỏ vô cớ.

## 14. Tiêu chí nghiệm thu nghiệp vụ

Các tình huống dưới đây là chuẩn kiểm chứng; không chỉ test UI hoặc happy path. DEFAULT nào thay đổi phải sửa tiêu chí tương ứng.

| ID | Tình huống | Kết quả mong đợi |
|---|---|---|
| AC-01 | Manager A lấy/sửa lịch cơ sở B bằng ID trực tiếp | Backend từ chối, không rò dữ liệu |
| AC-02 | Receptionist đổi giá Plan hoặc cấp role Admin | Từ chối |
| AC-03 | Member Free xem lớp và chat tư vấn | Được phép; đăng ký lớp bị từ chối |
| AC-04 | Membership giữ 3 lớp sắp học/đang học, đăng ký lớp thứ 4 | Từ chối; Premium được đến 6 |
| AC-05 | Một lớp Completed/hủy hợp lệ | Giải phóng quota, lịch sử giữ nguyên |
| AC-06 | Gói hết trước Session cuối, dù còn hiệu lực khi khai giảng | Từ chối Enrollment theo policy strict |
| AC-07 | Hai kỳ gia hạn đã thanh toán liên tiếp bao phủ khóa | Cho phép nếu đủ quyền và không có gap |
| AC-08 | Lớp 20 người, Room chỉ có 15 thảm khi yêu cầu 1 thảm/người | Không công bố/gán Room |
| AC-09 | Gán Bơi vào Room không có POOL | Lọc khỏi lựa chọn; backend vẫn từ chối request trực tiếp |
| AC-10 | Coach Yoga được gán dạy Bơi hoặc nghỉ đã duyệt | Từ chối |
| AC-11 | Hai slot khác ID nhưng chồng giờ dùng cùng Room/Coach | Từ chối conflict |
| AC-12 | Sinh lịch lại hoặc gửi request tạo lớp trùng | Không nhân đôi Session |
| AC-13 | Khóa đi qua các tuần/ngày nghỉ khác nhau | Sinh theo lịch thực, preview hiển thị xử lý ngày nghỉ |
| AC-14 | Hai Member cùng lấy chỗ cuối | Chỉ một thành công; không vượt sĩ số |
| AC-15 | Hai request của một Member vượt quota cùng lúc | Không vượt quota; không trùng Enrollment |
| AC-16 | Member đăng ký lớp trùng giờ một lớp đã có | Từ chối |
| AC-17 | Manager dời buổi gây trùng giờ Member hoặc vượt hạn gói | Chặn luồng thông thường, trả ảnh hưởng |
| AC-18 | Duyệt nghỉ Coach mà chưa có phương án cho các buổi | Chưa hoàn tất duyệt theo DEFAULT |
| AC-19 | Coach thay nhận một Session | Có quyền buổi đó; không được sửa mọi buổi của lớp |
| AC-20 | Member đã đến cơ sở nhưng không vào lớp | FacilityCheckIn có; Attendance không tự Present |
| AC-21 | Gói bị thu hồi/hết hạn khi scan QR | Từ chối dù Enrollment trước đó hợp lệ |
| AC-22 | Scan QR lặp hoặc scan buổi đã hủy | Không tạo Attendance trùng; buổi hủy bị từ chối |
| AC-23 | Receptionist sửa Attendance đã chốt | Từ chối; Manager sửa có lý do/audit |
| AC-24 | Callback Payment thành công gửi hai lần | Một Subscription, một lần tính thực thu |
| AC-25 | Client giả paid=true/giá thấp hơn/quota lớn hơn | Không kích hoạt hoặc cấp quyền sai |
| AC-26 | Admin sửa giá/quota Plan đã bán | Subscription cũ giữ snapshot quyền lợi |
| AC-27 | Bảo trì Room có buổi tương lai | Yêu cầu xử lý lịch; không bỏ mặc buổi |
| AC-28 | Hủy buổi đã công bố | Có lý do/audit/thông báo; không tính Member no-show |
| AC-29 | Manager xem báo cáo doanh thu | Chỉ scope của mình; loại giao dịch Pending/Failed/trùng |
| AC-30 | Sửa pattern lớp đã có Attendance quá khứ | Lịch sử và Attendance cũ giữ nguyên |

## 15. Hướng dẫn triển khai cho AI/Codex

### 15.1. Đọc và lập bản đồ trước khi sửa

1. Đọc quy định repo, stack, schema, auth, API và migration hiện có.
2. Lập mapping `rule ID → model/service/API/UI hiện tại → thiếu hoặc mâu thuẫn`.
3. Phân biệt đã có, cần sửa, cần bổ sung và DEFAULT cần áp dụng. Không khẳng định có tính năng chỉ dựa trên route/tên file.
4. Chỉ hỏi những quyết định thật sự cản triển khai hoặc làm thay đổi dữ liệu/quyền lợi hiện hữu; không hỏi lại CORE đã rõ.
5. Không đổi framework/database, thiết kế UI toàn bộ, rename hàng loạt hoặc rewrite auth chỉ để làm spec dễ hơn.

### 15.2. Thứ tự triển khai

| Giai đoạn | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| P1 | Role Admin, Facility, FacilityStaff và scope | Kiểm tra quyền cơ sở trên backend |
| P2 | Room capability, Subject requirement, Coach specialization | Bộ lọc và validator tài nguyên thống nhất |
| P3 | Class/Pattern/Slot/Session, sinh lịch và conflict | Không trùng tài nguyên, lịch công bố đủ buổi |
| P4 | Plan/Order/Payment/Subscription và Enrollment | Quota, coverage, capacity và cạnh tranh đúng |
| P5 | Check-in, Attendance, Leave/Replacement, Issue/Chat | Quyền theo Session và vận hành ngoại lệ đúng |
| P6 | Dashboard theo role, doanh thu, audit, notification | Scope, nguồn số liệu và thông báo đúng |

Điều chỉnh thứ tự khi repository đã có chức năng phụ thuộc. Mỗi giai đoạn phải đi từ dữ liệu và backend validation đến API, UI và test nghiệp vụ liên quan. Không làm UI demo rồi bỏ lại backend chưa enforce.

### 15.3. Ràng buộc khi sửa code

- Backend là nguồn quyết định; frontend chỉ hướng dẫn/lọc/hiển thị lỗi.
- Tái sử dụng validator/service; không viết nhiều bản rule khác nhau cho web, mobile và quầy.
- Giữ API tương thích khi có thể; thay đổi breaking phải được ghi rõ và cập nhật client liên quan.
- Dữ liệu cũ thiếu Facility/Room/Session cần migration có mapping. Không gán mọi bản ghi vào cơ sở đầu tiên hoặc xóa dữ liệu để test dễ hơn.
- Giữ lịch sử Payment, Attendance, Enrollment và Session. Không migration phá hủy nếu chưa có yêu cầu rõ.
- Không tự tạo Admin production với mật khẩu hard-code; bootstrap qua cơ chế phù hợp repo.
- Không dùng seed/demo hoặc dữ liệu giả thay backend trong luồng thật. Seed chỉ dùng môi trường phát triển khi cần.
- Không thêm dependency hoặc module mở rộng không phục vụ các rule đang triển khai.
- Không tự commit/push/deploy hoặc gửi SMS/email cho người thật nếu yêu cầu chỉ là sửa code.
- Test các validator và luồng quyền, thời gian, cạnh tranh, idempotency theo giai đoạn đã sửa; báo rõ phần chưa kiểm chứng.

### 15.4. Dạng báo cáo bắt buộc sau mỗi phần

```text
Phạm vi đã làm: [rule ID]
Hành vi thay đổi: [trước/sau, ngắn gọn]
Model/API/UI/migration đã thay đổi: [đường dẫn hoặc tên]
DEFAULT áp dụng: [mục và giá trị]
Kiểm chứng: [test/AC-ID + kết quả thực chạy]
Phần chưa hoàn thành: [rule ID, lý do và phụ thuộc]
Rủi ro/tương thích: [nếu có]
```

Không báo “hoàn thành SCMS” nếu chỉ sửa một giai đoạn. Không báo test passed khi chưa chạy. Không che giấu mock, API thiếu hoặc rule mới enforce một phần.

## 16. Prompt khởi động để gửi kèm file

```text
Hãy đọc toàn bộ SCMS_Business_Rules_AI_Spec.md và quy định trong repository.
File này là đặc tả nghiệp vụ cho thay đổi SCMS từ 4 role sang 5 role,
thêm Admin, scope cơ sở và chuỗi Room Capability → Subject Requirement
→ Class → Session → Enrollment → Attendance.

Trước khi sửa, lập bảng rule ID với code hiện tại, phần đã có, phần thiếu,
và những khác biệt ảnh hưởng dữ liệu/quyền lợi. CORE phải được đáp ứng;
DEFAULT là giả định cần báo rõ; EXTENSION không tự triển khai.

Triển khai theo giai đoạn phụ thuộc, mỗi phần đầy đủ backend validation,
API, UI liên quan và kiểm chứng. Giữ stack và dữ liệu lịch sử. Không rewrite
toàn dự án, không tự thêm premium perks/waitlist/freeze/refund/no-show penalty.
Không chỉ ẩn nút ở frontend thay cho kiểm tra quyền backend.

Nếu có mâu thuẫn đáng kể với dữ liệu hoặc policy hiện tại, trình bày tác động
và phương án trước khi chuyển đổi. Tiếp tục các phần độc lập đã rõ.
Sau mỗi phần báo rule ID đã đáp ứng, file thay đổi, DEFAULT đã dùng,
test thực chạy và phần còn thiếu. Chưa được yêu cầu push/deploy.
```

---

Ghi chú: tài liệu được tổng hợp từ yêu cầu và trao đổi nghiệp vụ đã cung cấp. Chưa audit code, schema hoặc Swagger hiện tại. CORE mô tả đích đến; DEFAULT đóng các khoảng trống để AI có hướng làm rõ ràng; EXTENSION giữ những ý tưởng chưa chốt ngoài phạm vi triển khai mặc định.
