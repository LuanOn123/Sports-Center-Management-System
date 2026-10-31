# Kiểm tra nghiêm ngặt luồng chính và đối chiếu UI

> Đây là kết quả trước khi sửa. Xem [bản sửa và kết quả chạy lại](SUA_LOI_LUONG_CHINH_VA_UI_2026-11-01.vi.md) cho trạng thái hiện tại.

Ngày: **31/10/2026, giờ Việt Nam**. Phiên bản: **`b9c19af`**, bản vừa push lên main/develop.

## Kết luận

**Chưa nên nghiệm thu toàn bộ hệ thống.** Các luồng cơ bản đã chạy được, nhưng kiểm tra xuyên suốt trình duyệt → API → PostgreSQL/MongoDB phát hiện **8 vấn đề có bằng chứng thực thi**. Trong đó có gia hạn VietQR bị chặn, hủy gói ACTIVE thiếu nút cho lễ tân, sai doanh thu theo gói và quyền điểm danh khi chỉ còn FREE.

Đợt hoàn thiện trước đã sửa nhiều phần BE và test, nhưng chưa kiểm chứng đầy đủ việc người dùng thực sự đi hết thao tác trên UI. Đặc biệt lỗi ngày gia hạn và nút hủy ACTIVE là phần đồng bộ còn thiếu sau đợt đó.

## Phạm vi, cách kiểm tra và bằng chứng

- Chạy đúng source hiện tại ở local, không đánh giá một bản UI triển khai từ commit khác.
- Tạo PostgreSQL 16 và MongoDB 8 replica set riêng bằng Docker, chạy 46 migration, seed dữ liệu mẫu. Ghi đè URL/secret/tài khoản thanh toán bằng cấu hình thử nghiệm. Không sửa DB thật, không chuyển tiền thật.
- Dựng Vite với `VITE_API_BASE_URL` trỏ vào BE tạm. Các ca live browser **không mock API nghiệp vụ**. Phiên đăng nhập dùng JWT fixture được ký bằng secret riêng của DB tạm, không kiểm tra Cloudflare/mail thật trong các ca này.
- Live audit: **22 nhóm kiểm tra — 14 PASS, 8 FAIL**. Bao gồm cả mở trang/smoke; không được hiểu là đã kiểm tra hết mọi nhánh của mỗi trang.
- Bộ `test:qa:isolation` hiện hành: **PASS**; gồm dựng DB/seed chạy lại, hồi quy hardening, liên cơ sở, báo cáo, ma trận mua gói.
- Browser regression mở rộng: **31/32 PASS**. Ca FAIL tìm bước mở chi tiết cũ đã bị bỏ, trong khi DOM hiện tại đã có nút Vào danh sách chờ. Chạy lại cùng ca sau khi bỏ bước tìm selector cũ: **PASS**. Đây là lỗi bảo trì test, không phải bằng chứng danh sách chờ bị hỏng.
- Không sửa mã sản phẩm trong đợt đánh giá này. Script/test tạm và ảnh được giữ ở thư mục artifact; file test tạm trong repo đã được dọn.

Thư mục bằng chứng: `C:/Users/ontri/.codex/visualizations/2026/10/31/01a191eb-cc04-7190-8e55-55e5b2c51da3/`.

| Tệp | Nội dung |
| --- | --- |
| `strict-live-results.json` | Kết quả 22 nhóm live audit và lỗi HTTP/trình duyệt |
| `strict-live.log` | Log API thật trong môi trường cô lập |
| `strict-live-audit.cjs`, `strict-live-runner.mjs` | Script tái hiện và dựng DB tạm; chạy runner từ thư mục BE bằng Node |
| `strict-qa-baseline.log` | Bộ QA hiện hành đạt |
| `strict-ui-tests.log` | 31 ca UI đạt, 1 ca selector cũ lỗi |
| `ui-renewal-checkout.json` | Body UI gửi, HTTP 400 và thời điểm backend yêu cầu |
| `renewal-report-evidence.json` | Hai khoản thu và doanh thu theo gói bị thiếu |
| `ui-reception-membership.png`, `ui-member-renewal.png`, `ui-course-enrolled.png` | Ảnh giao diện với dữ liệu/API thật |

## 1. Những lỗi cần sửa

### F01 — P1: UI gia hạn VietQR bị backend trả 400

**Tái hiện thực tế:** mua gói tại quầy → đăng nhập hội viên → Gói thành viên → Gia hạn qua VietQR → Tiếp tục tạo VietQR. UI thông báo tự nối tiếp, nhưng API trả `400 RENEWAL_START_DATE_CONFLICT`, không tạo được checkout.

