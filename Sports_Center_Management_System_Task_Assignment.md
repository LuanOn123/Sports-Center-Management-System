# PHÂN CÔNG CÔNG VIỆC DỰ ÁN
## Sports Center Management System

## 1. Thông tin chung

**Tên dự án:** Sports Center Management System  
**Quy mô nhóm:** 5 thành viên

### Công nghệ dự kiến
- **Web Frontend:** Vite + React + TailwindCSS
- **Mobile:** React Native + Expo
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT + Refresh Token
- **API Documentation:** Swagger
- **Realtime/Notification:** Socket.IO hoặc Push Notification nếu cần
- **AI:** OpenAI/Gemini hoặc AI Provider phù hợp
- **Design:** Figma
- **Version Control:** Git + GitHub

## 2. Actors

### Center Manager – Quản lý trung tâm
- Quản lý thành viên, huấn luyện viên và nhân viên.
- Quản lý lớp học, bộ môn, phòng tập và lịch hoạt động.
- Phân công huấn luyện viên phụ trách lớp.
- Xem báo cáo thành viên, đăng ký lớp và doanh thu.
- Quản lý gói thành viên, học phí và thời hạn.
- Phân quyền theo vai trò.
- Xem lịch sử thao tác quan trọng.

### Coach – Huấn luyện viên
- Xem lịch dạy và danh sách học viên.
- Xem mục tiêu tập luyện của học viên.
- Tạo kế hoạch tập luyện.
- Ghi nhận kết quả tập luyện.
- Đánh giá tiến độ và nhận xét.
- Điểm danh học viên.
- Gửi thông báo hoặc bài tập.
- Sử dụng AI để gợi ý bài tập.

### Member – Học viên / Thành viên
- Đăng ký tài khoản và cập nhật hồ sơ.
- Xem, đăng ký và gia hạn gói thành viên.
- Xem danh sách lớp và lịch học.
- Đăng ký hoặc hủy đăng ký lớp.
- Xem lịch tập cá nhân và thông tin huấn luyện viên.
- Xem lịch sử điểm danh và kết quả tập luyện.
- Xem kế hoạch và nhận xét.
- Hỏi AI về lịch tập, bài tập hoặc dịch vụ trung tâm.
- Nhận thông báo.

### Receptionist – Nhân viên lễ tân
- Tìm kiếm thông tin thành viên.
- Đăng ký thành viên mới tại quầy.
- Quản lý đăng ký/gia hạn gói thành viên.
- Kiểm tra trạng thái và thời hạn gói.
- Điểm danh thành viên.
- Hỗ trợ đăng ký/hủy lớp.
- Ghi nhận thanh toán và xuất hóa đơn.
- Ghi nhận yêu cầu hỗ trợ.

---

# 3. Các Flow chính

| Flow | Tên | Mức độ |
|---|---|---|
| Flow 1 | User and Membership Management | Required |
| Flow 2 | Class Booking and Schedule Management | Required |
| Flow 3 | Payment and Report Management | Required |
| Flow 4 | Training and Attendance Management | Optional |
| Flow 5 | AI Workout Recommendation | Optional |
| Flow 6 | AI Assistant | Optional |

> **Nguyên tắc:** Flow 1, Flow 2 và Flow 3 phải hoàn thiện trước khi ưu tiên phát triển AI.

---

# 4. Phân chia nền tảng

| Platform | Actor chính |
|---|---|
| Web | Center Manager |
| Web | Receptionist |
| Web | Coach |
| Mobile | Member |
| Mobile | Coach |

Định hướng sử dụng:
- **Center Manager:** chủ yếu Web.
- **Receptionist:** chủ yếu Web.
- **Coach:** Web + Mobile.
- **Member:** chủ yếu Mobile.

---

# 5. Phân công 5 thành viên

## Member 1 – Leader + System Integration + Center Manager Web

### Vai trò chính
- Leader / Project Coordinator.
- Theo dõi tiến độ toàn nhóm.
- Quản lý integration giữa Web, Mobile và Backend.
- Phụ trách chức năng Center Manager trên Web.

### Công việc quản lý
- [ ] Phân tích requirement.
- [ ] Hoàn thiện Use Case Diagram.
- [ ] Xây dựng Permission Matrix.
- [ ] Review ERD cùng Backend.
- [ ] Thống nhất API Contract.
- [ ] Setup Git workflow.
- [ ] Tạo backlog/task cho nhóm.
- [ ] Review Pull Request quan trọng.
- [ ] Theo dõi integration.
- [ ] Chuẩn bị demo scenario.
- [ ] Kiểm tra Definition of Done.

