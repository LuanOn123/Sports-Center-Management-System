# Đối chiếu báo cáo kiểm thử và phương án hoàn thiện hệ thống

> Đây là đánh giá trước khi sửa. Các thay đổi tiếp theo và kết quả kiểm chứng được ghi trong [HOAN_THIEN_HE_THONG_2026-10-31.vi.md](HOAN_THIEN_HE_THONG_2026-10-31.vi.md).

Ngày đánh giá: **31/10/2026**. Dự án: Sports Center Management System.

## 1. Kết luận và phạm vi

**Chưa đủ bằng chứng để nghiệm thu triển khai thực tế.** Hệ thống có nền nghiệp vụ và bộ kiểm tra tự động tốt, nhưng các điểm nghẽn về dựng DB mới, quyền lợi sau hủy gói, ghi nhận tiền và bảo vệ OTP vẫn hiện diện trong mã nguồn.

- Tài liệu đối chiếu: `C:/Users/ontri/Downloads/BAO_CAO_KIEM_THU_2026-10-30.vi (2).md`, kiểm thử nhánh `develop`, commit `0f3db02`.
- Mã nguồn được xem xét: nhánh **`main`**, HEAD **`81c2422b91cdcfd9eef54b876f36cb8420955b7d`**, 45 thư mục migration. Working tree sạch trước đánh giá.
- Commit `0f3db02` không có trong checkout hiện tại, nên không thể khẳng định quan hệ trước/sau hoặc lập diff chính xác giữa hai commit. Đánh giá dựa trên nội dung báo cáo và mã hiện có.
- Các câu lệnh/đề xuất trong báo cáo được xem là dữ liệu tham khảo; không tự thực thi các bước vá DB trong tài liệu.
- Đã đọc mã BE/FE, migration, seed, test và chạy các kiểm tra bên dưới. Không sửa mã sản phẩm, không chạy seed/migration lên DB cấu hình sẵn, không gọi API production.
- Chưa chạy lại 182 kịch bản HTTP, chưa chạy DB tạm/migration diff, chưa kiểm thử trình duyệt và các dịch vụ thật. Các con số 27 booking, 105/106 booking không có nguồn, doanh thu sai và tỷ lệ HTTP PASS/FAIL là **kết quả của báo cáo cũ**, không phải số đo mới.

## 2. Kết quả kiểm tra thực hiện trong lần đánh giá này

| Kiểm tra | Kết quả hiện tại | Ý nghĩa |
| --- | --- | --- |
| BE `npm run test:hardening` | **63/63 PASS** | Chủ yếu fixture/mock; chưa chứng minh migration, dữ liệu cũ hoặc toàn luồng HTTP đúng |
| BE `npm run test:captcha` | **27/27 PASS** | Kiểm tra hợp đồng Turnstile qua HTTP cục bộ và mock; không kiểm chứng Cloudflare thật |
| BE `tsc --noEmit` | **PASS** | Không phát hiện lỗi kiểu dữ liệu |
| FE `npm test` | **114/114 PASS**, 17 file | Trùng số lượng test PASS trong báo cáo |
| FE `npm run typecheck` | **PASS** | Không phát hiện lỗi kiểu dữ liệu |
| FE `npm run build` | **PASS** | Có cảnh báo chunk lớn hơn 500 kB; không chặn build |

Không được suy ra hệ thống đã hết lỗi chỉ vì các kiểm tra này xanh. Các tình huống DB trống, booking lịch sử, quyền qua nhiều lớp middleware và thao tác của nhân viên cần test tích hợp riêng.

## 3. Đối chiếu từng vấn đề

“Còn” trong bảng dưới nghĩa là **mã hiện tại vẫn chứa nguyên nhân**, trừ khi có ghi đã tái hiện bằng test trong lần đánh giá này.

