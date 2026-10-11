# Task: Đồng bộ BE/FE sau cập nhật API và hoàn thiện quản lý bộ môn của Coach

Ngày giao: 10/10/2026. Tham chiếu thay đổi API ngày 09/10/2026, đặc biệt commit `a9c03b5`; checkout kiểm tra: `b90e3b1`.

**Người phụ trách:** 01 thành viên Full-stack, chịu trách nhiệm BE, FE, kiểm thử tích hợp và tài liệu API trong cùng đầu việc.

**Ưu tiên:** Cao. Hoàn thiện tính đúng đắn và phân quyền trước khi nghiệm thu UI.

## Mục tiêu

Rà soát lỗi hiện tại và độ đồng bộ giữa API, FE và dữ liệu sau cập nhật; sửa các lỗi được xác nhận. Bổ sung luồng Manager tạo Coach và bắt buộc chọn ít nhất một bộ môn có trong hệ thống. Khi phân công Coach vào lớp, chỉ hiển thị và chỉ cho phép lưu Coach có quyền dạy bộ môn của lớp.

Ví dụ: Coach A được gán Yoga và Pilates; Coach B chỉ được gán Bơi. Khi phân công lớp Yoga, A được chọn, B không xuất hiện. Gọi API trực tiếp với B cũng phải bị từ chối.

## Kết quả kiểm tra ban đầu

Đây là kiểm tra source và test local, chưa phải xác nhận toàn bộ hệ thống triển khai thực tế.

| Điểm | Bằng chứng hiện tại | Việc cần làm |
|---|---|---|
| Manager chưa được tạo tài khoản Coach | `BE/src/modules/users/users.routes.ts` chỉ cho ADMIN; `ManagerUsers.tsx` nhận Coach có sẵn vào cơ sở | Bổ sung quyền và UI tạo Coach dành riêng cho Manager, giới hạn đúng cơ sở |
| Tạo Coach chưa yêu cầu bộ môn | `CreateUserSchema` không có `sportIds`; `createUser` tạo profile trống | Bắt buộc bộ môn trong luồng tạo mới của Manager; cập nhật contract |
| Một phần chức năng đã có | Có bảng `CoachSpecialization`, GET/PUT `/coaches/{id}/specializations`, tab Bộ môn giảng dạy | Tái sử dụng; không tạo thêm quan hệ chuyên môn trùng lặp |
| FE đã lọc chuyên môn | `coachEligibility.ts`, `CoachAssignmentForm.tsx`, `ActivityPlanner.tsx` | Kiểm tra đủ tất cả điểm phân công, sửa lỗi test và cache nếu có |
| BE phân công vào lớp thiếu kiểm tra chuyên môn tại bước ghi | `assignCoach` / `assignSupportCoach` kiểm tra active, staff assignment và lịch nhưng chưa kiểm tra `CoachSpecialization` | Bắt buộc kiểm tra BE cho Coach chính, hỗ trợ và thay thế |
| BE kiểm tra chuyên môn khi xếp lịch | `operations/scheduling.ts` yêu cầu Coach có đủ bộ môn lớp | Dùng chung quy tắc để tránh gán vào lớp thành công nhưng tạo lịch thất bại |
| Quy tắc gỡ bộ môn chưa đồng nhất | FE `CoachSports` giữ bộ môn của các lớp active; PUT BE kiểm tra các lịch SCHEDULED chưa kết thúc | Đồng nhất kiểm tra, kể cả lớp active chưa có lịch |
| Danh mục API còn thiếu | Audit method/path: 168 operation FE, 169 BE; không có route FE bị thiếu ở BE; BE-only `POST /members` | Kiểm tra Swagger và generator; FE tạo hội viên đang dùng `POST /auth/register`, cần đối chiếu luồng staff mới |
| Prisma Client local chưa cập nhật | BE typecheck ban đầu lỗi requesterId/requesterRole và nullability; sau `npm run db:generate` thì qua | Kiểm tra generate trong quy trình build; xác minh migration ở môi trường test/deploy |

Thông tin `specialization` dạng chuỗi chỉ mô tả hồ sơ, không phải nguồn xác định Coach được dạy môn nào. Lưu ý `/coaches/{id}` đọc/sửa hồ sơ dùng userId, còn API specializations và phân công lớp dùng coachProfileId.

## Phạm vi triển khai

### 1. Rà soát và sửa lỗi đồng bộ API

