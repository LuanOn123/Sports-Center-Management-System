# Thay đổi hoàn thiện hệ thống ngày 31/10/2026

Đầu vào: báo cáo kiểm thử 30/10/2026 và bản đối chiếu `DOI_CHIEU_KIEM_THU_VA_DE_XUAT_2026-10-31.vi.md`. Các thay đổi dưới đây đã được thực hiện trong working tree trên commit nền `81c2422`. Chưa triển khai lên dịch vụ đang chạy, chưa áp migration lên DB thật.

## Chính sách được áp dụng

- **FREE được vào cơ sở, không được đặt lớp hoặc vào danh sách chờ**, theo quyết định của chủ dự án trong cuộc trao đổi này. Quyền học theo kỳ đã được cấp hợp lệ vẫn được xét độc lập.
- MANAGER giữ phạm vi vận hành cơ sở và báo cáo. RECEPTIONIST và ADMIN được thực hiện chuyển trạng thái gói; RECEPTIONIST/ADMIN xác nhận hoàn có lý do và chứng từ. ADMIN xử lý kích hoạt lại giao dịch SePay cần đối soát.
- Khoản thu phải xuất phát từ bán/gia hạn gói hoặc đơn tại quầy. `POST /payments` cũ trả **409 `PAYMENT_ORDER_REQUIRED`**; không còn ghi khoản thu tự do. `PATCH /payments/:id/status` không được dùng để ghi nhận thu thành công; xác nhận đơn tại quầy qua luồng có cấp gói và hóa đơn trong giao dịch.
- OTP có 5 lượt kiểm tra cho mỗi lần cấp, thời gian chờ gửi lại 60 giây. Trong 15 phút: tối đa 5 yêu cầu gửi/15 xác minh theo tài khoản; 20 yêu cầu gửi/50 xác minh theo IP. Đây là cấu hình ban đầu, có thể điều chỉnh theo lưu lượng sử dụng thực tế.

## Các chỉnh sửa đã thực hiện

| Nhóm | Thay đổi |
| --- | --- |
| C2 | Migration `20261031000000_term_facility` bổ sung cột/index/FK; tương thích trường hợp đã chạy script vá thủ công. Có lệnh chuẩn bị cột trước hardening cho DB cũ. |
| N2/M4 | Hai seed tạo kỳ trước lịch; seed cơ bản bổ sung phân công cơ sở/chuyên môn HLV; seed-full tự tạo FREE và dùng HLV HIIT riêng tại Q7. Đã kiểm tra cả hai seed trên DB trống và chạy lại. |
| N1 | Thu hồi booking có nguồn từ gói bị hủy và booking cũ thiếu nguồn khi không còn quyền trả phí/grant độc lập bao phủ buổi học. FREE không giữ được booking. Giữ lịch sử; khóa hội viên/lớp/buổi; đôn người chờ hợp lệ cùng giao dịch, thông báo qua outbox. |
| H1 | Loại bỏ ghi thu tự do, bỏ nút tương ứng trên trang thanh toán; hướng dẫn dùng bán/gia hạn gói. Chặn đường đổi trạng thái thành SUCCESS ngoài đơn hàng. |
| H2 | Bộ đếm yêu cầu dùng MongoDB có TTL, không phụ thuộc bộ nhớ một tiến trình. Giữ bí mật OTP bằng hash; đặt trước lượt thử nguyên tử, khóa sau 5 lượt, tiêu thụ mã một lần khi cập nhật mật khẩu. Đồng thời vô hiệu hóa phiên cũ. |
| H3 | Truy vấn gói đang hiệu lực trong báo cáo hội viên lọc cùng tập user active và đúng role MEMBER với tổng hội viên. |
| H4 | Đồng bộ quyền đổi trạng thái BE và FE; ADMIN có nút thử kích hoạt SePay đã thu nhưng cần đối soát; lễ tân được hướng dẫn liên hệ ADMIN cho ngoại lệ này. Gói SCHEDULED có thao tác hủy ở quầy. |
| M1/M2 | Chặn bán FREE ở bộ xử lý mua chung; chặn tạo lịch đơn/lô đã qua thời điểm bắt đầu ở service. |
| M3 | HLV chỉ được truy cập hội viên có quan hệ lớp/buổi được phân công; response HLV chỉ có thông tin tối thiểu phục vụ huấn luyện, không trả gói tập và thông tin liên hệ. |
| L1/L3/L4 | Danh sách chờ kiểm tra quyền đặt lớp, bỏ qua riêng điều kiện sức chứa; public catalog/chì tiết không trả gói inactive, ADMIN được xem khi có token hợp lệ; tuổi tối đa 120 năm áp dụng chung cho đăng ký và cập nhật hồ sơ. |
| Ngày gia hạn | Cùng hạng dùng ngày nối tiếp do hệ thống xác định; ngày gửi lên khác thời điểm đó quá 60 giây trả 400 cùng effectiveStartDate thay vì âm thầm bỏ qua. |
| Lỗi phát hiện thêm | Refresh token có `jti` ngẫu nhiên để hai lần đăng nhập cùng một giây không vi phạm unique token trong MongoDB. Test báo cáo không còn nuốt lỗi này thành SKIP khi chạy trong môi trường test. |

