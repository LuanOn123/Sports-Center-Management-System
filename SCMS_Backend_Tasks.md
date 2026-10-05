# Danh sách Task Backend (BE) theo Nghiệp vụ SCMS

Dựa trên tài liệu đặc tả (BR), dưới đây là danh sách phân rã các Task bắt buộc phải thực hiện ở phía Backend. Các Task được chia theo đúng 6 giai đoạn (P1 - P6) định hướng trong tài liệu.

## Giai đoạn 1 (P1): Auth, Role và Phân quyền Scope
*   [ ] **Task 1.1: Cập nhật Schema User & Staff**
    *   Tạo/cập nhật entity `Facility`.
    *   Tạo entity `FacilityStaff` để thiết lập quan hệ (User - Facility - Role).
    *   Hỗ trợ 5 role: `ADMIN`, `MANAGER`, `COACH`, `RECEPTIONIST`, `MEMBER`.
*   [ ] **Task 1.2: Middleware Phân quyền (BR-AUTH-01, BR-AUTH-02)**
    *   Viết Guard/Middleware verify JWT Token.
    *   Viết Middleware **Facility Scope**: Lấy `facilityId` từ request, đối chiếu với bảng `FacilityStaff` để chặn truy cập chéo cơ sở (Manager/Receptionist chỉ được thao tác trên cơ sở được phân công).
*   [ ] **Task 1.3: API Quản lý Staff (BR-STAFF-01)**
    *   API tạo/sửa cơ sở (Chỉ Admin).
    *   API phân công nhân sự Coach, Receptionist vào cơ sở (Admin/Manager).

## Giai đoạn 2 (P2): Tài nguyên & Môn học (Validation)
*   [ ] **Task 2.1: Quản lý Room & Capability (BR-ROOM-01)**
    *   Tạo Schema `Room` và `RoomCapability` (dạng boolean hoặc số lượng).
    *   API CRUD tài nguyên phòng (Admin/Manager).
    *   **Logic chặn:** Khi tắt/bảo trì một `Room`, BE phải query xem có `Session` tương lai nào dùng phòng đó không, nếu có phải báo lỗi và chặn lại (BR-FAC-02).
*   [ ] **Task 2.2: Quản lý Subject & Yêu cầu (BR-SUBJECT-01)**
    *   Tạo Schema `Subject`, `SubjectRequirement` và `CoachSpecialization`.
    *   API CRUD Môn học và gán điều kiện phòng (Admin).

## Giai đoạn 3 (P3): Sinh lịch và Xử lý Trùng lặp (Core)
*   [ ] **Task 3.1: Thiết lập Schema Lớp học**
    *   Tạo Schema `Slot`, `Class`, `SchedulePattern`, `Session`.
    *   **Logic Snapshot:** Khi Manager khởi tạo `Class`, BE phải copy (snapshot) các requirements của `Subject` lưu cứng vào `Class` đó (BR-ROOM-02).
*   [ ] **Task 3.2: API Sinh lịch (Scheduler) (BR-SCHED-01)**
    *   Viết logic nhận đầu vào `SchedulePattern` và generate ra danh sách các `Session` cụ thể theo từng ngày.
*   [ ] **Task 3.3: Thuật toán Check Conflict (BR-SCHED-02)** - *Phải gọi khi tạo/sửa lịch*
    *   Check `RoomCapacity`: Sĩ số lớp <= Sức chứa của phòng.
    *   Check `RoomCapability`: Phòng được chọn phải map đủ requirement của môn học.
    *   Check `Conflict`: Cùng 1 khoảng thời gian, Room/Coach không được gán cho 2 Session.
    *   Check `Coach`: Coach phải có chuyên môn (`CoachSpecialization`) và không trong trạng thái xin nghỉ (`LeaveRequest`).
*   [ ] **Task 3.4: Luồng Xin nghỉ của Coach (BR-LEAVE-01, 02)**
    *   API gửi request nghỉ phép.
    *   API duyệt (Manager). **Ràng buộc:** Phải có thao tác chọn người thay thế hoặc dời/hủy Session trước khi trạng thái nghỉ được chuyển thành `APPROVED`.

## Giai đoạn 4 (P4): Đăng ký (Enrollment) & Gói tập
*   [ ] **Task 4.1: API Quản lý Gói tập (BR-PLAN-02)**
    *   CRUD `MembershipPlan`. **Ràng buộc:** Khi cập nhật giá, không được làm thay đổi lịch sử giá của các `Subscription` cũ đã bán.
*   [ ] **Task 4.2: API Bán gói tại quầy (BR-PAY-01, 02)**
    *   API tạo `Order` -> Nhập xác nhận thanh toán -> BE sinh ra `Subscription` tương ứng.
*   [ ] **Task 4.3: Luồng Enrollment chống Race Condition (BR-ENR-02)**
    *   *Yêu cầu sử dụng Database Transaction / Lock.*
    *   Check điều kiện 1: `Subscription` của user phải đang Active và đủ thời hạn **bao phủ toàn bộ** thời gian diễn ra khóa học (`validUntil` >= ngày kết thúc Session cuối cùng).
    *   Check điều kiện 2: Quota đếm số Enrollment đang Active <= Giới hạn gói (3 hoặc 6 lớp).
    *   Check điều kiện 3: Sức chứa của Class còn chỗ.
    *   Check điều kiện 4: Lịch học của Class này KHÔNG bị trùng giờ với các Session của lớp khác mà Member đang theo học.

## Giai đoạn 5 (P5): Điểm danh & Vận hành
*   [ ] **Task 5.1: Logic Check-in QR (BR-ATT-02)**
    *   API tạo QR Code (có thời hạn). API quét QR.
    *   **Ràng buộc:** Tại thời điểm quét QR vào cửa, phải query DB check `Subscription` còn hiệu lực không.
*   [ ] **Task 5.2: API Chốt điểm danh Lớp (BR-ATT-03)**
    *   Coach chốt `ClassAttendance`.
    *   **Ràng buộc:** Chỉ cho phép gọi API trong khung giờ mở điểm danh (vd: 30p trước khi học đến khi kết thúc). 
    *   API Sửa điểm danh chỉ dành cho Manager và bắt buộc phải lưu lý do.
*   [ ] **Task 5.3: API Issue/Ticket (BR-ISSUE-01)**
    *   CRUD khiếu nại của Member. Áp dụng scope cơ sở.

## Giai đoạn 6 (P6): Doanh thu & Audit
*   [ ] **Task 6.1: API Báo cáo (BR-REV-01)**
    *   Tính tổng thực thu (Tổng thanh toán thành công - Hoàn tiền).
    *   **Ràng buộc:** Áp dụng Scope cơ sở. Bỏ qua các giao dịch Failed/Pending.
*   [ ] **Task 6.2: Module Audit Log (BR-AUDIT-01)**
    *   Cài đặt hook/interceptor ghi log mọi hành động: Sửa giá, đổi lịch, duyệt nghỉ, sửa điểm danh, xác nhận tiền mặt. Lưu thông tin (Người sửa, thời gian, data cũ, data mới).