### Center Manager Web
- [ ] Manager Dashboard.
- [ ] User Management.
- [ ] Member Management.
- [ ] Coach Management.
- [ ] Receptionist/Staff Management.
- [ ] Membership Plan Management.
- [ ] Sport Management.
- [ ] Room Management.
- [ ] Class Management.
- [ ] Schedule Management.
- [ ] Coach Assignment.
- [ ] Role & Permission Management.
- [ ] Audit Log.
- [ ] Revenue Report.
- [ ] Member Report.
- [ ] Class Enrollment Report.

### Route gợi ý
```text
/manager/dashboard
/manager/users
/manager/members
/manager/coaches
/manager/staff
/manager/membership-plans
/manager/sports
/manager/rooms
/manager/classes
/manager/schedules
/manager/reports
/manager/audit-logs
```

### Flow phụ trách chính
- Flow 1.
- Phần Manager của Flow 2.
- Phần Report của Flow 3.
- System Integration.

---

## Member 2 – Backend Specialist

### Vai trò chính
- Backend Owner.
- Chịu trách nhiệm kiến trúc API, Database và Business Logic.
- Review mọi thay đổi liên quan Backend.

### Backend Infrastructure
- [ ] Setup Node.js + Express.
- [ ] Setup PostgreSQL.
- [ ] Setup Prisma ORM.
- [ ] Thiết kế database schema.
- [ ] Environment Configuration.
- [ ] Error Middleware.
- [ ] Validation Middleware.
- [ ] Authentication.
- [ ] JWT Access Token.
- [ ] Refresh Token.
- [ ] Password Hashing.
- [ ] Role Based Access Control.
- [ ] Swagger API Documentation.
- [ ] Seed Data.
- [ ] Postman Collection.

### Flow 1 API
- [ ] Register.
- [ ] Login.
- [ ] Logout.
- [ ] Refresh Token.
- [ ] Get Profile.
- [ ] Update Profile.
- [ ] CRUD User.
- [ ] CRUD Membership Plan.
- [ ] Register Membership.
- [ ] Renew Membership.
- [ ] Check Membership Status.

### API group
```text
/auth
/users
/members
/coaches
/receptionists
/membership-plans
/subscriptions
/roles
```

### Flow 2 API
- [ ] CRUD Sport.
- [ ] CRUD Room.
- [ ] CRUD Class.
- [ ] CRUD Class Schedule.
- [ ] Assign Coach.
- [ ] Book Class.
- [ ] Cancel Booking.
- [ ] Check Class Capacity.
- [ ] Check Coach Schedule Conflict.
- [ ] Check Room Schedule Conflict.
- [ ] Check Member Schedule Conflict.
- [ ] Check Membership Expiration.

```text
/sports
/rooms
/classes
/class-schedules
/enrollments
```

### Flow 3 API
- [ ] Payment API.
- [ ] Invoice API.
- [ ] Revenue Report.
- [ ] Member Report.
- [ ] Enrollment Report.
- [ ] Membership Report.

```text
/payments
/invoices
/reports
```

### Optional API
- [ ] Attendance.
- [ ] Training Plan.
- [ ] Training Result.
- [ ] Notification.
- [ ] Audit Log.
- [ ] AI Workout Recommendation.
- [ ] AI Chat Assistant.

```text
/attendance
/training-plans
/training-results
/notifications
/audit-logs
/ai/workout
/ai/chat
```

### Flow phụ trách
- Backend cho toàn bộ Flow 1–6.

---

## Member 3 – Web Frontend + Receptionist

### Vai trò chính
- Web Frontend Owner.
- Phụ trách Receptionist Portal.
- Xây dựng reusable components dùng chung cho Web.

### Common Web
- [ ] Setup Vite React.
- [ ] TailwindCSS.
- [ ] React Router.
- [ ] Axios Client.
- [ ] TanStack Query.
- [ ] Authentication UI.
- [ ] Protected Route.
- [ ] Role-based Route.
- [ ] Sidebar.
- [ ] Navbar.
- [ ] Table Component.
- [ ] Form Component.
- [ ] Modal Component.
- [ ] Toast Notification.
- [ ] Loading State.
- [ ] Error Handling.

