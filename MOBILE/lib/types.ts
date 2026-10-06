// TypeScript types derived from the API schema (operations.json snapshot 2026-09-12)

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type Role = 'MEMBER' | 'COACH' | 'RECEPTIONIST' | 'MANAGER' | 'ADMIN';
// Mobile chỉ phục vụ 2 role này — các role còn lại dùng bản web.
export const MOBILE_ROLES: readonly Role[] = ['MEMBER', 'COACH'];
export type TrainingLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
export type ScheduleStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type EnrollmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type ClassType = 'REGULAR' | 'PREMIUM';
export type AreaType = 'BADMINTON' | 'PICKLEBALL' | 'TENNIS' | 'GYM' | 'YOGA' | 'SWIMMING' | 'FOOTBALL' | 'BASKETBALL' | 'TABLE_TENNIS' | 'OTHER' | string;
export type MembershipTier = 'FREE' | 'MEMBERSHIP' | 'PREMIUM';


// ─── Auth / User ─────────────────────────────────────────────────────────────

export interface MemberProfile {
  id: string;
  trainingLevel?: TrainingLevel;
  fitnessGoal?: string;
  trainingPreference?: string;
}

export interface CoachProfile {
  id: string;
  specialization?: string;
  experienceYears?: number;
  bio?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  memberProfile?: MemberProfile | null;
  coachProfile?: CoachProfile | null;
  managerProfile?: null;
}

export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Facility (cơ sở) ────────────────────────────────────────────────────────
// BE bắt buộc header X-Facility-Id trên hầu hết route nghiệp vụ; id là chuỗi
// (vd. "legacy-main", "seed-fac-q1"), KHÔNG phải UUID.

export interface Facility {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  contactInfo?: string | null;
  timezone?: string | null;
  isActive: boolean;
}

// ─── Membership ──────────────────────────────────────────────────────────────

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: string; // decimal string from backend
  durationDays: number;
  tier: MembershipTier;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  memberId: string;
  planId: string;
  plan?: MembershipPlan;
  tier?: MembershipTier;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: string;
}

export interface MembershipStatus {
  effectiveTier: MembershipTier;
  activeSubscription?: Subscription | null;
  daysRemaining?: number;
}

export interface PendingMembershipRequest {
  planId: string;
  planName: string;
  tier: MembershipTier;
  price: string | number;
  durationDays: number;
  paymentMethod: PaymentMethod;
  requestedAt: string;
}

export interface CancelSubscriptionResult {
  subscriptionId: string;
  status: 'CANCELLED';
  daysLeft: number;
  refundAmount: number;
  willRefund: boolean;
  message: string;
}

// ─── Member Profile ──────────────────────────────────────────────────────────

export interface Member {
  id: string;
  user: User;
  trainingLevel?: TrainingLevel;
  fitnessGoal?: string;
  trainingPreference?: string;
  activeSubscription?: Subscription | null;
  subscriptions?: Subscription[];
}

// ─── Sport ───────────────────────────────────────────────────────────────────

export interface Sport {
  id: string;
  name: string;
  description?: string;
  areaTypes?: string[];
  isActive: boolean;
  _count?: { classes: number };
}

// ─── Room ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  location?: string;
  capacity: number;
  isActive: boolean;
}

// ─── Class ───────────────────────────────────────────────────────────────────

