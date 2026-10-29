# Bàn giao siết chặt nghiệp vụ — 29/10/2026

## Phạm vi thực hiện

Triển khai theo `BUSINESS_RULE_HARDENING_PLAN_2026-10-29.vi.md`, trên mã sau merge `e7828ee`. Báo cáo audit ngày 28/10 là ghi nhận lịch sử; các ca trong file `business-rule-audit.repro.test.ts` nay kiểm tra **hành vi đúng sau sửa**, không còn cố ý xác nhận lỗi.

Code, migration và kiểm thử đã chuẩn bị trong working tree. Chưa deploy/push phiên bản này hoặc áp dụng migration vào database ứng dụng/production.

## Các quy tắc đã áp dụng

| Nhóm | Hành vi hiện tại |
|---|---|
| AUD-01 — gói chờ | Tối đa một ACTIVE và một SCHEDULED/member, có partial unique index. Mua/gia hạn dùng chung lock member; queued đã có thì từ chối cấp thêm. Tiền online đã nhận nhưng không thể cấp quyền tiếp tục đi theo cơ chế REQUIRES_REVIEW sẵn có. |
| AUD-02 — kích hoạt | GET/resolver chỉ đọc. Gói SCHEDULED đã thu tiền và tới ngày có hiệu lực được phản ánh trong preview; lệnh ghi đồng bộ trạng thái dưới khóa member bằng cùng hàm với job. Suspend gói cũ trước khi activate để không vi phạm unique. Gói đã hủy hoặc hết cả kỳ không làm suspend nhầm quyền hiện tại. |
| AUD-03 — hủy/hoàn | Hủy gói thu hồi booking/grant theo subscription nguồn ở mọi cơ sở. Không hủy mù toàn bộ booking member. Khoản hoàn được lưu REQUEST trước; chỉ có xác nhận thực tế kèm lý do và biên nhận mới ghi REFUNDED/refundedAt và hủy invoice. API từ chối refund PENDING/FAILED hoặc không có yêu cầu được duyệt. |
| Hủy gói đến hạn | SCHEDULED đã tới ngày bắt đầu phải đồng bộ thành quyền ACTIVE trước khi tính chính sách hủy. Không áp dụng nhầm hoàn 100% và không làm gói đã bị thay thế hoạt động trở lại. |
| Quyền học 50% | Giữ điều kiện gói còn ít nhất 50% khi cấp và giới hạn đúng member/class/term/buổi. Hết hạn tự nhiên không thu hồi quyền hợp lệ đã cấp; hủy/hoàn tiền nguồn thì quyền không còn dùng được. Thống kê lịch sử chặn coverage ở mốc thu hồi, không xóa lịch sử trước đó. |
| AUD-04 — tài khoản | Admin, đăng ký member và tạo staff ở cơ sở dùng chung provisioning. Mongo PENDING/FAILED không được đăng nhập; SQL projection chỉ active sau khi dữ liệu bắt buộc hoàn tất. Lease Mongo chống hai retry đồng thời; retry cùng email/mật khẩu phục hồi đúng account bị lỗi. Lỗi giữ trạng thái khóa và ID phục hồi, không bỏ lại account nửa vời hoạt động được. |
| AUD-05 — report | FE Admin bỏ sentinel ALL. Backend chỉ cho đúng GET memberships report của Admin không cần facility context; Manager vẫn bị scope theo assignment. Các tài nguyên khác vẫn yêu cầu cơ sở, kể cả khi Admin gọi. |
| AUD-06 — HLV | Tập HLV hiệu lực = HLV chính mặc định hoặc người thay chính theo buổi, cộng HLV phụ. Attendance, roster, kiểm tra tài nguyên và affected leave thống nhất; primary cũ không còn quyền của buổi đã thay người. |
| Primary invariant | Gán/gỡ primary được serialize theo lớp; DB unique và deferred trigger bảo vệ lịch tương lai. Lớp chưa có lịch có thể ở bước cấu hình; không tạo lịch vận hành khi thiếu primary. Không khóa HLV còn lịch hiệu lực. |
| Nghỉ của HLV phụ | Danh sách ảnh hưởng không bỏ qua HLV phụ khi buổi có substitute. Không dùng thao tác REPLACE primary để giả vờ thay support; phải điều chỉnh phân công support hoặc dời/hủy các buổi bị ảnh hưởng. |
| AUD-07 — kỳ | PATCH ghép record hiện tại rồi kiểm tra toàn bộ ngày; khóa kỳ khi sửa. Tạo/dời lịch cùng dùng khóa kỳ và đọc lại điều kiện trước commit, ngăn cuộc đua co ngày kỳ. CLOSED không được chọn thành kỳ hiện tại chỉ nhờ ngày. Trạng thái đi theo ma trận tiến, không tùy ý mở lại kỳ đã đóng. |
| Term bắt buộc | Lịch mới phải chọn hoặc tự khớp được kỳ hợp lệ; không tự sinh lịch không kỳ. DB trigger chặn future SCHEDULED thiếu term. Lịch sử không có kỳ vẫn được giữ; các lịch tương lai cũ thiếu kỳ phải đối soát trước migration. |
| AUD-08 — account guard | Đếm đúng role khi bảo vệ Admin/Manager cuối cùng; lock quản trị dùng chung cho update/deactivate. Không tự khóa/đổi role của mình. Khóa hoặc đổi role có engagement phải điều phối trước. |
| AUD-09 — phiên | JWT mang tokenVersion, đổi/reset mật khẩu hoặc khóa/đổi role thu hồi phiên cũ; refresh và socket kiểm tra lại trạng thái phù hợp. Xác thực cũng kiểm tra SQL projection sẵn sàng. Token cũ thiếu version tương đương 0 chỉ khi account chưa bị revoke. |
| AUD-10 — snapshot | Xếp lịch đọc snapshot của lớp; sửa tên hoặc gửi lại cùng môn không tự cập nhật snapshot. Form có lựa chọn refresh rõ ràng, bắt buộc lý do; BE kiểm tra toàn bộ phòng mặc định và phòng đang có lịch trước ghi. Dụng cụ tiếp tục chỉ có/không cho INDOOR. |
| Cutoff | Member chuyển buổi chịu cùng cutoff với hủy chỗ; không chuyển sát giờ để né hạn hủy. Quyền staff xử lý ngoại lệ vẫn theo role hiện có và audit. |
| Waitlist/lock | Cancel không chờ khóa của hội viên đang bận khi promote; dùng try-lock để loại vòng chờ. Worker mỗi phút thử lại các lịch còn chỗ, giữ WAITING khi chưa xử lý được và tái kiểm tra điều kiện trước promote. |
| Feedback | Đánh giá có classId phải có enrollment đúng lớp; feedback tổng quát dùng lookup null đúng nghĩa, lock theo member/coach và partial unique index chống trùng. |
| Hiệu năng | Schedule-pattern chuyển sang cùng batch validation/insert. Khóa room/class/coach/term được dùng ở các đường thay đổi liên quan; giữ all-or-nothing. |
| Báo cáo/audit | Giữ attribution chính xác và unattributed cho dữ liệu cũ. Thu hồi booking toàn hệ thống có audit before/after theo từng cơ sở. Lỗi HTTP có requestId; log lỗi tránh in raw payload/secret. |

