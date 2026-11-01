# Sửa lỗi theo báo cáo kiểm thử lần 2 — 01/11/2026

Đối chiếu báo cáo tại commit `0f3db02`. Bản này sửa source local, chưa push/deploy và chưa thay đổi database Render.

## Các thay đổi

| Mục | Cách xử lý | Kiểm chứng hiện có |
|---|---|---|
| C2 | Migration bổ sung `Term.facilityId`, index và FK; tương thích với DB từng chạy bản vá thủ công. | Đã kiểm tra source; chưa thực thi trên DB trống. |
| N1 | Khi thu hồi gói, hủy cả booking tương lai chưa có nguồn **chỉ khi không còn gói trả phí ACTIVE/SCHEDULED khác**. Không đụng lịch sử hoặc booking thuộc gói khác. | Test trường hợp có/không có gói khác, refund, grant và attribution. |
| H1 | Thu tay bắt buộc gói nguồn đúng hội viên, đúng giá snapshot (fallback giá plan cho dữ liệu cũ), đúng trạng thái. Khóa theo hội viên trong transaction và chặn giao dịch PENDING/SUCCESS trùng. FE lọc gói đã có giao dịch. | Test thiếu nguồn, sai tiền, FREE, thu trùng và thu hợp lệ. |
| H2 | OTP tối đa 5 lần thử, lưu bộ đếm trong Mongo; cooldown gửi lại 60 giây; cập nhật OTP/mật khẩu bằng compare-and-set; chặn IP burst ở route. | Test 40 mã sai rồi mã đúng vẫn bị chặn; mã đúng dùng một lần, thu hồi phiên, cooldown và 429. |
| H3 | Truy vấn gói hiệu lực dùng cùng cohort MEMBER đang hoạt động với tổng hội viên. Đếm người DISTINCT. | Test cohort và nhiều gói của cùng người; không che lỗi bằng ép số âm về 0. |
| H4 | Admin có trang `/admin/subscriptions`, hủy gói ACTIVE/SCHEDULED, thao tác trạng thái hợp lệ và nút thử kích hoạt giao dịch SePay SUCCESS/REQUIRES_REVIEW. Không mở lại quyền tài chính toàn cục cho Manager. | FE kiểm tra quyền, typecheck/build; chưa kiểm thử thao tác ghi qua trình duyệt. |
| M1 | Luồng mua gói dùng chung chặn FREE/giá <= 0; FE không đưa chúng vào danh sách bán. Cấp FREE tự động giữ nguyên. | Test chặn mua FREE. |
| M2 | Tạo lịch đơn/batch/hoạt động qua cùng service chặn buổi bắt đầu trong quá khứ. | Test chặn trước khi ghi dữ liệu. |
| M3 | Coach chỉ đọc hồ sơ hội viên có enrollment BOOKED/COMPLETED trong lịch mình dạy (gồm HLV thay thế/hỗ trợ theo resolver hiện tại). | Test có/không có quan hệ giảng dạy. |
| N2/M4 | Hai seed tạo kỳ trước lịch; seed đầy đủ gắn kỳ vào pattern, mỗi HLV một cơ sở; lớp HIIT Q7 dùng HLV thuộc Q7 và có chuyên môn HIIT. | Source compile; chưa xác nhận seed chạy hoàn chỉnh trên DB trống. |
| N3 | Fixture lịch của 3 suite liên cơ sở và business-gaps có kỳ/HLV chính; gói chờ kích hoạt trong test có thanh toán SUCCESS. | Typecheck cả các file test đã sửa; chưa chạy tích hợp DB. |
| M5 | 6 suite E2E vẫn gọi HTTP login thật nhưng dùng fixture cho phản hồi Cloudflare. Helper chỉ cho PostgreSQL schema `scms_verify_*` và PostgreSQL/Mongo loopback, token dùng một lần; production không import helper. | Test helper từ chối DB ngoài local và token replay; suite CAPTCHA độc lập 27 bài qua. Chưa chạy toàn bộ 6 suite với DB. |
| L1 | Vào waitlist dùng chung bộ kiểm tra điều kiện đặt lớp; chỉ bỏ bước chặn sức chứa vì buổi đã đầy. | Test hội viên hết hạn không tạo được entry. |
| L3 | Public/non-Admin chỉ xem gói đang bán; Admin được xác thực để quản lý cả gói ngừng bán. | HTTP test public không vượt filter, inactive detail 404; Admin xem được. |
| L4 | Đăng ký/cập nhật profile chặn ngày sinh hơn 120 năm trước năm hiện tại. | Test năm 1800 bị chặn, năm 2000 hợp lệ. |

