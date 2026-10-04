# Pulse · Modern Sports SaaS

## Review trước thay đổi

Entry point: `main.tsx → app/App → Session → RoleRouter`. Manager, Reception,
Coach và Member dùng `PortalLayout`; public/auth có layout riêng. Query và API
ở `shared/api`, `api/*`; form Manager/Reception dựa trên contract. Member còn
dùng nhiều style inline, trong khi Coach có stylesheet riêng. Giữ nguyên các
adapter, permissions, business rules và routes.

Vấn đề: toàn bộ scrollbar bị ẩn; visual hierarchy của Reception mỏng; bảng được
dùng cho cả lịch, phòng và nhân sự; member picker chiếm nhiều không gian khi đã
chọn; status chưa đồng nhất; dashboard Manager có banner lớn đẩy dữ liệu xuống;
Member có nhiều màu/radius/font size hard-code; menu Member thiếu icon riêng;
landing có sports imagery tốt nhưng nhiều chuyển động trang trí.

## Nguồn tham khảo và cách áp dụng

- [Mobbin](https://mobbin.com/): flow, sidebar, dialog và trạng thái. Dùng lựa
  chọn theo từng bước, giữ ngữ cảnh hội viên/buổi học khi đặt lớp. Trang công khai
  xem được; không giả định đã truy cập các flow cần đăng nhập.
- [SaaSFrame](https://www.saasframe.io/): dashboard phân cấp, KPI và action rõ.
  Tách overview, báo cáo, transaction và settings theo mục đích.
- [SaaSUI](https://www.saasui.design/): surface sáng, toolbar gọn, data table.
- [Dribbble sports booking](https://dribbble.com/search/sports-booking-app):
  nhịp card, thời gian nổi bật và visual thể thao. Không sao chép một shot.

## Design system

Inter + system fallback; forest primary #203d31, lime secondary #d3f879;
canvas #f4f6f4, white surface, muted surface #edf2ed; ink #22332e,
muted #58695f. Semantic success/warning/danger/info có cả chữ và màu.
Body 16px, UI 14px, caption 12px, h1 28–40px, h2 20–24px; heading 600–700.
Spacing 4/8/12/16/24/32/48/64. Control 10px, card 16px, modal 20px.
Shadow nhẹ; field/button 44px; icon action ít nhất 40px; visible focus.
Sidebar forest, navigation active lime; topbar gọn với liên kết thông báo.
Tables có scroll được nhận biết, row hover và số tiền căn phải; tabs dùng
trạng thái selected; dialog giữ native focus trap và thao tác xác nhận hiện có.

## Các nhóm layout

- Dashboard: summary/quick actions + dữ liệu thực, không tạo số tăng trưởng giả.
- Booking: chọn hội viên → lịch agenda → tóm tắt buổi được chọn → xác nhận.
- Phòng/bộ môn/lớp/gói/nhân sự: card mặc định, chuyển bảng để đối chiếu hàng loạt.
- Member: tìm kiếm + bảng + preview người đã chọn; Payments: transaction table.
- Reports: date range và biểu đồ phân bố hiện có; API chưa có chuỗi thời gian
  thì không vẽ trend hoặc phần trăm so sánh.
- Coach: giữ lịch tuần và roster, đồng nhất surface/type/control.
- Landing: giữ hero thể thao và CTA, giảm chuyển động trang trí.

## Kiểm chứng

Typecheck, build, unit tests; browser tests dùng API fixtures, responsive
320/375/430/768/1024/1280/1440/1920. Kiểm tra screenshot, overflow, keyboard,
modal và accessibility. Fixtures không thay thế kiểm thử production có tài khoản.
