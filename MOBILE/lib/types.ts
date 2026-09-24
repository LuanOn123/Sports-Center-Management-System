// TypeScript types derived from the API schema (operations.json snapshot 2026-09-12)

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type Role = 'MEMBER' | 'COACH' | 'STAFF' | 'MANAGER';
export type TrainingLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
export type ScheduleStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type EnrollmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type ClassType = 'REGULAR' | 'PREMIUM';
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

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