| Mã báo cáo | Đánh giá hiện tại | Bằng chứng mã nguồn và nhận xét |
| --- | --- | --- |
| C2 — thiếu migration `Term.facilityId` | **Còn, chặn triển khai** | `BE/prisma/schema.prisma` khai báo cột, relation, index trong model `Term`; migration tạo Term không có cột này và không tìm thấy migration bổ sung. `BE/tests/migrate-term-facility.ts` vẫn là script vá riêng. Chưa chạy lại migrate diff để xác nhận toàn bộ drift. |
| N2/M4 — seed lỗi | **Còn** | `BE/prisma/seed.ts` tạo lịch tương lai không có `termId`; `BE/src/scripts/seed-full.ts` cũng vậy, và `coach.hiit` vẫn được gán Q1 + Q7. Trigger `20261029000000_business_rule_hardening` yêu cầu kỳ cho lịch tương lai. |
| N1 — hủy gói bỏ sót booking cũ | **Còn, rủi ro cao** | `entitlement.service.ts:113` chỉ lọc theo `subscriptionId` hoặc grant có nguồn khớp. Migration `20261028160000_enrollment_subscription_attribution` chủ đích để lịch sử chưa gán nguồn. Không có nhánh xử lý booking thiếu cả hai nguồn. Chưa đo số booking bị ảnh hưởng trên DB thực tế. |
| H1 — thu tay tùy ý | **Còn, rủi ro cao** | `payments.service.ts:createPayment` lấy `amount` từ request; `subscriptionId` tùy chọn và khi có cũng chỉ đối chiếu chủ sở hữu. Route cho RECEPTIONIST gọi. `getRevenueReport` vẫn tổng hợp các khoản thành công này. |
| H2 — OTP thiếu giới hạn thử | **Còn, rủi ro cao** | `auth.service.ts:resetPassword` so hash và trả lỗi, không tăng bộ đếm sai/khóa mã. Hai route quên/đặt lại mật khẩu chưa gắn rate limit; `app.ts` không có rate limiter chung. OTP đã được hash, có TTL và đổi mật khẩu tăng `tokenVersion` là những phần tốt cần giữ. |
| H3 — báo cáo hội viên âm | **Còn** | `reports.service.ts:getMemberReport` đếm tổng với `user.role=MEMBER, isActive=true`, truy vấn gói ACTIVE không lọc cùng tập user. `expiredMembers = totalMembers - activeCount` vẫn có thể âm. Comment nói cùng cohort nhưng truy vấn chưa thực hiện. |
| H4 — quyền ngõ cụt | **Còn một phần** | `app.ts` chặn MANAGER với subscriptions; `payments.routes.ts` chặn MANAGER cho cả router, trong khi đổi trạng thái/retry vẫn authorize MANAGER. ADMIN có kế thừa qua `authorize`, nên không phải tuyệt đối không ai gọi được. FE `businessRules.ts` chỉ mở chuyển trạng thái cho MANAGER; `retry-activation` thấy trong metadata API nhưng chưa thấy nơi UI chủ động gọi. |
| C1 — trùng gói chờ | **Cơ chế bảo vệ vẫn hiện diện** | Có guard `SCHEDULED_SUBSCRIPTION_EXISTS`, khóa hội viên và unique index ACTIVE/SCHEDULED. Bộ hardening PASS. Chưa chạy lại mua đồng thời qua HTTP trong lần này. |
| N3 — fixture lỗi thời | **Còn dấu hiệu rõ** | `cross-facility-booking.integration.ts` còn tạo lịch không kỳ. `business-gaps.integration.ts` tạo gói chờ G2 không gọi `mkPaid`, và G3 còn kỳ vọng `REFUNDED` ngay sau tự hủy. Cần sửa cả điều kiện thanh toán lẫn kỳ vọng hoàn tiền hai bước. |
| M1 — bán FREE tại quầy | **Còn đường thực thi** | `subscriptions.service.ts:createSubscription` chỉ kiểm tra plan tồn tại/active; luồng dùng chung mua gói chưa từ chối tier FREE tại đầu vào. FREE đã được bảo vệ khỏi sửa/ngừng bán ở catalog nhưng chưa chặn đầy đủ việc bán. |
| M2 — tạo lịch quá khứ | **Còn dấu hiệu trong mã** | `class-schedules.service.ts:createScheduleBatchInTx` kiểm tra thời gian hợp lệ, trùng lịch, kỳ và nguồn lực nhưng chưa chặn startTime đã qua; schema chỉ kiểm tra end > start. |
| M3 — HLV xem hồ sơ không liên quan | **Còn** | Route chi tiết member cho COACH, `members.service.ts:assertMemberFacilityAccess` chỉ có nhánh ADMIN/RECEPTIONIST/MANAGER, thiếu kiểm tra quan hệ lớp với COACH. |
| M5 — E2E vướng CAPTCHA | **Chưa tương thích đầy đủ** | `enrollment-quota.e2e.ts` còn login bằng email/password, không token. CAPTCHA integration PASS không đồng nghĩa các suite nghiệp vụ cũ đã chạy được. Chưa chạy lại sáu suite đó. |
| M6 — FREE check-in cơ sở | **Cần chốt nghiệp vụ** | `facility-visits.service.ts` kiểm tra có effective subscription nhưng chưa loại tier FREE; resolver có thể trả FREE. Không thể kết luận sai nghiệp vụ khi chưa quyết định FREE có bao gồm quyền vào cửa. |
| L1 — danh sách chờ không đủ điều kiện | **Còn** | `waitlist.service.ts:joinWaitlist` kiểm tra tài khoản, lịch, sức chứa, trùng chờ; chưa gọi bộ kiểm tra quyền gói trước khi tạo entry. Có import `assertCanBook` không chứng minh join đã dùng nó. |
| L2 — FE typecheck | **Đạt trong lần này** | Đã chạy lại thành công. |
| L3 — public lộ gói ngừng bán | **Còn** | `membership-plans.service.ts:listPlans` chỉ lọc active khi client truyền query; `getPlanById` cũng chưa chặn inactive ở public. |
| L4 — ngày sinh bất hợp lý | **Còn** | `auth.schema.ts` chỉ kiểm tra parse được và không ở tương lai, chưa có giới hạn tuổi hợp lý cho đăng ký/cập nhật. |
| Ngày bắt đầu khi gia hạn cùng hạng | **Còn gây hiểu nhầm** | `subscription-purchase.service.ts:inspectPlanPurchase` tính nối tiếp endDate, không phản hồi xung đột với ngày yêu cầu trong nhánh cùng hạng. |

