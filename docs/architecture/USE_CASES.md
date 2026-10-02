# Sơ đồ use case hệ thống quản lý trung tâm thể thao

Mã Mermaid để nhập vào draw.io: [sports-center-use-cases.mmd](sports-center-use-cases.mmd).

## Phạm vi và actor

Sơ đồ phản ánh các chức năng có trong mã nguồn backend, frontend và các luồng mới ở `origin/develop`. `Guest` là khách chưa đăng nhập; bốn vai trò trong `BE/prisma/schema.prisma` là `MEMBER`, `COACH`, `STAFF`, `MANAGER`. Trong giao diện, `STAFF` tương ứng khu vực lễ tân. Các use case dùng chung (hồ sơ, mật khẩu, thông báo, chat, đăng xuất) được nối trực tiếp với cả bốn vai trò đã đăng nhập.

Các hình oval nền vàng viền đứt là luồng có ở frontend và/hoặc `origin/develop`, nhưng chưa được mount đầy đủ trong backend của nhánh `main` tại thời điểm rà soát: tự hủy gói/hoàn tiền, điểm danh QR và đánh giá huấn luyện viên. Chúng không nên được coi là đã sẵn sàng trên API của `main`.

## Cách đọc

- Đường liền giữa actor và oval là association.
- `«include»` là bước bắt buộc trong use case nguồn, mũi tên hướng về use case được dùng lại.
- `«extend»` là luồng tùy điều kiện, mũi tên hướng về use case gốc.
- Khung ngoài biểu thị ranh giới hệ thống; các khung bên trong chỉ nhóm use case theo nghiệp vụ, không phải actor hay hệ thống con độc lập.

Mermaid không có loại sơ đồ use case UML riêng. Tệp dùng `flowchart` với ranh giới hệ thống, oval use case và quan hệ UML để draw.io nhập được; biểu tượng người trong actor là ký pháp thay thế cho stick figure chuẩn.

## Nguồn đối chiếu

- Vai trò và mô hình dữ liệu: `BE/prisma/schema.prisma`.
- API được mount trên `main`: `BE/src/app.ts` và các `BE/src/modules/*/*.routes.ts`.
- Luồng giao diện theo vai trò: `FE/src/features/{user,coach,reception,manage}/*Layout.tsx`, cùng các trang trong từng khu vực.
- Luồng mới: các route tương ứng ở `origin/develop` và các component frontend về QR, feedback, hủy gói.

Không đưa màn hình placeholder như phân quyền trực quan, nhật ký audit hoặc hỗ trợ/check-in lễ tân vào sơ đồ khi chưa có luồng nghiệp vụ hoàn chỉnh.