Không xóa các bảng/cột lịch sử như TrainingPlan/TrainingResult hay Payment provider cũ: việc loại bỏ chúng cần đánh giá dữ liệu và phụ thuộc riêng. Migration hiện tại tập trung bổ sung phần schema còn thiếu.

## Kiểm tra và cách chạy lại

Các kiểm tra đã chạy trên máy trong đợt này:

- BE build/typecheck; hardening 63 ca; CAPTCHA 27 ca.
- FE unit 114 ca, typecheck và build. Build còn cảnh báo một chunk trên 500 kB.
- `npm run test:qa:isolation`: tạo PostgreSQL 16 và MongoDB 8 replica set tạm bằng Docker, ghi đè URL kết nối và secret cho từng tiến trình test; chạy toàn bộ 46 migration trên các schema riêng; mỗi seed chạy hai lần. Tự dọn các container có nhãn sở hữu của lần test.
- Test hồi quy mới `qa-regressions.integration.ts`: 10 nhóm kiểm tra với DB thật và HTTP thật, bao gồm thu hồi legacy booking/đôn người chờ, FREE vào cửa nhưng không chờ lớp, khoản thu tùy ý, báo cáo user bị khóa, OTP song song/dùng lại, hạn mức HTTP, quyền route và public catalog.
- Ba suite cross-facility: booking 11 kiểm tra, hủy 18 kiểm tra, lịch của tôi 18 kiểm tra. Fixture đã có kỳ, HLV chính và chuyên môn hợp lệ.
- `business-gaps`: 14 kiểm tra; `membership-reports`: 10 kiểm tra, 0 bỏ qua. Kỳ vọng hoàn tiền đã sửa theo hai bước, so sánh lịch sử booking theo ID thay vì thứ tự UUID.
- Ma trận mua/gia hạn/nâng/hạ hạng: 11 kiểm tra đạt; bộ final-member-facility: 26 kiểm tra đạt.
- Browser smoke: **18/18 đạt**, tập trung vào quyền Manager, hoàn tiền có chứng từ, nút đối soát của Admin và gói hội viên tại desktop/mobile. Các bài này mock API; chúng bổ sung cho test HTTP thật, không thay thế kiểm thử tích hợp dịch vụ bên ngoài.

Chạy từ thư mục tương ứng:

```powershell
# BE
npm ci
npm run build
npm run test:hardening
npm run test:captcha
npm run test:qa:isolation

# FE
npm ci
npm run verify
npx playwright install chromium
npx playwright test refund-confirmation.spec.ts membership-quick-actions.spec.ts manager-scope.spec.ts --workers=2
```