**Đính chính cần thiết so với cách diễn đạt trong báo cáo:** cả hai seed hiện đã có `isPrimary: true`. Lỗi xác định được là thiếu `termId`, thiếu chuẩn bị kỳ phù hợp và cấu hình HLV nhiều cơ sở trong seed-full; không nên sửa bằng cách tắt trigger. Một số tài liệu nghiệp vụ cũ trong repo vẫn mô tả hoàn ngay/booking hủy toàn bộ, trong khi phần cập nhật đã đổi quy tắc; cần thống nhất tài liệu cùng đợt sửa.

## 4. Phương án chỉnh sửa theo thứ tự triển khai

### Đợt 1 — Dựng và nâng cấp DB có thể lặp lại (P0)

**Phạm vi:** C2, N2/M4 và nền kiểm thử N3.

1. Tạo migration mới chính thức cho `Term.facilityId`, index và FK theo schema. Không sửa lịch sử migration đã triển khai. Phải xử lý được cả DB chưa có cột và DB từng chạy script vá ngoài migration.
2. Xem lại trình tự nâng cấp: migration hardening có preflight chặn lịch tương lai chưa có kỳ. Nếu DB cũ chưa có `facilityId`, backfill hiện tại cũng có thể không chạy được bằng Prisma hiện tại. Cần bước bổ sung schema tương thích trước, rồi tạo/gán kỳ, rồi mới áp dụng hardening; không chỉ chạy một lệnh `db:deploy` và kỳ vọng mọi DB đều qua.
3. Sửa seed theo thứ tự: cơ sở → tài khoản/HLV một cơ sở, chuyên môn → phòng/bộ môn → kỳ → lớp + HLV chính → lịch có kỳ → gói/thanh toán → booking có nguồn gói phù hợp.
4. Với HIIT Q7, dùng HLV riêng hoặc thay phân công để tuân thủ luật một cơ sở. Không chỉ xóa facility Q7 khỏi HLV nhưng vẫn giữ lớp tại Q7 cho cùng người.
5. Rà soát `TrainingPlan`, `TrainingResult` và cột Payment thừa bằng migrate diff trong DB tạm. Chỉ loại bỏ sau khi xác định không còn dữ liệu/phụ thuộc cần bảo tồn; không tự sinh migration drop toàn bộ theo diff.