### Receptionist Features
- [ ] Receptionist Dashboard.
- [ ] Search Member.
- [ ] View Member Information.
- [ ] Register New Member.
- [ ] Register Membership.
- [ ] Renew Membership.
- [ ] Check Membership Status.
- [ ] Member Check-in.
- [ ] Register Class for Member.
- [ ] Cancel Class for Member.
- [ ] Record Payment.
- [ ] View Invoice.
- [ ] Print/Export Invoice.
- [ ] Support Request Management.

### Route gợi ý
```text
/receptionist/dashboard
/receptionist/members
/receptionist/members/create
/receptionist/membership
/receptionist/classes
/receptionist/checkin
/receptionist/payments
/receptionist/support
```

### Flow phụ trách chính
- Receptionist side của Flow 1.
- Receptionist side của Flow 2.
- Receptionist side của Flow 3.

---

## Member 4 – React Native + Member Mobile

### Vai trò chính
- Mobile Owner.
- Phụ trách ứng dụng React Native cho Member.
- Hỗ trợ Coach Mobile khi cần.

### Mobile Infrastructure
- [ ] Setup Expo.
- [ ] Expo Router hoặc React Navigation.
- [ ] Authentication.
- [ ] Secure Token Storage.
- [ ] Axios Client.
- [ ] TanStack Query.
- [ ] React Hook Form.
- [ ] Zod Validation.
- [ ] Bottom Navigation.
- [ ] Reusable Mobile Components.
- [ ] Loading/Error State.
- [ ] Push Notification nếu cần.

### Member Mobile Features

#### Home
- [ ] Membership Status.
- [ ] Upcoming Classes.
- [ ] Recent Workout.
- [ ] Notification Summary.
- [ ] AI Shortcut.

#### Membership
- [ ] Membership Plan List.
- [ ] Membership Plan Detail.
- [ ] Current Membership.
- [ ] Register Membership.
- [ ] Renew Membership.
- [ ] Expiration Date.

#### Class
- [ ] Class List.
- [ ] Class Detail.
- [ ] Coach Information.
- [ ] Schedule.
- [ ] Available Slots.
- [ ] Book Class.
- [ ] Cancel Booking.

#### Training
- [ ] Personal Schedule.
- [ ] Training Plan.
- [ ] Workout History.
- [ ] Coach Comments.
- [ ] Attendance History.

#### Profile
- [ ] Personal Information.
- [ ] Fitness Goal.
- [ ] Training Level.
- [ ] Training Preferences.
- [ ] Update Profile.

#### Notification & AI
- [ ] Notification List.
- [ ] AI Assistant UI.
- [ ] Chat History nếu cần.
- [ ] Send Message.
- [ ] Show AI Response.

### Navigation gợi ý
```text
Home
Classes
Schedule
Training
Notifications
Profile
```

### Flow phụ trách chính
- Member side của Flow 1.
- Member side của Flow 2.
- Member side của Flow 4.
- Flow 6 – AI Assistant UI.

---

## Member 5 – UI/UX Figma Lead + Coach + QA

### Vai trò chính
- UI/UX Owner.
- Coach Feature Owner.
- QA hỗ trợ kiểm thử UI/UX và flow.
- Review consistency của toàn bộ giao diện.

### Figma Design System
- [ ] Color Palette.
- [ ] Typography.
- [ ] Spacing.
- [ ] Button.
- [ ] Input.
- [ ] Select.
- [ ] Modal.
- [ ] Card.
- [ ] Table.
- [ ] Badge.
- [ ] Navbar.
- [ ] Sidebar.
- [ ] Bottom Navigation.
- [ ] Dialog.
- [ ] Toast.
- [ ] Chart Components.

### Layout
- [ ] Desktop Layout.
- [ ] Tablet Layout nếu cần.
- [ ] Mobile Layout.
- [ ] Prototype.
- [ ] UI Review.

### Coach Web
- [ ] Coach Dashboard.
- [ ] Teaching Schedule.
- [ ] My Classes.
- [ ] Class Detail.
- [ ] Student List.
- [ ] Student Profile.
- [ ] Student Fitness Goal.
- [ ] Workout History.
- [ ] Attendance History.
- [ ] Training Plan.
- [ ] Create Training Plan.
- [ ] Edit Training Plan.
- [ ] Assign Exercise.
- [ ] Record Training Result.
- [ ] Coach Comment.
- [ ] Progress Evaluation.
- [ ] Attendance.

