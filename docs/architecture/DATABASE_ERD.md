# SCMS database ERD

Reviewed 1 November 2026 against the checked-in [Prisma schema](../../BE/prisma/schema.prisma). [Mermaid source](database-erd.mmd) · [Rendered SVG](../diagram-audit/exports/database-erd.svg) · [Repository audit](../diagram-audit/REPORT.md).

This is the logical PostgreSQL schema: **40 Prisma models + 1 implicit Class–Sport join table = 41 tables**, with **21 enums**. It is not an introspection of a deployed database and does not prove migrations have been applied. MongoDB identity documents are a separate store and are not fictional PostgreSQL tables.

All scalar attributes are retained. PK / FK / UK describe actual single-column constraints; nullable attributes are labelled. Dashed crow’s-foot relationships are non-identifying: ordinary foreign keys do not form the child primary key. The left cardinality expresses whether a child can omit its parent; the right cardinality reflects a unique FK or a collection. Composite uniqueness is listed below rather than incorrectly marking each component individually unique.

Identifiers are Prisma String columns, usually with UUID defaults. Identity projection IDs can originate in MongoDB; this is not a claim that every stored ID has a native PostgreSQL UUID type. Scalar identifiers without a declared Prisma relation are not drawn as foreign keys.

| Model | Schema lines | Composite unique constraints |
|---|---|---|
| User | 129–158 | — |
| RefreshToken | 160–170 | — |
| Facility | 176–205 | — |
| FacilityStaff | 207–221 | [userId, facilityId, role] |
| MemberProfile | 227–248 | — |
| CoachProfile | 250–265 | — |
| ManagerProfile | 267–273 | — |
| MembershipPlan | 279–296 | — |
| MembershipSubscription | 298–337 | — |
| Sport | 343–355 | — |
| Room | 357–375 | [facilityId, name] |
| Class | 381–415 | — |
| ClassMember | 418–432 | [classId, coachId] |
| ClassSchedule | 434–459 | — |
| Term | 465–486 | — |
| Enrollment | 492–519 | [memberId, scheduleId] |
| WaitlistEntry | 534–552 | — |
| Payment | 558–617 | — |
| SepayBankTransaction | 621–645 | — |
| NotificationOutbox | 649–666 | — |
| SepayWebhookEvent | 670–684 | — |
| Invoice | 686–707 | — |
| ChatMessage | 713–730 | — |
| ChatAttachment | 735–752 | — |
| Attendance | 765–779 | [scheduleId, memberId] |
| AttendanceManualCode | 785–802 | — |
| AttendanceManualCodeAttempt | 805–815 | — |
| AttendancePenalty | 827–853 | — |
| CoachFeedback | 862–881 | [coachId, memberId, classId] |
| Notification | 927–943 | — |
| RoomCapability | 945–952 | [roomId, key] |
| SubjectRequirement | 953–960 | [sportId, key] |
| CoachSpecialization | 961–968 | [coachId, sportId] |
| Slot | 969–977 | — |
| SchedulePattern | 978–995 | — |
| CoachChangeRequest | 996–1019 | — |
| LeaveRequest | 1021–1038 | — |
| Issue | 1039–1055 | — |
| AuditLog | 1056–1069 | — |
| FacilityVisit | 1087–1100 | — |

## Database-only constraints and interpretive limits

Partial indexes in migrations enforce active facility staff assignments, one primary Coach, one WAITING member/schedule entry and one ACTIVE subscription. They cannot be reconstructed merely from scalar field uniqueness. See `BE/prisma/migrations/20261008000100_manager_assignment_constraints`, `20261009000000_waitlist_per_schedule`, `20261029000000_business_rule_hardening` and `20261029120000_class_one_primary_coach`. Their deployed presence was not checked.

`_ClassToSport.A` references Class and `.B` references Sport. The pair is unique; neither column is individually unique. The ERD shows the implied join table rather than adding an invented application model.

Class is a course; ClassSchedule is a concrete session; Slot is a reusable time-of-day definition; SchedulePattern generates sessions; Term supplies course and registration dates; Enrollment is one member/session row. Bulk registration creates or reactivates several Enrollment rows atomically.

MembershipSubscription.facilityId is purchase origin, not a restriction on global entitlement. Enrollment.subscriptionId identifies its funding source; termMembershipGrant is an eligibility snapshot, not a new subscription or an expiry-date extension. Payment money state, activation state and actual refund confirmation remain distinct.

The full ERD is intentionally a vector appendix/overview. Use SVG zoom or a large page rather than reducing all attributes to an unreadable A4 image.

## Enums

- UserRole: ADMIN, MANAGER, COACH, RECEPTIONIST, MEMBER
- Gender: MALE, FEMALE, OTHER
- MemberTier: FREE, MEMBERSHIP, PREMIUM
- MembershipStatus: ACTIVE, EXPIRED, CANCELLED, SUSPENDED, SCHEDULED
- TrainingLevel: BEGINNER, INTERMEDIATE, ADVANCED
- ClassType: REGULAR, PREMIUM
- AreaType: POOL, INDOOR, OUTDOOR
- ScheduleStatus: SCHEDULED, CANCELLED, COMPLETED
- TermStatus: PLANNING, OPEN_REGISTRATION, IN_PROGRESS, CLOSED
- EnrollmentStatus: BOOKED, CANCELLED, COMPLETED
- PaymentMethod: CASH, BANK_TRANSFER, SEPAY
- SepayWebhookStatus: PENDING, PROCESSED, DUPLICATE, LATE, MISMATCH, IGNORED
- PaymentStatus: PENDING, SUCCESS, FAILED, REFUNDED
- InvoiceStatus: ISSUED, CANCELLED
- PaymentActivationStatus: ACTIVATED, REQUIRES_REVIEW
- OutboxStatus: PENDING, SENDING, SENT, FAILED
- WaitlistStatus: WAITING, PROMOTED, CANCELLED
- AttendanceStatus: PRESENT, ABSENT, LATE, EXCUSED
- AttendancePenaltyStatus: PENDING, APPLIED, REVOKED, EXPIRED
- NotificationType: COACH_CHANGE_REQUESTED, COACH_CHANGE_APPROVED, COACH_CHANGE_REJECTED, MEMBER_REGISTERED, CHAT_MESSAGE, SUBSCRIPTION_EXPIRING, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_CANCELLED, UPCOMING_CLASS, SCHEDULE_CANCELLED, SCHEDULE_UPDATED, ENROLLMENT_CONFIRMED, ENROLLMENT_CANCELLED, TRAINING_PLAN_ASSIGNED, NEW_CLASS, COACH_CHANGED, ATTENDANCE_WARNING, ATTENDANCE_PENALTY, ATTENDANCE_PENALTY_REVOKED, SCHEDULE_ROOM_CHANGED, PAYMENT_SUCCESS, PAYMENT_REFUNDED, PAYMENT_FAILED, LEAVE_REQUEST_SUBMITTED, LEAVE_REQUEST_APPROVED, LEAVE_REQUEST_REJECTED, GENERAL
- FacilityVisitMethod: QR, RECEPTION

Regenerate with `node docs/diagram-audit/update-erd.mjs`, then run the render and layout checks in the audit report.
