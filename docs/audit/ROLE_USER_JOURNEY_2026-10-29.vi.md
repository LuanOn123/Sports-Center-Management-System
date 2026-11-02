# Kiểm tra bốn vai trò — 29/10/2026

## Môi trường và cách ghi nhận

- FE local tại `http://127.0.0.1:5173`, mã nguồn bắt đầu ở `6d176d2`.
- FE dùng API Render theo `.env.development`; dữ liệu không được giả lập trong giai đoạn người dùng.
- Chỉ đánh dấu thành công khi giao diện xác nhận kết quả. Mở màn hình/form không tương đương hoàn tất nghiệp vụ ghi dữ liệu.
- Không chuyển tiền, xác nhận đã thu/hoàn tiền khi chưa có giao dịch, đổi mật khẩu hoặc gửi tin cho người khác.
- Lượt thao tác người dùng và các bộ kiểm thử có thể chạy đã kết thúc. Đây chưa phải xác nhận toàn bộ chức năng đạt; các giới hạn và ca chưa hoàn tất được ghi riêng.

## Lễ tân — Nguyễn Tân / Pulse Quận 10

| Chức năng | Kết quả quan sát trực tiếp |
|---|---|
| Đăng nhập | Thành công bằng tài khoản được cung cấp; Cloudflare tự xác minh. |
| Chọn cơ sở | Đúng Pulse Quận 10; chỉ có cơ sở được phân công trong bộ chọn. |
| Tìm hội viên | Tìm theo email trả về Nguyễn Dùng; nút đổi hội viên có sẵn. |
| Hồ sơ hội viên | Tải được thông tin; form chỉnh sửa mở và hủy được. Chưa sửa dữ liệu hội viên. |
| Xem chuyên cần hội viên | Không có thao tác riêng ở trang hồ sơ hiện tại; cần đối chiếu phạm vi sản phẩm. |
| Gói hội viên | Liên kết từ hồ sơ giữ memberId; trạng thái Free, ngày hết hạn và lịch sử tải được. Form đăng ký tải hai gói trả phí, ngày bắt đầu và phương thức. Chưa xác nhận thu tiền/gia hạn. |
| Bán gói tại quầy | Form tải được hội viên, gói và phương thức; gửi trống bị native validation chặn ở hội viên. Chưa tạo đơn hoặc thu tiền. |
| Đăng ký lớp | Tìm/chọn được hội viên, chọn ngày được. Cơ sở chưa có buổi trong khoảng kiểm tra; chưa xác nhận đăng ký/hủy. |
| Lịch lớp | Mở được màn hình lịch và bộ lọc; chưa xác minh thao tác trên một buổi có dữ liệu. |
| Thanh toán/hóa đơn | Chọn được hội viên, mở được form ghi nhận; không ghi giao dịch chưa xảy ra. |
| Yêu cầu hỗ trợ | Tải xong hiển thị trạng thái không có dữ liệu. |
| Thông báo | Cửa sổ mở và đóng được; chưa đánh dấu/xử lý thông báo thực tế. |
| Hồ sơ bản thân | Lưu lại dữ liệu hiện tại thành công; có thông báo thành công và trở lại chế độ xem. |
| Đăng xuất | Thành công, trở về trang đăng nhập. |

## Admin

- Email đã được người dùng xác nhận là `admin@gmail.com`; email cũ gõ sai bị từ chối đúng.
- Cloudflare sau đó hiện Success; đăng nhập thành công mà không tick/bypass. Đã đăng xuất và xác minh trở về login.