**Nghiệm thu:** DB trống chạy đủ migration, từng seed chạy độc lập thành công; seed được thiết kế chạy lại không nhân đôi dữ liệu; API kỳ/lịch hoạt động; nâng cấp một DB có dữ liệu cũ qua được preflight; schema không thiếu cột/index/FK được Prisma yêu cầu, mọi drift có chủ đích được ghi rõ.

### Đợt 2 — Quyền lợi sau hủy và tính đúng của dòng tiền (P0)

**Phạm vi:** N1, H1; giữ nguyên mô hình hoàn tiền hai bước.

- Với booking cũ, lập script dry-run liệt kê booking tương lai chưa có nguồn, các gói tại thời điểm đặt và grant theo kỳ. Chỉ backfill khi xác định duy nhất được nguồn; trường hợp không rõ đưa vào danh sách xử lý có quyết định, không gán tất cả cho gói ACTIVE hiện tại.
- Trong luồng hủy/hoàn, khóa theo hội viên, cập nhật gói và thu hồi quyền trong giao dịch. Nếu cần fallback khi không còn quyền hợp lệ, phải xét **gói trả phí có hiệu lực và grant hợp lệ**; sự tồn tại của FREE hoặc gói chờ chưa tới ngày không đủ để giữ booking. Không hủy booking đang có grant độc lập hợp lệ.
- Trả về/ghi nhận các schedule vừa giải phóng để kích hoạt xử lý danh sách chờ và thông báo đáng tin cậy sau commit. Cần kiểm chứng thêm đường này: hàm thu hồi hiện chỉ updateMany, chưa thấy gọi promote waitlist trực tiếp trong các service hủy/hoàn đã đọc.
- Quy hoạch lại `POST /payments`: tiền bán gói phải đi từ đơn hàng hoặc subscription có điều khoản/giá snapshot; backend tính số tiền phải thu và chặn ghi trùng. Nếu cần thu khoản khác, định nghĩa loại thu, chứng từ và quyền phê duyệt riêng; không dùng một khoản thu tự do để lấp lỗ hổng bán gói.
- Giá, trạng thái thành công, số hoàn và hóa đơn phải do nghiệp vụ backend quyết định; hỗ trợ gửi lặp an toàn. Không chỉ thêm giới hạn số tiền tối đa.

**Nghiệm thu:** hủy có/không attribution, có FREE, có gói chờ, có grant kỳ đều cho kết quả đúng; không mất lịch sử điểm danh; chỗ trống được đưa cho người chờ hợp lệ; gửi lặp không hoàn/thu hai lần; tiền không khớp đơn hoặc không rõ nguồn bị từ chối.

### Đợt 3 — Tài khoản, phân quyền và báo cáo (P1)

**OTP (H2):** đề xuất tối đa 5 lần sai cho một mã, thời gian chờ gửi lại 60 giây và hạn mức theo tài khoản + IP; các con số này là cấu hình đề xuất. Lưu đếm/khóa ở kho dùng chung giữa các tiến trình, cập nhật nguyên tử, vô hiệu hóa mã khi đạt ngưỡng hoặc dùng thành công. Việc cấp lại mã không được vượt hạn mức tổng. Giữ phản hồi quên mật khẩu không tiết lộ email, TTL và thu hồi phiên sau đổi mật khẩu. Test cả thử song song và dùng lại OTP.