- Gói hiện tại hết hạn tại `2026-11-30T16:52:34.756Z`.
- UI gửi `startDate: "2026-11-30"`, tức đã bỏ mất phần giờ.
- Backend so thời điểm yêu cầu với endDate, dung sai chỉ 60 giây; hai giá trị lệch nhiều giờ.
- Source: `FE/src/pages/member/MembershipPage.tsx:1252`; `BE/src/modules/subscriptions/subscription-purchase.service.ts:122`.

**UI đã cập nhật một phần:** có card gói chờ, modal gia hạn và mô tả nối tiếp. **Chưa đồng bộ payload ngày giờ.**

**Sửa đề xuất:** cùng hạng không gửi ngày do client tự tính, để server lấy endDate; hoặc gửi nguyên ISO timestamp. Ngày hạ hạng và ngày bắt đầu tùy chọn cũng phải thống nhất UTC/giờ Việt Nam. Test browser phải nối với BE thật để phát hiện sai hợp đồng này.

### F02 — P1: Lễ tân vẫn không hủy được gói ACTIVE bằng UI

**Tái hiện:** trang `/receptionist/membership?memberId=...`, hội viên có gói ACTIVE. UI có Gia hạn và Đã thay thế/ngừng quyền lợi, **không có Hủy gói**.

- BE đã cho RECEPTIONIST/ADMIN gọi PATCH status.
- Component hủy vẫn chỉ render khi `role === "MANAGER"`, trong khi trang này mặc định RECEPTIONIST.
- Danh sách StatusAction còn lọc bỏ CANCELLED cho ACTIVE, nên cũng không có đường thay thế.
- Source: `FE/src/features/reception/membership/MembershipPage.tsx:135`, `:158`.

**Sửa đề xuất:** cập nhật component hủy cho đúng vai trò quầy/ADMIN, có xem trước số hoàn theo chính sách nhân viên, và thông báo đây là yêu cầu hoàn chứ chưa trả tiền. Không dùng nút SUSPENDED để thay hủy.

### F03 — P1: Doanh thu theo gói bỏ sót gia hạn

**Tái hiện:** mua gói 300.000đ rồi gia hạn cùng gói thêm 300.000đ. Trước khi hủy/hoàn bất kỳ khoản nào:

```text
Payment mua mới:  amount=300000, planId=<gói>
Payment gia hạn:  amount=300000, planId=null
Report: soldCount=2, revenue=300000
Đúng phải là:              revenue=600000
```

- `renewSubscription` tạo payment có subscriptionId nhưng không ghi planId.
- Báo cáo group theo planId và loại planId null; khoản gia hạn biến mất khỏi breakdown.
- Source: `BE/src/modules/subscriptions/subscriptions.service.ts:193`; `BE/src/modules/reports/reports.service.ts:308`.
- UI hiển thị trực tiếp `plan.revenue`: `FE/src/features/manage/MembershipUsageReport.tsx:126`.

**Sửa đề xuất:** ghi planId khi tạo khoản gia hạn; backfill chỉ từ subscription có nguồn rõ ràng; thêm phép đối chiếu doanh thu thuần/gross và breakdown. UI hiện có trường doanh thu nhưng đang nhận số sai.

### F04 — P1: FREE + booking cũ không có grant vẫn điểm danh được lớp

**Tình huống kiểm tra dữ liệu lịch sử:** hội viên có FREE ACTIVE; có booking BOOKED của gói trả phí đã EXPIRED, không có `termMembershipGrant`. Sinh QR hợp lệ cho buổi đang diễn ra rồi cho hội viên quét.

**Kết quả thực tế:** HTTP **200**, Attendance **PRESENT**. Kỳ vọng từ chính sách hiện tại là từ chối khi không còn quyền trả phí và không có grant độc lập hợp lệ. Đây không phải đặt lớp mới bằng FREE, mà là lỗ hổng ở đường điểm danh booking lịch sử.

- Scanner kiểm tra có effective subscription là đủ; FREE cũng được resolver trả về.
- Điều kiện `if (!activeSub && !approvedTerm)` không phân biệt quyền vào cửa và quyền học lớp.
- Source: `BE/src/modules/attendance/attendance.service.ts:331`, `:339`.

**Sửa đề xuất:** quyền vào cửa FREE và quyền học lớp là hai phép kiểm tra riêng. Khi điểm danh, kiểm tra nguồn quyền của booking/loại gói hoặc grant kỳ hợp lệ; vẫn giữ ngoại lệ đã duyệt theo kỳ khi gói hết hạn. Thêm test với FREE được tự cấp lại sau hết hạn và booking cũ chưa thu hồi.