| Chức năng | Kết quả quan sát trực tiếp |
|---|---|
| Tổng quan | Tải được số liệu toàn hệ thống: 4 cơ sở, 19 buổi trong kỳ, 29 lượt đăng ký; xem được phân bổ. Đây là số đang hiển thị, chưa đối soát sổ ngân hàng. |
| Cơ sở | Tải đủ 4 cơ sở, quản lý/HLV phân công; mở và hủy form thêm/sửa. Form thêm trống chặn ở mã cơ sở. Chưa tạo/xóa hoặc đổi phân công. |
| Kỳ học | Form thêm có ngày kỳ/đăng ký, phạm vi cơ sở; nút mã tự động sinh `TERM_2026`. Không lưu kỳ mới hoặc đổi trạng thái kỳ thật. |
| Người dùng | Lọc role HLV và tìm đúng email demo; mở/hủy chỉnh sửa. Admin hiện tại có nút ngừng hoạt động disabled. Form tạo HLV chuyển sang form chuyên biệt, yêu cầu môn dạy. Không tạo/khóa/đổi role tài khoản. |
| Gói thành viên | Mở được form giá, thời hạn, hạng, quota. Không thay giá hoặc tạo gói để tránh ảnh hưởng mua bán thật. |
| Bộ môn | Form có khu vực và có/không dụng cụ; đổi lựa chọn hoạt động. Không lưu dữ liệu mới. |
| Phòng | Form có sức chứa và dụng cụ; chọn Hồ bơi ẩn dụng cụ trong nhà. Không chuyển lịch/xóa phòng thật. |
| Lớp | Chọn môn HIIT lọc ra phòng phù hợp; form có sĩ số tối đa/tối thiểu, hạng và chuyên cần. Không tạo/sửa lớp thật. |
| Lịch | Điều hướng tới 16–22/11 tải hai buổi Sclimbing. Mở chi tiết có đúng ngày/giờ/phòng/HLV; tab roster có Nguyễn Plus và Nguyễn Premier. Không được điểm danh trước giờ; waitlist trống. Thẻ lịch hiển thị sai tình trạng HLV (xem phát hiện). |
| Đổi HLV | Danh sách tải xong không có yêu cầu. Chưa duyệt/từ chối một yêu cầu thật. |
| Nghỉ học/nhân sự | Đọc được một đơn cũ; mở form quyết định có lý do và khoảng nghỉ. Không quyết định thay người vận hành. |
| Hỗ trợ | Danh sách không có dữ liệu tại cơ sở đang chọn. |
| Nhật ký | Bộ lọc hoạt động/cơ sở mở được; chọn Check-in không có kết quả. Không coi đây là chứng minh mọi thao tác đều được audit. |
| Nhu cầu gói/lớp | Báo cáo tải được, lọc Premium Monthly thay đổi phần lớp hiển thị; có 29 lượt cũ chưa attribution, hiển thị riêng. Không suy diễn là lỗi mất dữ liệu. |
| Thanh toán/hoàn tiền | Tìm và chọn hội viên Nguyễn Plus; cơ sở Dĩ An không có giao dịch/hóa đơn của người này. Chưa xác nhận hoàn tiền thực tế. |
| Hồ sơ/chính sách | Mở được; hồ sơ cũng hiển thị trường tập luyện không phù hợp role. Chính sách chứa mô tả nghiệp vụ cũ. |

## Coach — Nguyễn Viên / Pulse Quận 10

| Chức năng | Kết quả quan sát trực tiếp |
|---|---|
| Đăng nhập/đăng xuất | Cả hai thành công qua giao diện. |
| Tổng quan/lớp | Tải được; tài khoản chưa có lớp phụ trách, có empty state. |
| Lịch | Tuần sau chuyển sang 02–08/11; chuyển tháng sang 11/2026; không có buổi. |
| Đổi HLV | Mở form; khi tải xong báo không có buổi phù hợp và khóa Gửi yêu cầu. Không tạo yêu cầu sai. |
| Đánh giá | Mở được trang; chưa hoàn tất một lượt đọc đánh giá có dữ liệu. |
| Hồ sơ | Thấy đúng môn Leo núi/Bơi lội và 15 năm; form chỉnh sửa không cho sửa email/môn tự do. Điện thoại `abc` bị validation chặn; hủy giữ dữ liệu cũ. |
| Chat | Mở danh sách/phòng chung, composer hoạt động, nút gửi trống disabled; không gửi cho người khác. |
| AI | Gửi câu hỏi xem lịch dạy; có phản hồi nhưng AI nói chưa cập nhật và hướng sang lễ tân. |
| Roster/điểm danh đúng giờ | Bị giới hạn do tài khoản không có lớp/buổi; không đánh dấu pass. |

## Học viên — Nguyễn Dùng