**Phân quyền (H4/M3):** nên giữ MANAGER quản lý vận hành cơ sở và báo cáo, RECEPTIONIST thực hiện nghiệp vụ quầy, ADMIN xử lý ngoại lệ/đối soát. Đây là phương án đề xuất, cần chốt trước khi đổi quyền. Không mở rộng toàn bộ router cho MANAGER chỉ để một nút hoạt động. Đồng bộ middleware tổng, route, service, phạm vi cơ sở và UI; dùng quyền cụ thể cho thao tác hủy, xác nhận hoàn, xác nhận thu, retry activation. HLV chỉ xem hồ sơ tối thiểu của hội viên có quan hệ lớp được phép; tài chính/thông tin nhạy cảm không đưa vào response HLV.

**Báo cáo (H3):** dùng chung bộ lọc người đang active/đúng role ở mọi truy vấn, đếm distinct member. Xác định rõ “hết hạn”, “FREE”, “đang dùng gói trả phí”, “có quyền học theo kỳ” thay vì coi mọi người không có gói ACTIVE là expired. Nếu giữ tên field API để tương thích FE thì phải ghi rõ định nghĩa. Không dùng `Math.max(0, ...)` để che lỗi khác tập dữ liệu. Test user bị khóa, đổi role, chỉ FREE, gói chờ tới hạn và grant sau hết hạn.

**Nghiệm thu:** OTP bị khóa đúng ngưỡng; mỗi thao tác có vai trò truy cập thực tế trên UI và API; gọi trực tiếp sai vai trò/cơ sở bị chặn; HLV không xem được hồ sơ ngoài quan hệ; các chỉ tiêu hội viên khớp cùng tập người và không âm.

### Đợt 4 — Hoàn thiện hành vi sử dụng (P2)

| Việc sửa | Kết quả mong muốn |
| --- | --- |
| Chặn bán FREE trong tất cả luồng quầy/renew/online liên quan | FREE chỉ được hệ thống cấp; không tạo đơn bán lẻ |
| Chặn tạo mới lịch quá khứ ở BE | Tạo đơn/tạo hàng loạt cùng quy tắc; lô có một buổi sai bị từ chối toàn bộ; nhập lịch sử nếu cần phải có chức năng riêng |
| Kiểm tra quyền khi vào danh sách chờ | Áp dụng điều kiện phù hợp với thời điểm vào chờ; lúc lên BOOKED kiểm tra lại, không vượt quota hoặc quyền gói |
| Public catalog chỉ trả gói đang bán | Endpoint quản trị mới xem inactive; chi tiết public của gói inactive cũng được kiểm soát |
| Ràng buộc ngày sinh | Chốt giới hạn tuổi và chính sách hội viên nhỏ tuổi; dùng nhất quán ở đăng ký/hồ sơ, BE là nơi quyết định |
| Ngày bắt đầu gia hạn | UI hiện ngày nối tiếp do server tính; API trả 400 khi ngày nhập mâu thuẫn hoặc trả rõ effectiveStartDate và lý do điều chỉnh |
| Quyền vào cửa FREE | Đề xuất FREE dùng tài khoản/xem thông tin, gói trả phí cấp quyền vào cửa; nếu có khách tham quan, mô hình hóa vé/lượt vào riêng. Cần chủ dự án chốt |
| Thông báo nghiệp vụ | Sau tự hủy hiện “đã yêu cầu hoàn”, chỉ hiện “đã hoàn” sau xác nhận có biên nhận; có trang xử lý đơn REQUIRES_REVIEW cho vai trò được duyệt |

## 5. Khôi phục lưới kiểm thử và quy trình nghiệm thu

