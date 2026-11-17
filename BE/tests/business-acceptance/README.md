# Bộ nghiệm thu nghiệp vụ SCMS

Bộ nghiệm thu có **311 ca tự động**. Tên mỗi ca chứa mã kiểm thử, tình huống và kết quả dự kiến. Mỗi hàng trong ma trận chạy thành một test độc lập. Các ca gọi mã nghiệp vụ hoặc lớp kiểm tra dữ liệu của backend. Stub được dùng ở lớp lưu trữ để đặt dữ liệu và thời điểm cố định, cũng như để kiểm tra điều kiện truy vấn và chặn ghi ngoài dự kiến.

## Đối chiếu yêu cầu

| Nhóm | Số ca | Căn cứ và tình huống | Mã kiểm thử |
|---|---:|---|---|
| [Mua, đổi và gia hạn gói](purchase.test.ts) | 65 | P4, chính sách vòng đời gói. Gói FREE, gia hạn đúng mốc, nâng hạng, hạ hạng, giới hạn 60 ngày, giá VND, quota danh mục và hợp đồng thu tại quầy. | `BR-PLAN-*`, `BR-PAY-PRICE`, `BR-PAY-COUNTER`, `BR-PAY-RENEW` |
| [Thanh toán, hoàn tiền và báo cáo](payments.test.ts) | 65 | BR-PAY-01/02, BR-REV-01. Hợp đồng SePay, chữ ký, giao dịch ở trạng thái cuối, biên nhận lặp, từ chối thao tác trái quy trình và đối chiếu thực thu theo ngày Việt Nam. | `BR-PAY-WEBHOOK`, `BR-PAY-BANK`, `BR-PAY-APIKEY`, `BR-PAY-SIGNATURE`, `BR-PAY-TRANSITION`, `BR-PAY-RECEIPT`, `BR-REV-CASH` |
| [Đăng ký khóa, quota và di chuyển](enrollment.test.ts) | 67 | BR-ENR-02, BR-Q03 và [chính sách ngoại lệ học kỳ](../../docs/term-membership-policy.md). Điều kiện theo từng buổi, cùng lớp và khác cơ sở, cửa kỳ, Premium, quota đã bán và mốc 50%. | `BR-ENR-*` |
| [Xếp lịch, HLV, phòng và kỳ học](operations.test.ts) | 53 | BR-ROOM-01/02, BR-SCHED-01/02, BR-LEAVE-01/02. Sức chứa, thiết bị, snapshot, đúng chuyên môn, HLV thay thế, nghỉ phép và mở/đóng cửa đăng ký. | `BR-SCHED-*`, `BR-TERM-*` |
| [Điểm danh và tiến độ](attendance.test.ts) | 33 | BR-ATT-02/03. Cảnh báo theo tỷ lệ, chứng cứ lịch sử quyền lợi, check-in QR và mã dự phòng, kết quả từng buổi. | `BR-ATT-*` |
| [Vai trò, cơ sở và OTP](access.test.ts) | 28 | BR-AUTH-01/02. Phân quyền tường minh, phạm vi cơ sở, vai trò không được kế thừa và định dạng OTP đặt lại mật khẩu. | `BR-AUTH-*` |

Nguồn yêu cầu chính gồm [danh sách BR P1–P6](../../../SCMS_Backend_Tasks.md) và [luồng nghiệp vụ đang áp dụng](../../../docs/CURRENT_BUSINESS_FLOW_AND_RULES.md). Mã trong bảng nhận diện ca kiểm thử của repo. OTP đăng ký và lưu kế hoạch AI bảy ngày cần được thống nhất trong đặc tả trước khi đưa vào nghiệm thu.

## Chạy kiểm thử

Từ thư mục `BE`, sau khi cài dependencies của backend:

```sh
npm run db:generate
npm run test:business
```

Các ca trên chạy theo mặc định trong CI, cùng bộ hồi quy và bộ tích hợp. Để kiểm tra một nhóm theo mã:

```sh
npx tsx --test --test-name-pattern=BR-REV-CASH tests/business-acceptance/payments.test.ts
```

Kiểm thử các luồng có dữ liệu thật trong cơ sở dữ liệu cô lập bằng lệnh sau. Cần Docker, dependencies của cả `BE` và `FE`, cùng Chromium của Playwright.

```sh
npm run test:qa:isolation -- --live
```

Lệnh tích hợp dựng PostgreSQL và MongoDB riêng, áp migration, chạy seed lặp, kiểm tra các luồng backend và chạy trình duyệt với API thật. Các ca thu tiền dùng webhook hoặc dữ liệu SePay giả lập. Giao dịch ngân hàng thật và cấu hình nhà cung cấp production thuộc bước nghiệm thu môi trường triển khai.