| Chức năng | Kết quả quan sát trực tiếp |
|---|---|
| Đăng nhập/đăng xuất | Thành công; xác minh logout về login. |
| Tổng quan | Gói Free, chưa có lượt đặt; hiện kỳ mở đăng ký. |
| Đổi cơ sở | Chuyển Quận 9 và Dĩ An, danh sách lớp thay đổi đúng ngữ cảnh. |
| Khám phá lớp | Lọc Leo núi còn Sclimbing; mở chi tiết, hồ sơ HLV và modal đánh giá. Không có quan hệ học thì không thấy form viết đánh giá. |
| Khóa có lịch | Ở Dĩ An thấy 13 buổi Sclimbing, 18/20 chỗ; chuyển bảng/thời khóa biểu tuần được. Free bị chặn trọn khóa, thông báo hướng mua gói. |
| Lớp của tôi | Ba tab sắp tới/hoàn thành/hủy đều tải ra empty state tương ứng. Không có nút xin nghỉ/đổi buổi/hủy. Chưa xác minh việc ẩn nút với một enrollment thật bằng tài khoản này. |
| Lịch tập | Tuần sau thay ngày, chuyển sang danh sách được; empty state đúng. |
| Mua gói | Chọn Membership Monthly, mở bước kích hoạt ngay/tương lai, tạo VietQR 300.000đ thành công. QR có hạn, nội dung chuyển khoản và trạng thái chờ. Không chuyển tiền, không xác nhận thành công giả. |
| Thanh toán/hóa đơn | Không có hóa đơn. Yêu cầu VietQR đang chờ không hiện trên trang chỉ liệt kê hóa đơn; cần UX phục hồi giao dịch. |
| Thông báo | Đánh dấu một thông báo thành công; số chưa đọc 4→3, lọc chỉ chưa đọc loại đúng thông báo đó. |
| Điểm danh | Mở nhập mã; mã sai bị từ chối với thông báo tiếng Việt, có thể thử lại. Không dùng camera hoặc ghi điểm danh hợp lệ. |
| Chuyên cần | Lịch sử/tỷ lệ tải xong báo chưa có dữ liệu. |
| Check-in | Gói Free check-in Quận 9 thành công; bấm lại trong 5 phút trả cùng lượt và lịch sử vẫn một dòng. |
| Hỗ trợ | Mở/hủy form tiêu đề/mô tả; không gửi nội dung tới nhân viên. |
| Hồ sơ | Mở/hủy chỉnh sửa, email khóa sửa; không đổi mật khẩu hoặc upload ảnh thay avatar. |
| Waitlist | Mở trang; chưa kiểm tra vào/rời hàng chờ hoặc tự lên chỗ với dữ liệu thật. |

## Tác động lên dữ liệu trong lượt thử

- Lễ tân: lưu lại hồ sơ hiện tại, giao diện báo thành công.
- Học viên: một thông báo được đánh dấu đã đọc; một lượt check-in Quận 9; một yêu cầu VietQR chờ cho Membership Monthly (không chuyển tiền, không kích hoạt).
- AI: một câu hỏi thử của HLV.
- Không tạo tài khoản; không khóa/đổi role; không xóa tài nguyên; không thay giá/phân công; không hủy gói/đăng ký; không thu/hoàn tiền hoặc đổi mật khẩu.

## Vấn đề cần đối chiếu sau giai đoạn người dùng

1. Lễ tân: lời hướng dẫn đăng ký/gia hạn đang nói luôn thay gói hiện tại và không nối kỳ, trong khi BE mới có quy tắc gói chờ/nối tiếp. Cần sửa sau khi đối chiếu chính xác luồng ghi.
2. Form hồ sơ lễ tân đang hiển thị mục tiêu/trình độ/thời gian tập của hội viên; cần xác định trường có ý nghĩa theo role.
3. Admin: thẻ lịch Sclimbing 17/11 hiển thị “Chưa phân công” nhưng chi tiết hiện Nguyễn Văn Coach. API list không include coaches của lớp; enrichment FE chỉ bật cho Manager và chỉ xử lý coachId thay thế. Cần thống nhất dữ liệu HLV hiệu lực giữa list/detail.
4. Trang chính sách dùng chung vẫn nói không nối kỳ, không hạ hạng và gói luôn phải còn hiệu lực khi điểm danh; thiếu ngoại lệ quyền học 50% và hướng dẫn Member liên hệ lễ tân sau khi bỏ nút hủy/đổi buổi.
5. AI chưa có hướng dẫn điều hướng cơ bản của role Coach.
6. Trang thanh toán Member chỉ query invoice; người dùng đóng QR rồi khó tìm lại giao dịch đang chờ. Đây là thiếu sót UX; chưa chứng minh mất giao dịch ở BE.
7. Responsive 320px: bài kiểm tra phát hiện tràn ngang Member; ảnh chụp của suite cho thấy vùng header/menu hồ sơ vượt bề rộng. Các bề rộng khác phải đọc kết quả riêng, không suy từ desktop.

Phân loại riêng: reception không có tab chuyên cần là hành vi đã được code và test hiện hành quy định (`reception-profile.spec.ts` kiểm tra không có tính năng này). Không kết luận là lỗi hồi quy chỉ dựa vào yêu cầu cũ trong lịch sử chat.