### Coach Mobile
- [ ] Today Schedule.
- [ ] My Classes.
- [ ] Attendance.
- [ ] Student List.
- [ ] Student Detail.
- [ ] Training Result Input.
- [ ] Coach Comment.
- [ ] Progress Update.

### AI Workout Recommendation
- [ ] AI Recommendation UI.
- [ ] Select Member.
- [ ] Load Member Goal.
- [ ] Load Training Level.
- [ ] Load Workout History.
- [ ] Generate Recommendation.
- [ ] Coach Review.
- [ ] Coach Edit.
- [ ] Assign Recommendation to Member.

### QA
- [ ] Kiểm tra Responsive.
- [ ] Kiểm tra UI Consistency.
- [ ] Kiểm tra các Flow chính.
- [ ] Ghi nhận bug.
- [ ] Regression Test sau khi fix bug.

### Flow phụ trách chính
- Flow 4.
- Flow 5.
- Coach side của Flow 2.

---

# 6. Phân chia Figma

Không để một người làm toàn bộ Figma.

| Khu vực | Người phụ trách |
|---|---|
| Design System | Member 5 |
| Center Manager | Member 1 |
| Receptionist | Member 3 |
| Member Mobile | Member 4 |
| Coach Web/Mobile | Member 5 |

Member 5 chịu trách nhiệm review cuối cùng để giao diện đồng nhất.

---

# 7. Ownership theo Flow

| Flow | Priority | Owner | Backend | Web | Mobile |
|---|---|---|---|---|---|
| Flow 1 – User & Membership | Required | Member 1 | M2 | M1 + M3 | M4 |
| Flow 2 – Class Booking & Schedule | Required | Member 3 | M2 | M1 + M3 + M5 | M4 |
| Flow 3 – Payment & Report | Required | Member 1 | M2 | M1 + M3 | M4 nếu cần |
| Flow 4 – Training & Attendance | Optional | Member 5 | M2 | M5 | M4 + M5 |
| Flow 5 – AI Workout Recommendation | Optional | Member 5 | M2 | M5 | M4 hỗ trợ |
| Flow 6 – AI Assistant | Optional | Member 4 | M2 | Optional | M4 |

---

# 8. Database Entity dự kiến

```text
User
Role

MemberProfile
CoachProfile

MembershipPlan
MembershipSubscription

Sport
Room

Class
ClassSchedule
Enrollment

Attendance

Payment
Invoice

TrainingPlan
TrainingExercise
TrainingResult

Notification

SupportRequest

AuditLog

AIConversation
AIMessage
AIRecommendation
```

---

# 9. Sprint Plan

## Sprint 0 – Requirement & Setup
### Member 1
- [ ] Requirement.
- [ ] Use Case.
- [ ] Permission Matrix.
- [ ] Git workflow.
- [ ] Project planning.

### Member 2
- [ ] ERD.
- [ ] Database setup.
- [ ] Backend skeleton.

### Member 3
- [ ] Web skeleton.
- [ ] Common components.

### Member 4
- [ ] Mobile skeleton.
- [ ] Navigation.

### Member 5
- [ ] Design System.
- [ ] Main Wireframe.
- [ ] Prototype.

---

## Sprint 1 – Authentication & User Management
- [ ] Register.
- [ ] Login.
- [ ] Logout.
- [ ] Profile.
- [ ] Role & Permission.
- [ ] User Management.
- [ ] Web authentication.
- [ ] Mobile authentication.

---

## Sprint 2 – Membership Management
- [ ] Membership Plan.
- [ ] Membership Registration.
- [ ] Membership Renewal.
- [ ] Expiration Checking.
- [ ] Receptionist Membership Flow.
- [ ] Member Mobile Membership Flow.

---

## Sprint 3 – Class & Schedule
- [ ] Sport.
- [ ] Room.
- [ ] Class.
- [ ] Schedule.
- [ ] Coach Assignment.
- [ ] Booking.
- [ ] Cancel Booking.
- [ ] Capacity Validation.
- [ ] Schedule Conflict Validation.

---

## Sprint 4 – Payment & Report
- [ ] Payment.
- [ ] Invoice.
- [ ] Revenue Report.
- [ ] Membership Report.
- [ ] Enrollment Report.
- [ ] Dashboard Charts.

