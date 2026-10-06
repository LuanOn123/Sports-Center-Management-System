# Giao diện thống nhất theo UI hội viên

## Phạm vi

Manager, Reception và Coach dùng chung ngôn ngữ giao diện của User: nền navy tối, điểm nhấn lime, font Inter, bề mặt phân cấp và trạng thái điều khiển rõ ràng. Không thay đổi API, phân quyền, dữ liệu hoặc logic nghiệp vụ.

## Cấu trúc

- Chuyển `features/user/member-theme.css` thành `shared/portal-theme.css`, nạp một lần từ `main.tsx`.
- `PortalLayout` áp dụng `.portal-theme` cho tất cả role; `.member-theme` vẫn được giữ trên User để tương thích các bộ kiểm tra hiện có.
- Các biến `--member-*` được giữ để các trang hội viên sử dụng inline styles tiếp tục hoạt động. Các component chung sử dụng `--color-*`; biểu đồ dùng `--chart-*` với fallback.
- Các selector `.member-*` bên trong theme chỉ áp dụng cho component hội viên tương ứng; không thay đổi bố cục chức năng của role khác.

## Các phần cập nhật

- Sidebar, logo, breadcrumb theo role, navbar sticky và nền ngoài cùng khi cuộn.
- Typography, nút, input, tab, bảng, phân trang, modal, toast và thông báo.
- Manager: KPI, biểu đồ, resource cards, bộ chuyển thẻ/bảng, lịch và form tạo lịch nhanh.
- Reception: tác vụ nhanh, chọn hội viên, lịch đăng ký, trạng thái thanh toán và gói tập.
- Coach: lịch tuần/agenda, trạng thái ngày hiện tại, hồ sơ và danh sách học viên.
- Trạng thái success/warning/error/info có palette riêng; không gom mọi badge thành màu xanh.

## Kiểm tra

- Kết quả ngày 04/10/2026: typecheck và production build thành công, 50/50 unit tests và 154/154 browser tests đạt.
- `portal-theme.spec.ts`: màu nền, overflow, accessibility và screenshot 3 role ở 375/1440px, gồm form tạo lịch nhanh.
- Các bộ kiểm tra hiện có bao phủ responsive 320–1920px, modal, keyboard, chat, thanh toán, đăng ký lớp và role guard.
- Screenshot trong `artifacts/portal-theme/` dùng dữ liệu giả lập; không thực hiện giao dịch production.

## Duy trì

Thêm component mới bằng các biến màu dùng chung thay vì khai báo nền trắng hoặc chữ màu tối trực tiếp. Giữ vùng QR và bản in hóa đơn phù hợp với chức năng quét/in. Các chức năng đang ở trạng thái chờ tích hợp vẫn giữ thông báo hiện có.
