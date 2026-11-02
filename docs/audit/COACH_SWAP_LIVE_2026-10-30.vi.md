# Kiểm thử đổi HLV thực tế — 30/10/2026

Môi trường: FE local 127.0.0.1:5173, API Render demo; thao tác UI bằng ba tài khoản do chủ dự án cung cấp. Không đổi mật khẩu, không thêm quyền/chuyên môn, không sửa source trong lượt kiểm thử này.

## Dữ liệu mới đã tạo

- Cơ sở: Pulse Quận 10.
- Kỳ: QA 30/10 - Đổi HLV, mã QA_SWAP_3010. Ngày hiển thị tại trang kỳ: 02/11–08/11/2026; đăng ký 30/10–01/11. Trạng thái Lập kế hoạch.
- Lớp: QA-SWAP-3010 Bơi đổi HLV, id c5eb6dcd-9b6e-4731-8945-1d7aba9f7030, Bơi lội, Tiêu chuẩn, 5 chỗ, tối thiểu 1, phòng P_01.
- HLV chính lớp ban đầu: Nguyễn Viên. Không gán Nguyễn Viên1 vào lớp dài hạn để tránh che lỗi hiển thị buổi dạy thay.
- Một buổi: thứ Ba 03/11/2026, 15:00–17:00 (GMT+7), P_01, gắn kỳ QA mới.

## Kết quả từng bước

1. Manager tạo kỳ/lớp/lịch, gán Nguyễn Viên: đạt. HLV gốc thấy lớp, form yêu cầu có đúng buổi.
2. Nguyễn Viên gửi đơn, lý do tiền tố QA-SWAP-3010: đạt, trạng thái Chờ xử lý xuất hiện ở hai vai trò.
3. Manager chọn Nguyễn Viên1, duyệt với phản hồi riêng cho buổi: đạt. Danh sách ghi Đã duyệt và HLV thay thế Nguyễn Viên1.
4. HLV gốc tải lại trang, thấy Đã duyệt, đúng phản hồi và thông báo Đã duyệt đổi huấn luyện viên: đạt.
5. HLV mới nhận thông báo duyệt: đạt.
6. Kiểm tra độc lập form Gán HLV cho buổi học (chỉ đọc, đóng bằng Hủy): HLV hiện tại Nguyễn Viên1. Dữ liệu phân công riêng buổi đã lưu đúng, không tự sửa thủ công để giả lập kết quả.
7. Lịch dạy HLV mới tại tuần 02/11–08/11: không có buổi sau tải lại — KHÔNG ĐẠT.
8. Lịch HLV gốc tại cùng tuần: vẫn hiện buổi đã chuyển — KHÔNG ĐẠT.

## Nguyên nhân xác định trong source

FE/src/features/coach/data.ts useSchedules chỉ query từng classId lấy từ useClasses(/classes?coachId=...). HLV dạy thay không có ClassMember dài hạn nên ids rỗng, không tải buổi riêng. Ngược lại lịch lớp của HLV cũ không loại buổi có coachId override sang người khác.

Hướng sửa đúng: lịch đọc theo người dạy hiệu lực (override của buổi ưu tiên hơn HLV chính lớp, giữ HLV hỗ trợ đúng quy tắc); tốt nhất BE cung cấp truy vấn lịch riêng có scope actor và khoảng ngày. FE không nên yêu cầu gán HLV thay thế vào toàn bộ lớp để chữa lỗi, không tải roster của lớp không liên quan. Cần regression test HLV có 0 lớp dài hạn nhưng có buổi thay, HLV gốc mất riêng buổi đó, HLV hỗ trợ giữ quyền, các buổi khác không đổi.

Các phát hiện phụ: nhãn HLV ở calendar/chi tiết Manager vẫn có chỗ dùng HLV chính lớp thay vì override. Dropdown kỳ trong ScheduleForm hiện ngày bắt đầu 01/11 còn trang kỳ hiện 02/11, liên quan slice ngày UTC trước khi format GMT+7. Không thay ngày kỳ để che lệch hiển thị.

Ảnh: FE/artifacts/coach-swap/manager-approved.png; old-coach-approved.png; old-coach-notification.png; manager-current-coach.png; new-coach-missing-schedule.png; old-coach-stale-schedule.png.

Kết luận: không đánh dấu luồng end-to-end đạt. Gửi/duyệt/thông báo và lưu người thay đã đạt; hiển thị lịch hai HLV lỗi. Giữ dữ liệu mới để tái hiện/demo. Không push/deploy thay đổi code trong lượt này.

## Bản sửa local sau kiểm thử

- Thêm coachId cho GET /class-schedules. Controller chuyển actor xác thực vào service; role COACH được ép về coachProfile của chính tài khoản, yêu cầu ID người khác bị 403. Giữ scope cơ sở hiện có.
- Dùng effectiveCoachWhere chung: HLV riêng buổi ưu tiên hơn HLV chính lớp; HLV hỗ trợ vẫn được giữ. Cả nhánh Prisma và raw SQL lọc weekday đều áp dụng trước count/pagination.
- FE lịch query theo coachId và khoảng ngày, không phụ thuộc danh sách lớp dài hạn. Dropdown lớp bổ sung lớp có trong lịch dạy thay. Trang lớp phụ trách dài hạn giữ nguyên.
- Cập nhật Swagger/FE contract riêng tham số mới, giữ các endpoint khác. Không migration, không thay phân công dài hạn, enrollment, attendance hay payment.
- Kiểm tra: BE build, 63 hardening tests, 2 test timetable mới đạt. FE verify đạt 114 unit/typecheck/build; 23/23 browser Coach đạt, gồm substitute không có lớp dài hạn. Test cũ hồ sơ chuyển kiểm tra toast + payload, không bỏ assertion nghiệp vụ.
- Chưa push/deploy. FE mới cần BE có tham số coachId; không sử dụng fallback tải toàn bộ lịch cơ sở. Cần deploy BE trước hoặc cùng FE, sau đó kiểm tra lại dữ liệu QA trên Render; không nhận các bài fixture là bằng chứng Render đã sửa.