- Đối chiếu thay đổi ngày 09/10 với FE: route, HTTP method, request body, query, response, pagination, enum, nullability, mã lỗi và quyền truy cập.
- Ưu tiên Manager/Reception/Coach: nhân sự cơ sở, lớp, lịch, nghỉ phép, yêu cầu hỗ trợ, chuyên cần và tạo hội viên; sau đó smoke test các luồng còn lại chịu ảnh hưởng. Không giới hạn audit ở module Coach.
- Kiểm tra `X-Facility-Id`, giới hạn dữ liệu theo cơ sở, đổi cơ sở và cache React Query. Không để request/cache của cơ sở cũ xuất hiện ở cơ sở mới.
- Xác minh schema, migration và Prisma Client trên môi trường test. Kiểm tra projection MongoDB/PostgreSQL, đặc biệt userId/coachProfileId và các trường requester mới.
- Lập danh sách lỗi có bước tái hiện, mức độ, expected/actual, nguyên nhân và kết quả sau sửa. Phân biệt lỗi sản phẩm, lỗi fixture/selector test và cấu hình môi trường.
- Cập nhật Swagger/OpenAPI, snapshot, generated types và operation catalog từ nguồn hiện hành. Audit method/path thành công chưa chứng minh DTO hay nghiệp vụ đúng.

### 2. Backend: Manager tạo Coach kèm bộ môn

- Có API cho Manager tạo Coach trong cơ sở được phép quản lý; server cố định role COACH và kiểm tra scope. Không mở quyền tạo ADMIN/MANAGER/RECEPTIONIST thông qua luồng này.
- Bắt buộc `sportIds` có ít nhất một ID hợp lệ từ danh mục bộ môn. Không chấp nhận ID không tồn tại hoặc bộ môn ngừng hoạt động; loại trùng hoặc trả lỗi rõ ràng.
- Sau thành công: có user, CoachProfile, FacilityStaff COACH active tại cơ sở tương ứng và quan hệ CoachSpecialization đầy đủ.
- Xử lý lỗi giữa MongoDB/PostgreSQL bằng cơ chế bù hoặc retry có kiểm soát; không để UI báo thành công với Coach thiếu profile, thiếu cơ sở hoặc thiếu bộ môn. Không giả định một transaction bao phủ cả hai database.
- Tái sử dụng API specializations hiện có, xác thực quyền sửa và kiểm tra ID theo đúng loại. Trả lỗi nghiệp vụ nhất quán để FE hiển thị.

### 3. Backend: kiểm tra điều kiện phân công

- Coach phải active, đúng role, có assignment active vào cơ sở của lớp và đủ bộ môn giảng dạy.
- Lớp nhiều bộ môn: mỗi Coach được phân công phải có **tất cả** bộ môn của lớp, theo quy tắc hiện có ở FE và scheduling BE.
- Áp dụng cho Coach chính, Coach hỗ trợ, Coach dạy thay và đổi bộ môn lớp. Chặn trực tiếp ở BE kể cả client bỏ qua lọc UI.
- Khi gỡ bộ môn, chặn nếu làm Coach không đủ điều kiện cho lớp active đang phụ trách hoặc buổi dạy thay tương lai; trả thông tin để Manager điều chỉnh phân công trước.
- Giữ kiểm tra trùng lịch/nghỉ phép và quy tắc Coach chính/hỗ trợ hiện có. Kiểm tra lại điều kiện trong transaction trước khi ghi để xử lý thay đổi đồng thời.
- Coach cũ chưa có bộ môn không được phân công mới; cung cấp danh sách và cách bổ sung dữ liệu, không suy quyền dạy từ chuỗi mô tả chuyên môn.

### 4. Frontend

- Thêm thao tác Tạo Coach tại trang nhân sự Manager: thông tin tài khoản và chọn nhiều bộ môn; bắt buộc ít nhất một môn trước khi lưu.
- Hiển thị các môn Coach được dạy ở danh sách/hồ sơ; cho phép Manager cập nhật trong phạm vi được quản lý.
- Dropdown phân công lớp Yoga chỉ chứa Coach dạy được Yoga và thuộc cơ sở của lớp. Dùng cùng quy tắc cho form lớp, lịch hoạt động, hỗ trợ và dạy thay.
- Nếu không có Coach phù hợp: hiển thị lý do và hướng dẫn cập nhật bộ môn; không bật lưu. Nếu tải API lỗi: có thông báo và thử lại.
- Sau tạo/sửa bộ môn/đổi cơ sở/đổi môn lớp, làm mới dữ liệu và lựa chọn Coach. Xóa lựa chọn cũ nếu không còn hợp lệ; hiển thị lỗi BE nếu quyền dạy vừa thay đổi.