Quota vẫn tính DISTINCT Class toàn hệ thống như hợp đồng đã bán. Khi Class có lịch nhiều kỳ, kiểm tra ngày cuối cho đặt buổi theo kỳ của buổi đích; không đổi quota thành số buổi hoặc class×term một cách ngầm định. Preview trọn khóa tiếp tục chọn một kỳ theo luồng hiện hành.

## Kiểm thử

- `npm run test:hardening` ở BE: **63 test** gồm regression cho 10 AUD, source attribution, gói theo kỳ, batch và thay HLV. Có HTTP test đi qua authenticate, scope, controller; dependency DB của phần này được cô lập bằng fixture.
- `npm run test:captcha`: **27 test** theo bộ đếm node:test, gồm timeout/fail-closed và các role. Kiểm tra đồng bộ projection được bổ sung vào fixture login.
- `npm run test:hardening:integration`: **17/17 test đạt**, tạo PostgreSQL container riêng, Mongo replica set riêng, schema/database ngẫu nhiên; dựng schema phiên bản trước các cột mới rồi **chạy migration thật**. Không dùng URL database từ môi trường ứng dụng.
- Bộ DB kiểm chứng transaction/rollback, hai renew đồng thời, partial unique, activation/cancel, hai người tranh chỗ cuối, refund và booking nguồn, snapshot, HLV phụ/substitute/nghỉ, feedback null, waitlist busy/retry, hủy gói đến hạn và cuộc đua kỳ/lịch. Có thêm kiểm tra Admin cuối cùng và HTTP app thật.
- FE: typecheck, **114 unit test** và production build; Playwright cho refund có biên nhận, report Admin/Manager, snapshot refresh có lý do, HLV, term preview và trạng thái form.
- Hợp đồng API: **188 endpoint FE khớp 188 endpoint BE**, không thiếu hoặc dư endpoint; typecheck BE đạt.
- Script preflight được chạy sau suite DB; dữ liệu fixture không có mismatch projection, duplicate quyền/primary, kỳ sai ngày, quyền đã hoàn còn hoạt động hoặc lịch tương lai thiếu kỳ.