export interface ClassCoach {
  coachId: string;
  isPrimary: boolean;
  coach?: {
    id: string;
    user: Pick<User, 'id' | 'fullName' | 'email'>;
    specialization?: string;
    bio?: string;
  };
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  // BE đổi từ 1 môn (sportId/sport) sang nhiều môn (sports[]) — lớp có thể thuộc nhiều môn
  sports?: Sport[];
  capacity: number;
  classType: ClassType;
  isActive: boolean;
  coaches?: ClassCoach[];
  schedules?: ClassSchedule[];
  _count?: { enrollments: number };
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface ClassSchedule {
  id: string;
  classId: string;
  class?: Class;
  roomId: string;
  room?: Room;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  _count?: { enrollments: number };
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

export interface Enrollment {
  id: string;
  scheduleId: string;
  schedule?: ClassSchedule;
  memberId: string;
  member?: {
    id: string;
    user?: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  };
  status: EnrollmentStatus;
  bookedAt: string;
  createdAt: string;
}

// ─── Attendance (Flow 4) ─────────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface Attendance {
  id: string;
  scheduleId: string;
  schedule?: ClassSchedule;
  memberId: string;
  member?: {
    id: string;
    user: Pick<User, 'id' | 'fullName' | 'email'>;
  };
  status: AttendanceStatus;
  note?: string | null;
  markedAt: string;
  createdAt: string;
}

export interface GenerateQrResult {
  qrToken: string;
  expiresIn: number; // giây — QR JWT sống 600s
  manualCode: string; // mã dự phòng 6 ký tự cho member không quét được QR
  manualCodeExpiresIn: number; // giây — mã dự phòng sống ngắn hơn QR (90s)
}

export type AttendanceBucketStatus = 'OK' | 'WARN' | 'RELEASE';

export interface AttendanceBucket {
  classId: string;
  className: string;
  sampleSize: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  noShowCount: number;
  excusedCount: number;
  attendanceRate: number;
  status: AttendanceBucketStatus;
}

export type AttendancePenaltyStatus = 'PENDING' | 'APPLIED' | 'REVOKED' | 'EXPIRED';

export interface AttendancePenalty {
  id: string;
  classId: string;
  className: string;
  status: AttendancePenaltyStatus;
  reason: string;
  attendanceRate: number;
  sampleSize: number;
  releasedCount?: number;
  blockedUntil?: string | null;
  canAppeal: boolean;
  appealedAt?: string | null;
  appealReason?: string | null;
}

export interface AttendanceSummary {
  memberId: string;
  memberName?: string;
  thresholds: {
    minSample: number;
    warnBelow: number;
    releaseBelow: number;
    appealWindowHours: number;
  };
  buckets: AttendanceBucket[];
  penalties: AttendancePenalty[];
}

// ─── Training Plans (Flow 4) ──────────────────────────────────────────────────

export interface TrainingPlan {
  id: string;
  memberId: string;
  coachId: string;
  coach?: {
    id: string;
    user: Pick<User, 'id' | 'fullName'>;
  };
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  results?: TrainingResult[];
}

export interface TrainingResult {
  id: string;
  planId: string;
  date: string;
  metrics?: Record<string, unknown>;
  coachNote?: string;
  createdAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatContact {
  id: string;
  fullName: string;
  role: Role;
  email: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: Pick<User, 'id' | 'fullName' | 'role'>;
  receiver?: Pick<User, 'id' | 'fullName' | 'role'> | null;
}

export interface ChatConversation {
  user: ChatContact;
  latestMessage: ChatMessage | null;
  unreadCount: number;
}

// ─── Coach Feedback ────────────────────────────────────────────────────────────

export interface CoachFeedback {
  id: string;
  coachId: string;
  memberId: string;
  classId?: string | null;
  rating: number;
  comment?: string | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  member?: { user: Pick<User, 'fullName'> };
  coach?: { user: Pick<User, 'fullName' | 'email'> };
  class?: { id: string; name: string } | null;
}

export interface CoachFeedbackSummary {
  averageRating: number | null;
  totalFeedbacks: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'MEMBER_REGISTERED'
  | 'CHAT_MESSAGE'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'UPCOMING_CLASS'
  | 'SCHEDULE_CANCELLED'
  | 'SCHEDULE_UPDATED'
  | 'ENROLLMENT_CONFIRMED'
  | 'ENROLLMENT_CANCELLED'
  | 'TRAINING_PLAN_ASSIGNED'
  | 'NEW_CLASS'
  | 'COACH_CHANGED'
  | 'ATTENDANCE_WARNING'
  | 'ATTENDANCE_PENALTY'
  | 'ATTENDANCE_PENALTY_REVOKED'
  | 'SCHEDULE_ROOM_CHANGED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_REFUNDED'
  | 'GENERAL';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

// ─── Enrollment Quota ─────────────────────────────────────────────────────────

export interface ConcurrentClassQuotaEntry {
  classId: string;
  className: string;
  classType: ClassType;
  scheduleId: string;
  scheduleStartTime: string;
  futureBookedScheduleCount: number;
}

export interface ConcurrentClassQuota {
  hasActiveSubscription: boolean;
  tier: MembershipTier | null;
  limit: number;
  used: number;
  remaining: number;
  classes: ConcurrentClassQuotaEntry[];
}

// ─── Bulk / Whole-Course Enrollment ──────────────────────────────────────────

export type BulkEnrollStatus = 'ENROLLED' | 'ALREADY_BOOKED' | 'REACTIVATED';

export interface BulkEnrollSessionResult {
  scheduleId: string;
  status: BulkEnrollStatus;
  startTime?: string;
}

export interface WholeCourseEnrollmentResult {
  classId: string;
  className: string;
  enrolled: number;
  alreadyBooked: number;
  reactivated: number;
  totalSessions: number;
  results: BulkEnrollSessionResult[];
}

// ─── Course Plan ──────────────────────────────────────────────────────────────

export interface CoursePlanSlot {
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  roomId: string;
  roomName: string;
  sessionCount: number;
  firstSessionStart: string;
  lastSessionStart: string;
  sessionIds: string[];
}

export interface CourseTimeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface CoursePlanSession {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  weekday: number;
  weekdayLabel: string;
  timeLabel: string;
  status: ScheduleStatus;
  room: Room;
  bookedCount: number;
  remainingSlots: number;
  isFull: boolean;
  isBookable: boolean;
  canBook: boolean;
  myEnrollmentId: string | null;
  myEnrollmentStatus: EnrollmentStatus | null;
  conflictWith: {
    classId: string;
    className: string;
    scheduleId: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface CourseRegistrationBlocker {
  code: string;
  message: string;
  sessionId?: string;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  roomName?: string;
  details?: Record<string, unknown>;
}

export interface CourseRegistration {
  eligible: boolean;
  blockers: CourseRegistrationBlocker[];
  subscription: {
    tier: MembershipTier;
    endDate: string;
    planName: string | null;
  } | null;
  quota: ConcurrentClassQuota | null;
  penalty: {
    id: string;
    blockedUntil: string | null;
    attendanceRate: number;
    sampleSize: number;
  } | null;
  registeredSessions: number;
  remainingSessionsToRegister: number;
  isFullyRegistered: boolean;
}

export interface CoursePlan {
  course: {
    classId: string;
    className: string;
    description: string | null;
    classType: ClassType;
    areaType: AreaType;
    capacity: number;
    sports: Sport[];
    totalSessions: number;
    firstSessionStart: string;
    lastSessionStart: string;
    lastSessionEnd: string;
    weekdays: number[];
    weekdayLabels: string[];
    timeSlots: CourseTimeSlot[];
    rooms: Room[];
    slots: CoursePlanSlot[];
    availability: {
      minRemainingSlots: number;
      fullSessionCount: number;
      isFullyBookable: boolean;
    };
  } | null;
  sessions: CoursePlanSession[];
  registration: CourseRegistration | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