Pipeline `.github/workflows/verify.yml` chạy các nhóm kiểm tra trên khi push/PR. Pipeline chỉ được thêm vào repo, chưa được chạy trên GitHub trong phiên này.

## Giới hạn kiểm chứng cần biết

- Chưa thực hiện lại nguyên bản 182 ca HTTP trong báo cáo vì hai file kịch bản/kết quả gốc chỉ được tham chiếu trong tài liệu, không có trong đầu vào được cung cấp.
- Sáu suite HTTP E2E cũ đã có harness CAPTCHA chỉ hoạt động trong tiến trình test, yêu cầu `NODE_ENV=test` và DB local có schema `scms_verify_*`. Không có bypass trong mã sản phẩm. Chạy chẩn đoán bằng `npm run test:qa:isolation -- --legacy-e2e`.
- Đã thử nhóm legacy: suite quota qua được đăng nhập và 17 kiểm tra cấu hình gói, sau đó dừng vì fixture cũ dùng MANAGER bán gói (API trả 403 theo chính sách hiện tại). Chưa thể coi cả sáu suite này đã đạt; cần tiếp tục chuyển fixture vai trò và các kỳ vọng nghiệp vụ cũ trước khi dùng chúng làm điều kiện phát hành. Bộ QA hiện hành trong CI dùng các suite đã cập nhật và kiểm chứng ở trên.
- Chưa kiểm thử mail thật, Cloudflare thật, ảnh/Cloudinary, AI và webhook SePay có chữ ký với dịch vụ thật; chưa chạy bộ browser toàn dự án. Không khẳng định hệ thống đã được nghiệm thu production chỉ từ các kết quả cục bộ.

## Áp dụng lên môi trường đang có dữ liệu

1. Sao lưu và thử quy trình trên bản sao DB trước. Không chạy seed trên DB nghiệp vụ thật.
2. Nếu DB đã có bảng Term nhưng thiếu facilityId và chưa áp hardening, chạy `npm run db:prepare:term-facility` trước để backfill kỳ có thể dùng Prisma hiện tại. Lệnh chỉ bổ sung cột/index/FK tương thích, không đánh dấu migration đã triển khai.
3. Chạy `npm run db:backfill:schedule-terms` ở chế độ dry-run. Tạo/chọn kỳ đúng cơ sở và khoảng ngày; xử lý những buổi không tìm được kỳ. Sau khi kiểm tra, chạy `npm run db:backfill:schedule-terms -- --apply`.
4. Chạy `npm run audit:preflight`; xử lý HLV chính bị thiếu/trùng, gói ACTIVE/SCHEDULED trùng và các sai lệch được báo. Không vô hiệu hóa trigger để vượt qua.
5. Chạy `npm run db:deploy`, `npm run db:generate`, build và triển khai BE/FE cùng đợt. Trên DB mới hoàn toàn, bắt đầu bằng `db:deploy`; không cần bước chuẩn bị bảng Term của DB cũ.
6. Rà soát booking cũ chưa có nguồn bằng số liệu preflight. Cơ chế fallback khi hủy đã được bổ sung, nhưng không tự gán lịch sử cho gói hiện tại. Kiểm tra các trường hợp còn nhiều gói/grant trên bản sao dữ liệu.
7. Smoke các vai trò, bán gói/thu tiền/hủy/yêu cầu hoàn/xác nhận hoàn, QR vào cửa và xử lý giao dịch cần đối soát sau triển khai.

Do giới hạn IP dựa trên `req.ip`, môi trường đi qua reverse proxy cần cấu hình `TRUST_PROXY_HOPS` đúng số proxy thực sự được tin cậy (mặc định 0, hỗ trợ 0–3); tránh bật trust proxy cho mọi nguồn chỉ để lấy IP từ header do client tùy ý gửi.
