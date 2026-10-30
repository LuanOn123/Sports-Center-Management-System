# Kết quả kiểm thử trình duyệt — 29/10/2026

Chạy toàn bộ `npx playwright test --workers=3 --reporter=json`: **262 đạt, 35 thất bại, 0 bỏ qua**, tổng 297 ca/52 file; khoảng 8 phút 27 giây. API trong bộ này dùng fixture/mock, khác lượt đóng vai người dùng trên Render. Không sửa source hoặc assertion để đổi kết quả.

Hai ca accessibility (375px/1440px) đạt trong phạm vi màn hình/fixture được suite quét. Hai ca thất bại responsive bên dưới cùng phản ánh tràn ngang 320px, không phải hai lỗi độc lập. Các mốc 375, 430, 768, 1024, 1280, 1440, 1920 của suite responsive đạt.

Nhiều ca thất bại vì expectation đã cũ (menu chat/điểm danh đổi vị trí, uploader lễ tân sau nút sửa, một môn thay nhiều môn, toast thay status nội tuyến, route Manager đổi). Phân loại này dựa vào lỗi locator và source/snapshot; không suy rằng mọi nhánh nghiệp vụ phía sau assertion thất bại đã chạy xong.

| File | Ca thất bại | Phân loại | Điểm dừng |
|---|---|---|---|
| admin-redesign.spec.ts | sport picker filters rooms and persists capacity and area | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByRole('checkbox', { name: /Yoga/ }) |
| app.spec.ts | manager routes, real-schema forms and mobile navigation render | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Mở tin nhắn' }) |
| audit.spec.ts | all portals responsive at 320px | Lỗi sản phẩm: tràn ngang Member 320px | Error: expect(received).toEqual(expected) // deep equality |
| avatar.spec.ts | avatar upload controls: RECEPTIONIST | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('region', { name: 'Cập nhật ảnh đại diện' }) |
| avatar.spec.ts | multipart upload updates navbar | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('region', { name: 'Cập nhật ảnh đại diện' }).locator('input[type="file"]') |
| avatar.spec.ts | avatar viewer supports zoom and Escape | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for locator('.profile-link').getByRole('button', { name: /Xem ảnh đại diện/ }) |
| backend-sync.spec.ts | Mongo member IDs support login/profile and removed modules make no requests | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('link', { name: 'Tài khoản', exact: true }) |
| business-flow-sync.spec.ts | full future session offers schedule-specific waitlist registration | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByText(/Xem.*buổi/Chi tiết.*buổi/) |
| coach-eligibility.spec.ts | replacement coach respects assigned sports | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByRole('textbox', { name: 'Lý do', exact: true }) |
| coach-eligibility.spec.ts | replacement coach respects assigned sports even after revocation | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByRole('textbox', { name: 'Lý do', exact: true }) |
| coach-eligibility.spec.ts | manager cannot remove a sport used by an assigned class but can remove an unused sport | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Hồ sơ Coach', exact: true }) |
| coach.spec.ts | profile validates names, phone and birthdate before API call | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('main').getByRole('status') |
| design.spec.ts | member product screens fit 320px | Lỗi sản phẩm: tràn ngang Member 320px | Error: dashboard |
| facility-operations.spec.ts | room configuration loads existing quantities and blocks saving after failed lookup | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for locator('input[value="mats"]') |
| integration-audit.spec.ts | MANAGER edits coach profile using User.id and cannot create accounts | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | Error: expect(page).toHaveURL(expected) failed |
| manager-scope.spec.ts | Manager has eight main features and obsolete URLs redirect safely | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for locator('.sidebar nav').getByRole('link', { name: 'Người dùng', exact: true }) |
| manager-scope.spec.ts | Coach assignment confirms own facility and refreshes both pools | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Coach chưa phân công', exact: true }) |
| manager-scope.spec.ts | room coordination and activity calendar use the same sessions | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByLabel('Mã cấu hình 1') |
| manager-scope.spec.ts | Manager reviews Reception leave and filters staff support | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByLabel('Lý do', { exact: true }) |
| member-coach-profile.spec.ts | coach card opens profile with all reviews and preserves review context at 390px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog', { name: 'Hồ sơ huấn luyện viên', exact: true }).getByRole('status') |
| member-coach-profile.spec.ts | coach card opens profile with all reviews and preserves review context at 1440px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog', { name: 'Hồ sơ huấn luyện viên', exact: true }).getByRole('status') |
| member-navigation.spec.ts | hover opens a radial menu and facility check-in works in place | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog', { name: 'Check-in cơ sở', exact: true }).getByRole('status') |
| member-style-preview.spec.ts | member visual review | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Mở điểm danh nhanh' }) |
| new-rules.spec.ts | member scans token and writes an anonymous class-specific feedback | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByText('Điểm danh thành công!', { exact: true }) |
| new-rules.spec.ts | compact details and multi-sport editing at 375 | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | Error: expect(received).toEqual(expected) // deep equality |
| new-rules.spec.ts | compact details and multi-sport editing at 1440 | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | Error: expect(received).toEqual(expected) // deep equality |
| reception-profile.spec.ts | reception profile edits explicitly, cancels and saves at 390px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('main').getByRole('status') |
| reception-profile.spec.ts | reception profile edits explicitly, cancels and saves at 1440px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('main').getByRole('status') |
| reception.spec.ts | membership registration and renewal use the selected profile and subscription | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByRole('status') |
| reception.spec.ts | payment validation, submission and printable invoice | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last() |
| scroll-layout.spec.ts | long chat stays readable while scrolling at 375px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Mở tin nhắn', exact: true }) |
| scroll-layout.spec.ts | long chat stays readable while scrolling at 1440px | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Mở tin nhắn', exact: true }) |
| session-loading.spec.ts | whole-course enrollment dialog wraps long content and blocks dismissal during submission | Test cũ dùng ba dấu chấm, UI dùng ký tự … | - waiting for getByRole('dialog').getByRole('button', { name: 'Đang xử lý...' }) |
| workflow.spec.ts | chat sends private multipart messages, validates empty input and rejects unsafe links | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByLabel('Cuộc trò chuyện') |
| workflow.spec.ts | reception views ended sessions without managing schedule or attendance | Cần cập nhật/đối chiếu test với UI mới; chưa xác nhận lỗi nghiệp vụ | - waiting for getByRole('button', { name: 'Học viên & điểm danh' }) |

### Đối chiếu phát sinh ngày 30/10/2026

- Thử thao tác thật bằng Manager do chủ dự án cung cấp, không chỉ fixture. Xác nhận chuyên môn HLV, tạo lớp và lịch riêng; xem chi tiết đầy đủ trong ROLE_USER_JOURNEY_2026-10-29.vi.md.
- Tái hiện lỗi chuyển trang giữ search từ classes sang schedules (Undocumented query parameter search); xóa bộ lọc khôi phục được. Source liên quan: FE/src/features/manage/ResourcePage.tsx giữ query bằng useState theo component dùng lại.
- Tái hiện lỗi nhãn HLV ở calendar Manager: Chưa phân công, trong khi modal chi tiết có Nguyễn Viên và lịch Coach có buổi tương ứng.
- Render hoàn tiền ngay sau hủy gói demo (90.000đ), khác local BE/src/modules/payments/refunds.service.ts chỉ requestRefund. Không dùng pass của source local để chứng nhận hành vi BE đang deploy.
- Không chạy lại toàn bộ suite vì chưa sửa source; số 262/297 ở trên thuộc lần chạy đã ghi ngày 29/10, không phải một lần chạy mới ngày 30/10.
