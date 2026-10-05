# Sửa conflict FE trên main — 05/10/2026

Nguồn kiểm tra: main local tại `767ff8d`. Nhánh đi trước origin/main 33 commit khi bắt đầu.

## Thay đổi

- Xử lý dấu conflict lồng nhau trong 25 file TSX, CSS, JSON, tài liệu và tests. Đối chiếu phiên bản FE hợp lệ ở `7172294` (Mongo identities, OTP, bỏ Training Plans) và `1fd8181` (giao diện thống nhất cho các vai trò).
- Giữ portal-theme dùng chung, topbar sticky, lịch hội viên, bảng tổng hợp thanh toán, chat và trình xem ảnh. Không đưa giao diện Training Plans/AI tạo lịch đã bị BE xóa trở lại; xóa cả component không còn được dùng và hướng dẫn cũ trong HelpPanel.
- Giữ migration phiên đăng nhập, ID dạng string, public AI chat, OTP và xử lý lỗi API. Sinh lại inventory/types/operations từ snapshot đã xử lý và workflow overrides: 117 operations.
- Hỗ trợ điều hướng vai trò `RECEPTIONIST` của BE mới vào portal lễ tân, cùng với `STAFF` cũ. Giữ nguyên vai trò API trả về, không cấp portal cho vai trò chưa được hỗ trợ như ADMIN.
- Thêm `check:conflicts`, tự chạy trước build, và lệnh `npm run verify`. Script quét cả CSS, tài liệu và tests; đã xác minh nó trả exit code 1 khi có dấu conflict.
- Tăng timeout cho test quản lý đi qua 14 màn hình để tránh timeout tổng 30 giây khi chạy đồng thời nhiều browser tests; giữ nguyên các assertion.

## Kết quả

- FE `npm run verify`: PASS; 56 unit tests, typecheck và production build PASS.
- Lượt browser đầy đủ: 152/153 PASS; test quản lý hết timeout 30 giây. Sau sửa timeout, lượt kiểm tra lại gồm test đó, login mọi vai trò (thêm RECEPTIONIST) và access guards: 9/9 PASS. Tổng cộng 154 trường hợp browser khác nhau đã được kiểm tra thành công qua các lượt.
- BE `npm run build`: PASS. Không sửa mã BE trong commit này.
- Không còn dấu conflict; `git diff --check` PASS.

Browser tests dùng API fixtures. Workspace chưa có BE/.env, nên chưa xác minh các transaction thật trên MongoDB/PostgreSQL, gửi email OTP hoặc giao dịch ngân hàng. BE mới đã đổi enum User sang RECEPTIONIST/ADMIN nhưng nhiều route/schema vẫn dùng STAFF; điều hướng FE không tự sửa được các quy tắc quyền hoặc migration dữ liệu ở BE.

## Kiểm tra trước lần merge tiếp theo

Trong FE chạy `npm run verify`, sau đó `npm run test:ui`. Không commit file có dấu conflict dù Git báo working tree sạch.