Các luồng ghi chưa được đánh dấu đạt: CRUD thành công/xóa tài nguyên; thay quản lý/phân quyền; đổi mật khẩu/OTP; bán/gia hạn/hủy/hoàn gói; enrollment trả phí thành công/tranh chỗ; waitlist promote; HLV ghi điểm danh hợp lệ; camera; avatar upload thật; gửi chat; duyệt yêu cầu đổi HLV/nghỉ. Cần dữ liệu dùng một lần và quyền thao tác rõ ràng trên môi trường demo hoặc DB cô lập. Người dùng đã được hỏi về tính chất môi trường Render; khi chưa có trả lời không giả nhận là được thu/hoàn tiền thử.

## Kiểm thử hệ thống

- FE `npm run verify`: typecheck, kiểm tra conflict, 114/114 unit test và production build đạt. Có cảnh báo bundle >500kB.
- BE `npm run build`: đạt (generate Prisma Client, không migrate DB ứng dụng).
- BE `npm run test:hardening`: 63/63 đạt, dependency DB dùng fixture/stub cô lập.
- BE `npm run test:captcha`: 27/27 đạt, gồm fail-closed, timeout và các role.
- FE `npm run check:api-contract`: 188 FE/188 BE, không thiếu/dư endpoint. Không chứng minh API Render đã deploy đúng commit hoặc mọi DTO tương thích.
- Bộ trình duyệt: **262 đạt, 35 thất bại, 0 bỏ qua** trên 297 ca/52 file, API fixture/mock, khoảng 8 phút 27 giây. Xem `ROLE_BROWSER_RESULTS_2026-10-29.vi.md` cho đủ 35 ca và điểm dừng; raw JSON ở `FE/test-results/role-browser-results-2026-10-29.json` (artifact ignored). Hai ca accessibility của suite đạt ở 375/1440px; responsive 320px thất bại, các mốc 375/430/768/1024/1280/1440/1920 đạt trong phạm vi suite.
- Bộ PostgreSQL/Mongo thật cô lập: **bị chặn môi trường**. Đã thử khởi động Docker Desktop; ứng dụng báo `starting services: initializing Inference manager ... dockerInference ... The file cannot be accessed by the system`. Docker API cũng timeout sau 15 giây. Harness bị dừng, chưa có xác nhận DB/migration/test chạy thành công. Không reset Docker, không migrate hoặc thay dữ liệu DB Render. Không dùng kết quả 17 test của báo cáo cũ làm kết quả lượt này.

## Lượt ghi dữ liệu demo được cho phép — 29–30/10/2026

Phần này cập nhật các giới hạn của lượt đọc ban đầu ở trên. Chủ dự án đã xác nhận Render là môi trường demo và cho phép tạo dữ liệu riêng, ghi giao dịch thử; không có chuyển tiền thật. Không tạo tài khoản mới, không đổi mật khẩu.