1. Tạo fixture dùng chung cho cơ sở, kỳ, chuyên môn HLV, HLV chính, gói đã thanh toán và booking có attribution. Sửa cả ba suite cross-facility; sửa business-gaps theo yêu cầu hoàn → xác nhận hoàn. Cleanup chỉ xóa dữ liệu do chính lần test tạo, đúng thứ tự FK.
2. Tách kiểm tra hợp đồng CAPTCHA khỏi test nghiệp vụ. Suite HTTP nghiệp vụ có thể dùng token fixture được ký bằng secret riêng trong môi trường test cô lập; suite auth riêng kiểm tra login với CAPTCHA mock/test configuration. Không thêm cơ chế bỏ qua CAPTCHA có thể bật ngoài môi trường test.
3. Dùng PostgreSQL + MongoDB replica set tạm cho integration. Không để test tự đọc URL DB thật từ `.env`; kiểm tra điểm này trước khi tái sử dụng các script cũ.
4. Bổ sung CI: typecheck/unit → migration DB trống → seed → integration nghiệp vụ và phân quyền → build FE → browser smoke năm vai trò. Chưa thấy thư mục `.github` trong checkout; nếu nhóm dùng CI bên ngoài thì tích hợp vào pipeline tương ứng.
5. Thêm kịch bản hồi quy trực tiếp cho từng lỗi C2/N1/N2/H1/H2/H3/H4; giữ các test concurrency của mua gói, thu/hoàn tiền và danh sách chờ.
6. Chạy lại ma trận HTTP trong báo cáo hoặc dựng bộ tương đương. Hai file `qa-flows-2026-10-30.mjs` và JSON kết quả chỉ được tham chiếu trong báo cáo đính kèm, chưa được cung cấp như đầu vào ở lần đánh giá này; không xem các số cũ là kết quả nghiệm thu mới.
7. Trước nghiệm thu thực tế, kiểm tra trình duyệt desktop/mobile cho năm vai trò và các tích hợp mail, Turnstile, lưu ảnh, SePay có chữ ký bằng tài khoản/môi trường phù hợp. AI/chat cần kiểm tra lỗi mạng, timeout và dữ liệu trả về trong môi trường thử nghiệm.

## 6. Chia đầu việc để thực hiện

| Gói việc | Đầu ra cụ thể | Phụ thuộc | Công ước xong |
| --- | --- | --- | --- |
| A — DB/seed | Migration, kế hoạch nâng cấp DB cũ, hai seed, hướng dẫn dựng mới | Không | Dựng mới + nâng cấp mẫu đều đạt |
| B — booking cũ | Script dry-run/backfill, chính sách trường hợp mơ hồ, sửa thu hồi và xử lý chỗ trống | A cho test DB | Đúng quyền khi hủy và không giữ chỗ vô căn cứ |
| C — tiền/OTP | Ràng buộc khoản thu, chống gửi lặp, hạn mức OTP | A cho integration | Các ca thu sai và dò mã đều bị chặn |
| D — quyền/báo cáo | Ma trận quyền được chốt, BE/FE đồng bộ, định nghĩa chỉ tiêu | Quyết định nghiệp vụ | Vai trò được phép thực hiện trọn luồng, số liệu khớp |
| E — hồi quy/UX | Fixture, CI, các sửa P2, checklist browser và tích hợp | A–D | Test DB/HTTP/browser không còn lỗi nghiêm trọng |

**Điều kiện phát hành đề xuất:** hoàn tất A–D và hồi quy liên quan; không còn lỗi P0/P1 chưa xử lý; xác định xong booking cũ chưa rõ nguồn; không còn đường thu/hoàn thiếu kiểm soát; chạy thành công quy trình triển khai trên bản sao dữ liệu trước khi triển khai thật. Cảnh báo bundle lớn của FE xử lý sau các hạng mục đúng nghiệp vụ và toàn vẹn dữ liệu.

**Ba quyết định cần chủ dự án chốt khi bắt đầu triển khai:** (1) quyền vào cửa của FREE; (2) ai được hủy gói, xác nhận thu/hoàn và đối soát đơn lỗi; (3) chính sách xử lý booking lịch sử không xác định được nguồn. Các mục còn lại có thể chuẩn bị và sửa theo thứ tự trên.
