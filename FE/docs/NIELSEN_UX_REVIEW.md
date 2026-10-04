# Rà soát UX theo 10 nguyên tắc của Jakob Nielsen

Nguồn tham khảo: [10 Usability Heuristics for User Interface Design — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/).

Phạm vi: frontend sau khi đồng bộ main (`03c1a4f`), gồm giao diện công khai, manager, reception, coach và member. Áp dụng qua component dùng chung và các luồng thực tế; không thay framework, endpoint, quyền nghiệp vụ hoặc thiết kế lại các màn hình đang sử dụng tốt. Đây là đánh giá heuristic và kiểm thử kỹ thuật, không phải chứng nhận hoặc kết quả nghiên cứu với người dùng thực.

## Hai vấn đề được ưu tiên

### Xem ảnh trong chat

Trước: ảnh chỉ là thumbnail, không có thao tác xem chi tiết.

Sau: thumbnail là button có nhãn rõ ràng. Click/Enter mở dialog lớn, có tăng/giảm mức phóng to 100–300%, vừa khung, tải ảnh, cuộn khi phóng to và đóng bằng Esc/nút đóng. Khi đóng, focus quay lại thumbnail. Cả chat nổi lẫn trang chat dùng chung ProtectedAttachment. Không công khai URL riêng tư; vẫn tải qua fetchAttachment với bearer, dùng lại blob đã tải và thu hồi object URL khi unmount. Tải thất bại có nút thử lại; PDF vẫn giữ luồng tải tệp.

### Theme thông báo

Trước: header và từng thông báo ghi cứng nền trắng/màu chữ sáng-tối không phù hợp portal MEMBER.

Sau: popup, header, item, hover/unread, footer và chữ phụ dùng token của theme hiện tại. Mobile dùng chiều rộng theo viewport. Bổ sung nhãn Chưa đọc, mở rộng nội dung, nút đóng, Escape/trả focus, trạng thái chờ đánh dấu đọc, lỗi tại chỗ và link tới trang thông báo đúng vai trò. Không dùng màu làm dấu hiệu duy nhất.

## Đối chiếu 10 nguyên tắc

| Nguyên tắc | Kết quả kiểm tra và cải thiện |
| --- | --- |
| 1. Hiển thị trạng thái hệ thống | Giữ skeleton/loading/disabled hiện có; thêm trạng thái đang đánh dấu thông báo, tải tệp, mức zoom và banner khi trình duyệt mất mạng. |
| 2. Ngôn ngữ gần với người dùng | Thay các thông báo nội bộ như Swagger, API contract và webhook trên màn hình quản lý/lễ tân bằng giải thích tác vụ và trạng thái khả dụng. Tiêu đề trang chat/thông báo hiển thị đúng chức năng. |
| 3. Quyền chủ động của người dùng | Ảnh lớn và thông báo có cách đóng rõ ràng, hỗ trợ Escape và trả focus. Bộ lọc danh sách có nút xóa; xác nhận nhắc lịch có Hủy. Giữ các cơ chế hủy/đóng modal đang có. |
| 4. Nhất quán | Thông báo theo theme của từng portal; dùng Modal, button, trạng thái lỗi hiện có cho ảnh và trợ giúp. Không thêm UI framework khác. |
| 5. Ngăn ngừa lỗi | Nhắc lịch hàng loạt cần xác nhận trước khi gọi API; chặn thao tác trùng khi đang gửi/đánh dấu đọc. Giữ kiểm tra file 10 MB/MIME, xác nhận hủy và các ràng buộc đặt lớp/thanh toán. |
| 6. Nhận biết thay vì ghi nhớ | Có nhãn xem ảnh lớn, mức zoom, trạng thái Chưa đọc, nội dung thông báo đầy đủ, link xem tất cả; hướng dẫn đặt cạnh thanh điều hướng. Giữ tóm tắt hội viên/giao dịch và nhãn form hiện có. |
| 7. Hiệu quả thao tác | Có điều khiển zoom/vừa khung, tải ảnh, tìm hướng dẫn, xóa bộ lọc, hỗ trợ bàn phím. Giữ chuyển đổi thẻ/bảng, lịch và tìm kiếm có debounce. |
| 8. Tập trung vào thông tin cần thiết | Không phát toast thành công sau từng câu chat AI; lỗi query hiển thị ở khu vực tương ứng thay vì thêm toast lặp từ polling. Giữ toast cho các thao tác thay đổi dữ liệu. Hướng dẫn dài nằm trong phần mở rộng. |
| 9. Nhận biết và khắc phục lỗi | Form đưa focus tới trường lỗi hoặc bản tóm tắt; ảnh lỗi có Tải lại; thông báo lỗi có Thử lại. Giữ dữ liệu nhập khi gửi chat thất bại và các thông điệp xử lý lỗi nghiệp vụ đang có. |
| 10. Trợ giúp | Thêm nút Hướng dẫn sử dụng ở cả 4 portal, có tìm kiếm, các bước cụ thể theo vai trò, link mở đúng chức năng và chính sách. Có hướng dẫn bàn phím và giới hạn tệp đính kèm. |

## Phần đã có và được giữ

- Điều hướng theo quyền, menu mobile, skip link và trạng thái focus.
- Xác nhận thao tác hủy/hoàn tất, không cho đóng modal khi đang ghi dữ liệu.
- Phân trang, bảng cuộn ngang bằng bàn phím, empty/error/loading states.
- Luồng OTP, trạng thái thanh toán SePay, xử lý đơn đang chờ và cơ chế kiểm tra hạn mức/lịch trùng.
- Landing page, theme hội viên và cấu trúc dashboard theo vai trò; không áp dụng một bố cục duy nhất lên mọi trang.

## Kiểm thử

- TypeScript, unit tests và production build theo scripts package.json.
- Kết quả: 50 unit tests đạt. Lượt regression đầy đủ đạt 135/136; một test AI dùng bộ chọn `alert` không đủ cụ thể đã được sửa, sau đó toàn bộ 11 test AI đều đạt. Các ca responsive bao phủ 320–1920px.
- `heuristics.spec.ts`: theme/accessibility/thao tác thông báo cho 4 vai trò ở 375/1440px, trợ giúp theo quyền, xóa bộ lọc, ngoại tuyến và xác nhận gửi nhắc lịch.
- `chat-shortcuts.spec.ts`: tải ảnh có bearer, mở dialog, zoom/vừa khung/tải ảnh, Escape và trả focus ở 320/390/1440px.
- Chạy lại toàn bộ Playwright để kiểm tra tác động lên các màn hình và luồng đã có, gồm 8 chiều rộng 320–1920px.
- Screenshot kiểm tra trong `artifacts/heuristics/`; chỉ là dữ liệu test, không phải giao dịch hoặc tin nhắn production.

## Giới hạn và bước tiếp theo

- Không thêm Undo cho thanh toán, hủy gói hoặc gửi thông báo đã hoàn tất khi backend không có thao tác khôi phục tương ứng; dùng xác nhận và kết quả rõ ràng.
- Banner ngoại tuyến phản ánh kết nối của trình duyệt, không phải phép kiểm tra sức khỏe server. Lỗi server được xử lý tại vùng nội dung.
- Cần thử với người dùng thực theo vai trò để đo thời gian hoàn thành và tỷ lệ thao tác nhầm; những kết quả này không thể suy ra từ kiểm thử tự động.
- Không sửa BE, không gửi nhắc lịch thật, thanh toán thật hay upload ảnh production trong quá trình kiểm thử.