### F05 — P1: Ngừng quyền lợi thủ công giữ nguyên chỗ BOOKED

**Tái hiện:** gói ACTIVE có booking tương lai → RECEPTIONIST PATCH status SUSPENDED.

```text
HTTP 200
MembershipSubscription.status = SUSPENDED
Enrollment.status = BOOKED
```

UI hiện cho phép làm thao tác này. Trong code/tài liệu, SUSPENDED lại được định nghĩa là gói đã bị thay thế, không phải đóng băng tạm thời và không thể resume. Nhân viên có thể kết thúc quyền của một gói mà không có gói thay thế, không giải phóng chỗ.

- Source: `BE/src/modules/subscriptions/subscriptions.service.ts:398`, `:551`; `FE/src/shared/businessRules.ts:48`.

**Sửa đề xuất ưu tiên:** bỏ thao tác SUSPENDED thủ công nếu trạng thái này chỉ dành cho việc mua/nâng gói; dùng luồng hủy đã kiểm soát. Nếu vẫn cần nghiệp vụ ngừng quyền, phải định nghĩa tác động lên booking/grant, thông báo và thu hồi trong transaction có khóa/CAS.

### F06 — P1 với luồng ngoại lệ: Đơn SePay đã thu nhưng không cấp được gói không có đường hoàn đầy đủ

**Fixture ngoại lệ:** payment SUCCESS, gateway SEPAY, activationStatus REQUIRES_REVIEW, không có subscription và mất plan nguồn. Không dùng chuyển khoản thật trong thí nghiệm này.

- ADMIN retry activation → **409 SEPAY_PLAN_MISSING**, message hướng dẫn xử lý thủ công/hoàn tiền.
- ADMIN xác nhận hoàn → **409**, vì chưa có yêu cầu hoàn được duyệt.
- Các yêu cầu hoàn hiện được tạo khi hủy subscription; payment này chưa có subscription để hủy.
- UI chỉ hiện Xác nhận hoàn khi `refundRequestedAt` đã có. Nút retry mới có giúp trường hợp kích hoạt bù được, nhưng không khép kín trường hợp không thể kích hoạt.
- Source: `BE/src/modules/payments/sepay-payments.service.ts:587`; `BE/src/modules/payments/payments.service.ts` và `refunds.service.ts`; `FE/src/features/reception/payments/PaymentsPage.tsx:131`.

**Sửa đề xuất:** thêm luồng ADMIN lập/duyệt hoàn tiền ngoại lệ cho khoản thực thu chưa cấp quyền, có lý do, chứng từ và giới hạn số tiền. Giữ hai bước yêu cầu → xác nhận trả tiền và idempotency; không mở quyền sửa enum tài chính tùy ý.

### F07 — P2: Chặn tạo lịch quá khứ nhưng vẫn sửa lịch về quá khứ được

**Tái hiện:** tạo một lịch UUID tương lai có kỳ, HLV chính, phòng hợp lệ. Manager PATCH startTime/endTime sang ngày 23/07/2026.

**Kết quả:** HTTP **200**, `Schedule updated successfully`, startTime đã nằm trong quá khứ. Kiểm tra tạo lịch mới không bao phủ đường sửa lịch.

- Source: `BE/src/modules/class-schedules/class-schedules.service.ts:555` trở đi.
- UI có chức năng chỉnh lịch; BE cần giữ cùng ràng buộc dù client gửi trực tiếp.

**Sửa đề xuất:** xác thực thời gian hiệu lực cho cả create và move, đồng thời giữ quy trình riêng nếu thực sự cần nhập/chỉnh lịch sử.

### F08 — P2 cho dữ liệu demo/test: Seed thành công nhưng QR demo không dùng được

**Tái hiện:** chọn lịch demo đang diễn ra từ seed-full, gọi generate-qr.

```text
scheduleId = seed-sch-demo-qr-live-202610311640
POST /attendance/generate-qr → 400, Invalid uuid
```

ID trong DB là String, seed dùng ID dễ đọc, nhưng schema điểm danh yêu cầu UUID. Với lịch UUID thông thường, đã kiểm tra generate QR + scan thật thành công.

- Source: `BE/src/scripts/seed-full.ts:445`; `BE/src/modules/attendance/attendance.schema.ts:17`.

**Sửa đề xuất:** thống nhất hợp đồng ID: dùng UUID ổn định trong seed và sửa các tham chiếu, hoặc thống nhất schema nhận opaque ID phù hợp với DB. Chỉ kiểm tra “seed không crash” chưa đủ; cần gọi các thao tác nghiệp vụ trên dữ liệu vừa seed.

