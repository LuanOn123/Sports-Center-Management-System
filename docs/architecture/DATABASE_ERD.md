# 🗄️ SƠ ĐỒ DATABASE — Sports Center Management System

> Nguồn dữ liệu duy nhất: `BE/prisma/schema.prisma` (PostgreSQL + Prisma ORM).
> File Mermaid: [`database-erd.mmd`](./database-erd.mmd) · Use case: [`sports-center-use-cases.mmd`](./sports-center-use-cases.mmd)

## 1. Tổng quan

| Hạng mục | Số lượng |
|---|---|
| Model (bảng) | **28** |
| Bảng nối nhiều-nhiều ngầm (Prisma) | **1** → `_ClassToSport` |
| **Tổng bảng trong PostgreSQL** | **29** |
| Enum | **18** |
| Migration | 24 file (`BE/prisma/migrations/*`) |

- Database: **PostgreSQL**, truy cập qua **Prisma Client** (không dùng EF Core / SQL thuần).
- Khoá chính: **UUID** (`String @id @default(uuid())`) cho toàn bộ bảng nghiệp vụ.
- Tiền tệ: `Decimal(12,2)`. Dữ liệu linh hoạt: `Json?` (metrics, metadata, payload webhook).
- Xoá dữ liệu: chủ yếu `onDelete: Cascade` theo User/Profile; một số dùng `SetNull` (audit/log giữ lại).

## 2. Danh sách bảng theo nhóm nghiệp vụ

### 🔐 Nhóm 1 — Tài khoản & xác thực
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `User` | Tài khoản (email, password, fullName, phone, gender, avatarUrl, role, isActive, OTP reset mật khẩu) | id | — |
| `RefreshToken` | Refresh token JWT (token, expiresAt, revokedAt) | id | userId → User |

### 👤 Nhóm 2 — Hồ sơ theo vai trò (1-1 với User)
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `MemberProfile` | Hồ sơ hội viên (fitnessGoal, trainingLevel, trainingPreference) | id | userId → User (UK) |
| `CoachProfile` | Hồ sơ HLV (specialization, experienceYears, bio) | id | userId → User (UK) |
| `ManagerProfile` | Hồ sơ quản lý | id | userId → User (UK) |

### 💳 Nhóm 3 — Gói tập & hội viên
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `MembershipPlan` | Gói tập (name, price, durationDays, tier, maxConcurrentClasses, isActive) | id | — |
| `MembershipSubscription` | Gói đã cấp cho hội viên (startDate, endDate, status, suspendedAt, remainingDays, cancelledAt, snapshot quota) | id | memberId → MemberProfile, planId → MembershipPlan |

### 🏟️ Nhóm 4 — Môn, phòng, lớp, lịch học
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `Sport` | Môn thể thao (name UK, areaTypes[]) | id | — |
| `Room` | Phòng tập (name UK, capacity, location, areaType) | id | — |
| `Class` | Lớp học (name, capacity, classType, areaType, sports[]) | id | — |
| `_ClassToSport` | Bảng nối N-N `Class` ⇄ `Sport` (A = Class.id, B = Sport.id) | (A,B) UK | A → Class, B → Sport |
| `ClassMember` | Phân công HLV cho lớp (isPrimary) | id | classId → Class, coachId → CoachProfile |
| `ClassSchedule` | Buổi học cụ thể (startTime, endTime, status) | id | classId → Class, roomId → Room |

### 📝 Nhóm 5 — Đặt lớp & điểm danh
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `Enrollment` | Hội viên đặt 1 buổi học (status BOOKED/CANCELLED/COMPLETED, bookedAt, cancelledAt) | id | memberId, classId, scheduleId |
| `Attendance` | Điểm danh 1 buổi (PRESENT/ABSENT/LATE/EXCUSED, note) | id | scheduleId → ClassSchedule, memberId → MemberProfile |
| `AttendanceManualCode` | Mã dự phòng nhập tay (code UK, expiresAt, attempts, revokedAt) | id | scheduleId → ClassSchedule, createdBy → User |
| `AttendanceManualCodeAttempt` | Log mọi lần nhập mã (success, createdAt) — rate-limit & audit | id | memberId, codeId (nullable) |
| `AttendancePenalty` | Hình phạt chuyên cần theo (member × class): thu hồi slot + chặn đặt lại | id | memberId, classId, decidedBy → User |

### 💰 Nhóm 6 — Thanh toán, hoá đơn, đối soát SePay
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `Payment` | Giao dịch (amount, method CASH/BANK_TRANSFER/SEPAY, status, transactionCode UK, gateway payload, snapshot gói, activationStatus) | id | memberId, subscriptionId?, planId?, createdById? |
| `Invoice` | Hoá đơn (invoiceNumber UK, subtotal, discount, total, status, snapshot memberName/planName/planTier) | id | memberId → MemberProfile, paymentId → Payment (UK, 1-1) |
| `SepayWebhookEvent` | Log webhook SePay (sepayId UK chống trùng, status PENDING/PROCESSED/DUPLICATE/LATE/MISMATCH/IGNORED, reason, payload) | id | paymentId? → Payment |
| `SepayBankTransaction` | Ledger biến động số dư ngân hàng (externalId UK, sepayId UK, apiTransactionId UK, paymentId UK) — idempotency | id | paymentId? → Payment (UK) |
| `NotificationOutbox` | Transactional outbox cho thông báo (status PENDING/SENDING/SENT/FAILED, attempts, lastError, availableAt) | id | — (userId là String, không FK) |

### 💬 Nhóm 7 — Chat
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `ChatMessage` | Tin nhắn (content, fileUrl, isRead, receiverId nullable = phòng chung) | id | senderId → User, receiverId? → User |
| `ChatAttachment` | Metadata file đính kèm (storedName, mimeType, size) quyết định ai được tải file | id | ownerId → User, receiverId? → User, messageId? → ChatMessage (UK) |

### 🏋️ Nhóm 8 — Tập luyện, đánh giá, thông báo
| Bảng | Vai trò | PK | FK chính |
|---|---|---|---|
| `TrainingPlan` | Kế hoạch tập (name, description, startDate, endDate, isActive) | id | memberId → MemberProfile, coachId → CoachProfile |
| `TrainingResult` | Kết quả/ghi chú theo buổi (date, metrics Json, coachNote) | id | planId → TrainingPlan |
| `CoachFeedback` | Đánh giá HLV (rating 1-5, comment, isAnonymous) | id | coachId, memberId, classId? |
| `Notification` | Thông báo in-app (type, title, body, reason, isRead, readAt, metadata Json) | id | userId → User |

<!-- @@END@@ -->