| Luồng | Kết quả đã quan sát |
|---|---|
| Reception bán tại quầy | Tạo đơn CASH Membership Monthly 300.000đ, xác nhận đã thu thử, sinh hóa đơn INV-1793279344650-LPID. Gói ACTIVE 29/10–28/11; Free bị đình chỉ. |
| Member đăng ký trọn khóa | Sclimbing tại Dĩ An, 13 buổi 17/11–29/12. Gói mua tại Quận 10, hết hạn 28/11 nhưng còn >=50% thời hạn khi đăng ký: đủ điều kiện trọn kỳ đến 31/12. Đăng ký đủ 13/13, tải lại vẫn khóa nút Đã đăng ký trọn khóa. |
| Nút Member đã loại bỏ | Với dữ liệu BOOKED thật, không có xin nghỉ/đổi buổi/hủy đặt chỗ. |
| Reception gia hạn | Tạo gói SCHEDULED 28/11–28/12, không thay ngày gói ACTIVE. Hóa đơn INV-1793279512751-58FS. |
| Gia hạn lặp khi có gói chờ | Bị từ chối, không có giao dịch thứ ba trong danh sách sau đó. Thông báo sai ngữ cảnh: Hội viên này đã được sử dụng. |
| Member hủy gói ACTIVE | Hoàn tất. Ngày 30/10 đăng nhập lại thấy Free, giữ nguyên gói SCHEDULED; cả 13 buổi Sclimbing nằm trong Đã hủy. |
| Hoàn tiền trên Render | Giao dịch gốc hiện REFUNDED, Đã hoàn 90.000đ, refundedAt 20:13 29/10. Agent chưa thao tác bước xác nhận hoàn tiền. Không coi đây là tiền đã chuyển thực tế. Khác source local requestRefund chỉ ghi yêu cầu chờ xác nhận: cần kiểm tra commit BE đã deploy. |
| Admin CRUD bộ môn riêng | Tạo, sửa mô tả, ngừng hoạt động QA-DEMO-2910 Môn kiểm thử. Không xóa vĩnh viễn hoặc sửa môn vận hành. |
| Manager đăng nhập | Thành công, đúng Pulse Quận 10. |
| Ràng buộc chuyên môn | Lớp hiện tại HIIT, HLV ban đầu chỉ Bơi lội/Leo núi: danh sách phân công trống, nút khóa đúng. Tạo lớp Leo núi bị giới hạn 1 bộ môn cơ sở chặn; không có lớp Leo núi QA được tạo. |
| Bổ sung HIIT | Chủ dự án xác nhận riêng cho phép thêm HIIT vào HLV demo. Lưu thành công, vẫn giữ Bơi lội/Leo núi. |
| Lớp và lịch QA | Tạo QA-DEMO-3010 HIIT (id 961164fb-a331-4d49-b2e6-f59d6f48f655), Phòng A1, 10 chỗ, tối thiểu 1. Gán Nguyễn Viên làm HLV chính. Tạo một buổi 30/10/2026 11:00–13:00 trong kỳ hiện tại. |
| HLV nhận phân công | Lớp phụ trách hiển thị lớp QA; lịch tuần hiển thị đúng buổi 11:00–13:00. Mở roster thành công, hiện 0 học viên. |
| Điểm danh | Chưa ghi được ca hợp lệ: lớp QA chưa có học viên và tại thời điểm thử khoảng 10:00 chưa đến cửa sổ QR 10:30/giờ học 11:00. Không đổi đồng hồ hoặc bỏ ràng buộc thời gian để giả lập đạt. |

### Vấn đề bổ sung đã tái hiện

- ResourcePage giữ query.search khi chuyển từ Lớp học sang Lịch hoạt động: lỗi Undocumented query parameter search. Xóa bộ lọc thì tải lịch được. Cần tách/reset state theo resource.
- Lịch Manager cũng hiển thị Chưa phân công trên thẻ QA dù chi tiết có Nguyễn Viên và Coach thấy lịch. Lỗi không chỉ ở Admin.
- Render đã đánh dấu hoàn tiền ngay sau hủy; source local yêu cầu xác nhận riêng. Chưa xác định commit chạy trên Render, không kết luận source local cũng có lỗi này.
- Nội dung điểm danh còn mô tả cần hoàn tất lịch để ghi vắng; việc ghi thật vẫn cần ca có học viên trong thời gian hợp lệ.

Ảnh bằng chứng: FE/test-results/qa-demo-2910-invoice.png, qa-demo-2910-course-success.png, qa-demo-2910-renewal-blocked.png, qa-3010-coach-assigned.png (artifact ignored).

### Yêu cầu đổi HLV — kết quả ghi thật

HLV gửi yêu cầu cho đúng buổi QA 30/10 11:00–13:00, lý do có tiền tố QA-DEMO-3010. Manager thấy yêu cầu Chờ xử lý và thực hiện Từ chối với phản hồi kết thúc kiểm thử. Danh sách Manager xác nhận trạng thái Từ chối và hiển thị đúng phản hồi; không thay HLV hoặc giờ buổi học. Nhánh duyệt/chọn HLV thay thế chưa hoàn tất vì cơ sở chỉ có một HLV. Không tự gán người khác sang cơ sở để mở rộng quyền truy cập.

Dữ liệu QA còn giữ để demo: lớp QA-DEMO-3010 HIIT, một lịch 11:00–13:00 ngày 30/10/2026 tại Phòng A1, yêu cầu đổi HLV đã từ chối. HLV có thêm HIIT theo xác nhận riêng của chủ dự án. Không ngừng hoạt động lớp QA vì đang phục vụ kiểm tra/demo tiếp; bộ môn QA của Admin ở lượt trước đã ngừng hoạt động.

Đã đăng nhập lại phía HLV và xác nhận cùng trạng thái Từ chối, đúng phản hồi của Manager. Luồng gửi → xử lý → HLV nhận kết quả đạt trong dữ liệu QA. Ảnh bằng chứng bổ sung: FE/test-results/qa-3010-coach-change-rejected.png.