## 2. Mô tả các luồng chính và mức khớp UI

| Luồng | Logic hiện có / kết quả | UI hiện tại |
| --- | --- | --- |
| Tạo hội viên / FREE | Tài khoản hội viên có gói FREE; FREE quota lớp 0, được vào cơ sở. Bộ QA xác nhận không đặt/chờ lớp bằng FREE. | Card FREE nói rõ được check-in nhưng chưa có lớp. Khớp ở quyền đặt lớp; đường QR lớp có lỗi F04 với dữ liệu lịch sử. |
| Mua gói tại quầy | Lễ tân chọn hội viên và gói; backend lấy giá hệ thống, tạo gói + payment SUCCESS + hóa đơn trong giao dịch. Luồng đã tái hiện HTTP 201. | Trang Gói thành viên có đăng ký/gia hạn ghi nhận đã thu ngay; trang Bán gói tại quầy có luồng đơn rồi xác nhận. Cần nói rõ hai cách để tránh thu hai lần. |
| Gia hạn cùng hạng | Gói mới SCHEDULED, bắt đầu đúng endDate gói ACTIVE. Có một gói chờ thì mua thêm trả 409. Ba request mua đồng thời kết thúc 201/201/409 và chỉ một ACTIVE + một SCHEDULED. | Card/mô tả và chặn mua khi có gói chờ đã có. Gia hạn tại API quầy đúng; VietQR UI hỏng do F01. |
| Nâng hạng | Có thể hiệu lực ngay hoặc hẹn ngày. Hiệu lực ngay thì gói cũ chuyển SUSPENDED, không cộng dồn ngày dư. | Modal chọn hiệu lực ngay/ngày hẹn hiện có. Ma trận BE hiện hành 11 kiểm tra đạt; chưa kiểm tra mọi tổ hợp ngày hẹn qua browser thật. |
| Hạ hạng | Khi gói hiện tại còn hạn, gói thấp hơn chỉ bắt đầu từ thời điểm gói hiện tại kết thúc trở đi. | Có mô tả và trường ngày; cần rà cùng lỗi mất phần giờ ở F01. UI còn coi một số gói cùng hạng ít ngày hơn là hạ hạng, trong khi BE ưu tiên phân loại theo tier. |
| SePay thông thường | Checkout PENDING → xác nhận tiền bằng webhook/đối soát → cấp gói theo snapshot → SUCCESS/ACTIVATED. Không được tự PATCH thành SUCCESS. | UI QR, polling, trạng thái đã thu/chờ kích hoạt và retry ADMIN đã có. Test UI mock về trạng thái đạt; chưa thử ngân hàng thật. Ngoại lệ không thể kích hoạt còn F06. |
| Hủy ACTIVE | Hội viên tự hủy: trên 15 ngày còn lại (code làm tròn lên theo ngày) yêu cầu hoàn 30% khoản gốc; ≤15 ngày không hoàn. Nhân viên hủy tính tỷ lệ ngày còn lại. Hủy và thu hồi quyền từ gói phải cùng giao dịch. | Hội viên có modal hủy; ACTIVE ở quầy bị thiếu nút F02. Câu “hủy toàn bộ booking tương lai” trong modal quá rộng, cần nói rõ booking theo nguồn quyền để không mâu thuẫn grant/gói độc lập. |
| Hủy SCHEDULED | Nếu chưa tới hiệu lực: yêu cầu hoàn 100%; ACTIVE cũ được giữ. Payment chưa thành REFUNDED cho tới khi quầy xác nhận. | Card gói chờ và nút hủy đã có. Đã kiểm tra HTTP thật: giữ ACTIVE, hoàn đúng số, gọi xác nhận lặp không đổi biên nhận. |
| Hoàn tiền | Yêu cầu hoàn được phê duyệt → người có quyền xác nhận đã trả tiền kèm lý do/biên nhận → REFUNDED. | Trang thanh toán có form chứng từ và bỏ ghi thu tự do. Khớp với hoàn từ subscription; thiếu ngoại lệ F06. Chính sách hiển thị còn gọi người xử lý là “quản lý” dù quyền thực tế là RECEPTIONIST/ADMIN. |
| Đăng ký trọn khóa | Xem kỳ và lịch → kiểm tra tài khoản/gói/tier/quota/sĩ số/trùng giờ → nhập ghi chú thể trạng → tạo booking toàn bộ hoặc rollback. Có ngoại lệ 50% thời hạn còn lại để cấp quyền học đúng lớp/kỳ, không đổi endDate gói. | Đã thực hiện bằng browser nối BE thật: 12 booking được tạo, đều có subscriptionId đúng. Khóa đăng ký, thông báo và trạng thái đã đăng ký hiện có. |
| Lớp đầy / danh sách chờ | Chỉ chờ khi đầy, còn đủ quyền, không trùng; khi chỗ trống, kiểm tra lại quyền/quota trước khi đôn. | Nút Vào danh sách chờ nằm trực tiếp ở dòng lịch. Test cũ còn tìm modal trung gian; bỏ bước cũ thì test đạt. Các luồng đôn và hủy gói thu hồi legacy booking đạt ở bộ QA DB thật. |
| Vào cửa / điểm danh lớp | Vào cửa dùng quyền cơ sở (FREE được phép). Điểm danh lớp cần booking và quyền học; QR trong cửa sổ 30 phút trước giờ bắt đầu tới giờ kết thúc, TTL 10 phút. | Có tiện ích check-in cho hội viên. `/receptionist/checkin` hiện là redirect về dashboard, không phải trang check-in độc lập. QR lịch UUID: hội viên trả phí quét hai lần chỉ một Attendance, người không có booking bị 403. Còn F04 và F08. |
| Chuyên cần / đổi HLV / kỳ học | Cảnh báo chuyên cần không tự phạt; xử lý hạn chế theo quyết định Manager; thay HLV cần kiểm tra chuyên môn/cơ sở/xung đột. Kỳ và HLV chính là điều kiện xếp lịch. | Các test UI liên quan cảnh báo, đổi HLV, quyền học theo kỳ đạt trong nhóm mở rộng. Trang kỳ/lịch/coach đã mở với API thật, không lỗi JS; chưa thao tác hết tất cả nhánh phê duyệt. |
| Báo cáo | Tổng hội viên đã dùng cùng cohort; ma trận báo cáo membership hiện hành đạt. | Trang Nhu cầu gói & lớp render breakdown API. F03 chứng minh có ca gia hạn bị thiếu mà test hiện hành chưa bắt. |