## Tiêu chí nghiệm thu

1. Manager tạo Coach với 1 hoặc nhiều bộ môn hợp lệ thành công; tải lại trang vẫn thấy dữ liệu đúng.
2. Không chọn môn, môn không tồn tại hoặc môn inactive bị chặn ở cả FE và BE; không phát sinh dữ liệu tạo dở.
3. Manager chỉ tạo/quản lý Coach trong cơ sở được phép; giả mạo role hoặc facility không vượt quyền. Coach/Reception không tự sửa quyền dạy.
4. Lớp Yoga chỉ hiển thị Coach có Yoga. Lớp Yoga + Pilates chỉ hiển thị Coach có đủ hai môn.
5. Gọi thẳng API với Coach sai môn/khác cơ sở/inactive bị từ chối; assignment cũ không bị thay đổi khi request thất bại.
6. Coach chính, hỗ trợ và dạy thay tuân thủ cùng quy tắc; trùng lịch/nghỉ phép vẫn bị xử lý đúng.
7. Gỡ môn đang dùng hoặc đổi môn lớp gây thiếu điều kiện bị chặn nhất quán cả FE/BE, kể cả lớp chưa có lịch tương lai.
8. Coach chưa có môn không được chọn; Manager có thể bổ sung môn rồi phân công mà không cần tải lại toàn bộ ứng dụng.
9. Đổi cơ sở hoặc quyền dạy trong lúc form mở không cho phép lưu lựa chọn cũ không hợp lệ.
10. Swagger, type FE, body thực gửi và response BE thống nhất; xác minh POST `/members` và các trường requester sau cập nhật.
11. Test BE gọi API trực tiếp có cả ca thành công/thất bại; test UI kiểm tra lọc, request ID/body và trạng thái lỗi. Build BE/FE thành công.

## Kiểm thử và bằng chứng bàn giao

Đã chạy khi soạn task:

- FE `npm run typecheck`: qua.
- FE `npm test -- --reporter=dot`: 14 file, 101 test qua.
- BE `npx tsc --noEmit`: qua sau `npm run db:generate`; không chạy migration/database mutation.
- Audit route dùng logic `scripts/audit-api-contract.mjs` ở chế độ không ghi đè báo cáo: 168 FE / 169 BE, missing = 0, BE-only = `POST /members`.
- FE `npx playwright test coach-eligibility.spec.ts manager-scope.spec.ts reception-attendance.spec.ts`: 26 qua, 4 thất bại. Ba ca ở `coach-eligibility.spec.ts` không tìm được select bằng label chính xác hoặc timeout tại select; một ca `manager-scope.spec.ts` timeout vì nút Lưu bộ môn bị disabled. Cần kiểm tra accessible label và fixture các lớp Coach phụ trách trước khi kết luận lỗi nghiệp vụ. Các test này dùng mock API, không chứng minh database hay phân quyền BE thực tế.

Thành viên cần chạy lại `npm run verify`, contract audit và browser tests liên quan ở FE; `npm run build`, test Manager/Reception isolation và test tích hợp Coach ở BE trên database test riêng. Kiểm tra script trước khi chạy, không dùng database production cho test ghi dữ liệu.

Bàn giao 01 PR chứa sửa BE/FE, migration nếu cần, contract/tài liệu cập nhật, bảng lỗi trước/sau và kết quả test. Có video hoặc ảnh luồng Manager tạo Coach → chọn môn → phân công lớp → từ chối Coach sai môn. Ghi rõ cách xử lý Coach cũ thiếu môn và giới hạn kiểm thử còn lại.

## Thứ tự làm và ước lượng sơ bộ

1. Audit API/schema và tái hiện lỗi: 0,5–1 ngày.
2. BE tạo Coach có bộ môn, scope và validation phân công: 1–1,5 ngày.
3. FE tạo Coach, chọn môn và hoàn thiện các form phân công: 0,5–1 ngày.
4. Kiểm thử tích hợp/hồi quy, sửa lỗi và tài liệu bàn giao: 0,5–1 ngày.

Tổng dự kiến: 2,5–4,5 ngày làm việc cho 01 Full-stack; điều chỉnh sau audit theo số lỗi xác nhận. Không bao gồm thiết kế lại toàn bộ UI.