---

## Sprint 5 – Training & Attendance
- [ ] Coach Attendance.
- [ ] Training Plan.
- [ ] Training Result.
- [ ] Coach Evaluation.
- [ ] Member Training History.

---

## Sprint 6 – AI, Testing & Deployment
- [ ] AI Workout Recommendation.
- [ ] AI Assistant.
- [ ] Notification.
- [ ] Integration Testing.
- [ ] Bug Fixing.
- [ ] Deployment.
- [ ] Demo Preparation.

---

# 10. Git Workflow

```text
main
│
└── develop
     │
     ├── feature/BE-01-auth
     ├── feature/WEB-01-manager-dashboard
     ├── feature/WEB-02-receptionist-member
     ├── feature/MOB-01-member-booking
     └── feature/MOB-02-coach-attendance
```

### Quy tắc Git
- Không push trực tiếp vào `main`.
- Mỗi task tạo một branch riêng.
- Hoàn thành task phải tạo Pull Request.
- Có ít nhất một người review trước khi merge.
- Merge feature branch vào `develop`.
- Chỉ merge `develop` vào `main` khi đã integration test.

---

# 11. Cách quản lý Task

Mỗi task cần có các thông tin:

| Field | Ví dụ |
|---|---|
| ID | MOB-12 |
| Feature | Book Class |
| Assignee | Member 4 |
| Flow | Flow 2 |
| Platform | Mobile |
| Priority | High |
| API Dependency | GET /classes |
| Status | IN PROGRESS |
| Figma | Done |
| Frontend | Done |
| Backend | Done |
| Integration | Testing |

### Status chung
```text
TODO
IN PROGRESS
REVIEW
TESTING
DONE
BLOCKED
```

Không dùng các trạng thái không rõ ràng như:
- "Gần xong"
- "90% rồi"
- "Còn chút"
- "Đang sửa"

---

# 12. Definition of Done

Một task chỉ được chuyển sang **DONE** khi:

- [ ] Figma hoàn thành nếu task cần UI.
- [ ] Frontend hoàn thành.
- [ ] Backend hoàn thành.
- [ ] Database xử lý đúng.
- [ ] Validation đầy đủ.
- [ ] Role/Permission đúng.
- [ ] API Integration thành công.
- [ ] Error Handling đầy đủ.
- [ ] Test thành công.
- [ ] Pull Request đã được review.
- [ ] Code đã merge vào develop.
- [ ] Demo được end-to-end.

---

# 13. Ưu tiên phát triển

Thứ tự ưu tiên:

```text
Authentication
    ↓
Flow 1 – User & Membership
    ↓
Flow 2 – Class Booking & Schedule
    ↓
Flow 3 – Payment & Report
    ↓
Flow 4 – Training & Attendance
    ↓
Flow 5 – AI Workout Recommendation
    ↓
Flow 6 – AI Assistant
```

> Không ưu tiên AI nếu các flow bắt buộc vẫn chưa hoạt động end-to-end.

---

# 14. Tóm tắt trách nhiệm

| Member | Main Responsibility | Feature chính |
|---|---|---|
| Member 1 | Leader + Integration + Web | Center Manager, User, Class, Report, Role, Audit |
| Member 2 | Backend | Auth, User, Membership, Class, Booking, Payment, Attendance, AI API |
| Member 3 | Web Frontend | Receptionist, Membership, Booking, Payment |
| Member 4 | Mobile | Member App, Membership, Booking, Schedule, Training History, AI Assistant |
| Member 5 | UI/UX + Coach + QA | Figma, Coach, Training, Attendance, AI Workout Recommendation |

---

# 15. Nguyên tắc làm việc của nhóm

1. Mỗi feature phải có **một Owner rõ ràng**.
2. Không để task không có Assignee.
3. Required Flow luôn có priority cao hơn Optional Flow.
4. Backend API phải được thống nhất trước khi Frontend/Mobile tích hợp.
5. Figma phải được thống nhất trước khi code UI chính.
6. Mỗi thành viên cập nhật trạng thái task thường xuyên.
7. Task bị BLOCKED phải ghi rõ nguyên nhân.
8. Leader kiểm tra integration cuối mỗi sprint.
9. Không merge code chưa test vào `main`.
10. Mỗi thành viên phải hiểu rõ module mình phụ trách để có thể demo và trả lời khi giảng viên hỏi.