## 3. Những phần đã kiểm chứng đúng đáng giữ

1. Mua quầy và gia hạn qua API; nối tiếp đúng timestamp, chặn gói chờ trùng và giữ giới hạn trong mua đồng thời.
2. Hủy gói chờ không làm mất ACTIVE; yêu cầu hoàn và xác nhận trả tiền được phân biệt; biên nhận không bị ghi đè khi gọi lặp.
3. Browser thật đăng ký trọn khóa tạo được 12 booking, có nguồn subscription đúng.
4. QR lớp với ID UUID chạy được; quét lặp không sinh trùng; người chưa đăng ký bị chặn.
5. Các trang live đã mở không có JavaScript page error trong audit; không đồng nghĩa mọi nút trên trang đều đúng.
6. Bộ QA DB sạch/seed chạy lại và các kiểm tra liên cơ sở vẫn đạt. Các lỗi mới là các khoảng trống về kịch bản, không thể suy ra “mọi luồng đúng” từ test xanh.

## 4. Thứ tự khắc phục và tiêu chí chạy lại

1. **F01 + F02:** sửa payload ngày và component quyền hủy. Chạy browser thật từ mua → gia hạn QR và từ quầy → hủy ACTIVE → yêu cầu hoàn.
2. **F04 + F05:** dùng chung kiểm tra quyền học ở booking/QR/roster; giải quyết đúng ý nghĩa SUSPENDED. Test dữ liệu cũ, FREE được cấp lại, grant hợp lệ sau hết hạn và grant bị hủy.
3. **F03 + F06:** bổ sung planId cho gia hạn và kiểm tra dữ liệu cũ; có đường hoàn ngoại lệ được phê duyệt cho tiền đã thu chưa cấp quyền. Đối chiếu số thu/hóa đơn/breakdown trước và sau hoàn.
4. **F07 + F08:** thống nhất guard thời gian create/update và hợp đồng ID seed/QR. Thêm smoke nghiệp vụ sau seed thay vì chỉ kiểm tra script kết thúc thành công.
5. Cập nhật test UI theo tương tác hiện tại, và cập nhật nội dung Chính sách/HelpPanel theo vai trò thực tế. Giữ các ca live audit thành test hồi quy nối FE thật với BE thật.

**Giới hạn:** chưa kiểm thử production/deployed UI, gửi mail thật/Cloudflare thật/ngân hàng thật/AI/Cloudinary; không thay thế việc chạy đủ 182 ca HTTP gốc. Không push hoặc chỉnh mã sản phẩm trong lần rà soát này; kết quả là báo cáo và bằng chứng tái hiện để tránh làm thay đổi đối tượng đang được kiểm tra.
