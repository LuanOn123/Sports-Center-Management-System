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
  sportId: string;
  sport?: Sport;
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
  markedAt: string;
  createdAt: string;
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

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