Các số liệu cụ thể của lượt DB cuối cùng nằm trong output khi chạy harness. Đây không phải kiểm thử gateway SePay thật hoặc đo tải production.

### Đo batch trên DB tạm

Đã đo 5 lần mỗi cỡ 1/10/25 buổi, PostgreSQL local, có audit và kiểm tra term. Sau khi bổ sung khóa kỳ, **37 truy vấn/batch** cho cả ba kích thước. Một lượt ghi nhận:

| Số buổi | Mẫu thời gian (ms) | Median | P95 mẫu nhỏ |
|---|---|---|---|
| 1 | 39, 33, 32, 32, 32 | 32 | 39 |
| 10 | 34, 35, 35, 34, 35 | 35 | 35 |
| 25 | 42, 36, 36, 37, 37 | 37 | 42 |

P95 chỉ là nearest-rank trên 5 mẫu, không có ý nghĩa cam kết SLA. Cần đo lại với độ trễ mạng, số người dùng, lượng dữ liệu và hạ tầng triển khai thực tế.

## Triển khai dữ liệu thật

1. Sao lưu và chạy `npm run audit:preflight` với quyền đọc trên đúng môi trường. Script chỉ xuất ID/count, không sửa dữ liệu.
2. Đối soát các mục được báo: ACTIVE/SCHEDULED trùng, nhiều/thiếu primary, future schedule thiếu kỳ, kỳ đảo ngày, payment đã hoàn còn quyền và Mongo/SQL không khớp. Không tự xóa gói đã trả tiền hoặc tự gán gói cho enrollment cũ chưa rõ nguồn.
3. Xem `prisma migrate status`, bảo đảm các migration attribution và term grant trước đó đã đúng trạng thái. Sau khi đối soát, áp dụng `npm run db:deploy`, rồi `npm run db:generate`, build BE và triển khai bản mới.
4. Migration `20261029000000_business_rule_hardening` có transaction và guard; gặp dữ liệu trùng hoặc future schedule thiếu kỳ sẽ dừng trước khi tạo chỉ mục. Không dùng `db push`, `migrate reset` hoặc sửa enum trực tiếp cho production.
5. Deploy FE cùng hợp đồng refund mới. Staff cần nhìn thấy yêu cầu chờ hoàn, kiểm tra biên nhận thực tế và xác nhận. API này **không chuyển tiền ngân hàng**.
6. Theo dõi projection/provisioning FAILED, refund chờ lâu, REQUIRES_REVIEW, lỗi 409 và waitlist retry; chạy lại preflight sau rollout.

Mongo không cần migration phá dữ liệu: các trường version/status/lease có default tương thích account cũ. Account còn lease do tiến trình chết chỉ được retry sau khi lease hết hạn; không force-clear lease đang xử lý. Không đổi mật khẩu để chiếm một account pending của yêu cầu khác.

### Lặp lại kiểm tra cô lập

Từ BE, khi Docker đang chạy và có mongod local:

```powershell
npm run test:hardening
npm run test:hardening:integration
```

Trên máy khác, đặt `SCMS_TEST_MONGOD` tới executable mongod. Harness chỉ bind loopback, kiểm tra prefix/label trước cleanup và tự xóa container cùng dữ liệu tạm do nó tạo. Nó không kiểm tra hay sửa dữ liệu production.

## Giới hạn bàn giao

- Chưa áp dụng migration hoặc sửa các bản ghi cũ ở môi trường triển khai; cần chạy preflight trên dữ liệu thật để biết có phải đối soát trước deploy hay không.
- Kiểm thử đồng thời đã chạy trên DB thật cô lập, chưa phải stress test nhiều instance hoặc bảo đảm mọi interleaving có thể xảy ra.
- Hoàn tiền online vẫn cần quy trình chuyển khoản/đối soát thực tế của nhân viên; không giả lập thành công một giao dịch hoàn từ ngân hàng.
- Chưa thay đổi định nghĩa quota đã bán hoặc tự suy luận attribution của dữ liệu lịch sử.