Công cụ audit contract đã nhận diện đúng `authorizeExact`, tránh ghi nhầm endpoint chỉ dành Admin thành endpoint chỉ cần đăng nhập.

## Kết quả kiểm tra local

- BE `npm run build`: PASS.
- BE `npm run test:hardening`: 83/83 PASS (gồm 20 regression mới).
- BE `npm run test:captcha`: 27/27 PASS.
- TypeScript strict cho các fixture và các file E2E/integration đã sửa: PASS (kèm `src/types/express.d.ts`).
- FE `npm run verify`: PASS; 115/115 test, typecheck và build thành công.
- FE `npm run check:api-contract`: FE 188 / BE 188, không thiếu endpoint.
- `git diff --check`: PASS.
- Vite vẫn cảnh báo bundle >500 kB; không phải lỗi build.

## Chưa được xác minh / giữ nguyên có chủ đích

- `npm run test:audit-round2:integration` dừng trước khi tạo DB: Docker Engine không hoạt động (`dockerDesktopLinuxEngine` không tồn tại). Không chuyển sang dùng DB thật để chạy test ghi dữ liệu.
- Vì vậy chưa khẳng định migration + hai seed + các suite DB/E2E đã PASS. Cần chạy lại trên DB cô lập khi Docker hoạt động.
- Không xóa bảng TrainingPlan/TrainingResult và cột Payment cũ chỉ để hết schema drift: cần đối chiếu dữ liệu và kế hoạch migration riêng trước khi bỏ.
- Booking cũ không rõ nguồn trong khi còn gói trả phí khác được giữ nguyên để tránh thu hồi nhầm quyền; cần đối soát thủ công nếu muốn gán nguồn lịch sử.
- Gói FREE vẫn được vào cơ sở theo quy tắc hiện tại (M6). Không tự đổi chính sách này.
- Gia hạn cùng hạng vẫn tự nối tiếp ngày hết hạn; FE đã giải thích quy tắc. Không thay đổi ngày kích hoạt đã được nghiệp vụ chốt.
- Chưa thực hiện QA trình duyệt mới cho màn Admin và chưa lặp lại toàn bộ 182 kịch bản HTTP của tác giả báo cáo.

## Chạy kiểm tra và triển khai

```powershell
cd BE
npm run test:audit-round2:integration
```

Lệnh này tự tạo PostgreSQL Docker và Mongo replica set tạm, chạy **toàn bộ migration thực**, hai seed và bốn suite fixture đã cập nhật, sau đó dọn tài nguyên thuộc lần chạy đó. Yêu cầu Docker đang chạy và đường dẫn mongod hợp lệ (`SCMS_TEST_MONGOD` nếu khác mặc định). Không dùng connection string database thật của máy.

Khi triển khai BE với database đã cấu hình đúng:

```powershell
cd BE
npm run db:deploy
npm run build
```

Migration hardening cũ vẫn có preflight bảo vệ dữ liệu; nếu còn lịch tương lai thiếu kỳ/thiếu HLV chính hoặc gói trùng, phải đối soát theo tài liệu hardening hiện có trước khi deploy tiếp. Không tắt trigger hoặc xóa dữ liệu để vượt kiểm tra. Không chạy seed demo trên production.

Đối với rate limit: cấu hình `TRUST_PROXY_HOPS` theo số proxy ingress tin cậy thực tế. Mặc định `0` khi truy cập trực tiếp/local; nếu deployment có đúng một proxy ingress tin cậy thì dùng `1`. Không đặt `trust proxy=true` tùy tiện. Bộ đếm OTP theo tài khoản nằm trong Mongo; IP limiter hiện là bộ nhớ theo process, không phải quota IP toàn cụm.
