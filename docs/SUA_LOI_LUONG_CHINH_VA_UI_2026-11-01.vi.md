# Sửa lỗi luồng chính và đồng bộ UI

Đã triển khai trong working tree từ bản nền `b9c19af`, theo 8 phát hiện trong báo cáo kiểm tra nghiêm ngặt ngày 31/10/2026. Chưa push/triển khai trong đợt sửa này; không thay đổi DB thật.

## Thay đổi

| Phát hiện | Cách sửa |
| --- | --- |
| F01 — gia hạn VietQR lỗi ngày giờ | Gia hạn cùng hạng để backend chọn chính xác thời điểm nối tiếp, không gửi ngày đã cắt giờ. Ngày hẹn dùng múi giờ Việt Nam; chọn ngày hết hạn khi hạ hạng giữ nguyên timestamp gói cũ. UI phân loại gia hạn/nâng/hạ theo tier cùng quy tắc BE, kể cả cùng hạng khác thời hạn. |
| F02 — thiếu hủy ACTIVE tại quầy | Lễ tân/ADMIN có modal hủy ACTIVE và SCHEDULED; hiển thị chính sách và kết quả yêu cầu hoàn, không nói đã trả tiền. Booking có nguồn quyền độc lập hợp lệ không bị mô tả là hủy toàn bộ. |
| F03 — thiếu doanh thu gia hạn | Payment gia hạn ghi planId. Migration `20261031230000_renewal_payment_plan` bổ sung planId cho payment lịch sử có subscription nguồn rõ ràng, không sửa số tiền. Migration chạy lại an toàn. |
| F04 — FREE điểm danh booking cũ | Scanner yêu cầu gói trả phí có hiệu lực hoặc grant kỳ độc lập hợp lệ. FREE vẫn được vào cơ sở, không được điểm danh lớp chỉ nhờ booking lịch sử không có quyền học. |
| F05 — ngừng quyền thủ công giữ chỗ | Gỡ nút SUSPENDED thủ công; API trả 409 `SUBSCRIPTION_SUSPEND_FORBIDDEN`. SUSPENDED chỉ do luồng đổi gói nguyên tử tạo ra. Muốn kết thúc gói dùng luồng hủy với thu hồi booking/hoàn tiền theo chính sách. |
| F06 — SePay thu tiền chưa cấp gói bị kẹt | Thêm ADMIN duyệt hoàn ngoại lệ: `POST /payments/{id}/refund/request` với lý do. Chỉ nhận SePay SUCCESS, REQUIRES_REVIEW và chưa có subscription; số tiền do server lấy từ khoản gốc. Giữ hai bước duyệt yêu cầu → xác nhận trả tiền có biên nhận. Ghi audit, khóa payment/member, duyệt lặp không thay lý do/số tiền. Chặn cấp gói sau khi đã duyệt hoàn. |
| F07 — sửa lịch về quá khứ | Guard thời gian ở cả kiểm tra đầu vào và sau khi lấy khóa transaction. Không cho đổi giờ buổi đã bắt đầu hoặc chuyển lịch tương lai về quá khứ. |
| F08 — QR seed Invalid uuid | Hợp đồng điểm danh nhận ID buổi học dạng string không rỗng, tối đa 200 ký tự, phù hợp model String và ID seed/lịch sử. Kiểm tra quyền HLV, booking, quyền học và cửa sổ thời gian vẫn thực hiện trên server. OpenAPI/metadata FE được cập nhật. |

Đã cập nhật nội dung Chính sách trên UI theo vai trò thực tế và luồng hoàn ngoại lệ. Đã bỏ bước mở chi tiết cũ trong test vào danh sách chờ để test đi đúng nút hiện tại.

## Kiểm chứng

- Bộ QA trên DB tạm: chạy **47 migration**, seed cơ bản/full hai lần, các bộ hồi quy liên cơ sở, gói, báo cáo đều đạt.
- Live browser nối API thật: **24/24 nhóm đạt**, không mock API nghiệp vụ. Có thêm bước lễ tân thực sự hủy ACTIVE bằng UI, kiểm tra booking CANCELLED và payment còn SUCCESS với yêu cầu hoàn; có kiểm tra backfill khoản gia hạn cũ, hoàn ngoại lệ, chặn kích hoạt lại sau duyệt hoàn.
- Trình duyệt regression mở rộng: **33/33 đạt** sau các sửa lỗi chính; kiểm tra chọn lọc sau chỉnh phân loại gói đạt **11/11**. Có test giao diện duyệt hoàn ngoại lệ → nhập biên nhận xác nhận trả tiền.
- FE unit **117/117**, typecheck/build đạt; BE build đạt, hardening **63/63**. FE unit gồm các ca ngày Việt Nam, thời điểm nối tiếp và phân loại gói cùng hạng khác thời hạn.
- Gói FREE được vào cửa, người không có booking bị chặn QR, QR hợp lệ quét lặp không sinh bản ghi trùng; grant theo kỳ sau hết hạn vẫn có test hồi quy.

Thư mục bằng chứng: `C:/Users/ontri/.codex/visualizations/2026/10/31/01a191eb-cc04-7190-8e55-55e5b2c51da3/`.

- `fixed-live-final/strict-live-results.json`: kết quả live sau sửa và ảnh chụp UI.
- `fix-live-final.log`, `fix-qa-live.log`: log thực thi trên PostgreSQL/MongoDB tạm.
- `fix-ui-tests.log`, `fix-ui-final.log`: browser regression.
- `fix-frontend-final.log`, `fix-backend-final.log`, `fix-hardening.log`: kiểm tra FE/BE.

## Chạy lại

```powershell
# Từ BE, cần Docker và dependency FE đã cài; --live dùng Chromium của Playwright.
npm run build
npm run test:hardening
npm run test:qa:isolation -- --live

# Từ FE
npm run verify
npx playwright install chromium
npx playwright test refund-confirmation.spec.ts membership-quick-actions.spec.ts business-flow-sync.spec.ts --workers=2
```

CI đã bật `--live` sau bước cài Chromium. Suite chỉ cho chạy với PostgreSQL/MongoDB local, schema test riêng, token và tài khoản ngân hàng giả. Kết quả kiểm thử không xác nhận mail/Cloudflare/SePay ngân hàng thật hay trạng thái triển khai production.

## Khi triển khai

Sau khi xác nhận môi trường DB và sao lưu theo quy trình triển khai của nhóm, chạy `npm run db:deploy` trong BE để áp migration backfill planId, rồi generate/build và triển khai BE/FE cùng đợt. Không chạy seed trên DB nghiệp vụ thật. Các khoản thiếu cả subscription nguồn không được migration tự đoán gói; cần đối soát riêng.

Nếu trước đây đã có gói bị SUSPENDED thủ công và giữ booking, cần kiểm tra, quyết định hủy/đổi gói theo nghiệp vụ; bản sửa không tự khôi phục các gói lịch sử hoặc tự ghi nhận tiền hoàn.
