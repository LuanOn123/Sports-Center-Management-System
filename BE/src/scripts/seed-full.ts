/**
 * Seed dữ liệu test ĐẦY ĐỦ cho kiến trúc hiện tại (MongoDB giữ identity + PostgreSQL projection).
 *
 * An toàn khi chạy trên database dùng chung:
 * - CHỈ THÊM: mọi bản ghi dùng ID cố định tiền tố `seed-` hoặc email `@seed.scms.test`,
 *   upsert với `update: {}` => chạy lại không tạo trùng, không ghi đè dữ liệu đã có.
 * - KHÔNG xoá, KHÔNG sửa bản ghi ngoài seed (gói FREE hệ thống chỉ được dùng lại, không sửa).
 * - Lịch học sinh theo cửa sổ [hôm nay − 21 ngày, hôm nay + 28 ngày] với ID theo ngày,
 *   nên chạy lại vào ngày khác sẽ bổ sung các buổi mới mà không đụng buổi cũ.
 *
 * Chạy:  npm run db:seed:full
 * Mật khẩu mọi tài khoản seed: Seed@123
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { configureDns } from "../config/dns.js";
import { prisma } from "../config/prisma.js";
import { User } from "../models/User.js";
import { MemberProfile } from "../models/MemberProfile.js";
import { CoachProfile } from "../models/CoachProfile.js";
import { ManagerProfile } from "../models/ManagerProfile.js";
import { synchronizeUserProjection } from "../modules/users/user-projection.service.js";
import { ATTENDANCE } from "../config/attendance.js";

const PASSWORD = "Seed@123";
const DOMAIN = "seed.scms.test";
const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;
const PAST_DAYS = 21;
const FUTURE_DAYS = 28;

type Role = "ADMIN" | "MANAGER" | "COACH" | "RECEPTIONIST" | "MEMBER";

// ─── Thời gian theo giờ Việt Nam ───────────────────────────────────────────
const now = new Date();
const vnToday = new Date(now.getTime() + VN_OFFSET);
const todayUtcMidnight = Date.UTC(vnToday.getUTCFullYear(), vnToday.getUTCMonth(), vnToday.getUTCDate());

/** 00:00 giờ VN của ngày (hôm nay + offset), biểu diễn bằng instant UTC. */
const vnDayStart = (offset: number) => new Date(todayUtcMidnight + offset * DAY - VN_OFFSET);
/** Thứ ISO (1 = Thứ 2 … 7 = Chủ nhật) của ngày VN (hôm nay + offset). */
const vnWeekday = (offset: number) => new Date(todayUtcMidnight + offset * DAY).getUTCDay() || 7;
const vnDateKey = (offset: number) => new Date(todayUtcMidnight + offset * DAY).toISOString().slice(0, 10).replace(/-/g, "");
const atMinute = (offset: number, minute: number) => new Date(vnDayStart(offset).getTime() + minute * 60000);
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY);

// ─── Định nghĩa dữ liệu ───────────────────────────────────────────────────
const FACILITIES = [
  { id: "seed-fac-q1", code: "SEED_Q1", name: "SCMS Seed – Quận 1", address: "12 Lê Lợi, Bến Nghé, Quận 1, TP.HCM", contactInfo: "028 3800 0001" },
  { id: "seed-fac-q7", code: "SEED_Q7", name: "SCMS Seed – Quận 7", address: "88 Nguyễn Thị Thập, Tân Phú, Quận 7, TP.HCM", contactInfo: "028 3800 0007" },
] as const;

type SeedUser = {
  key: string;
  role: Role;
  fullName: string;
  gender?: "MALE" | "FEMALE";
  isActive?: boolean;
  facilities?: string[];
  coach?: { specialization: string; experienceYears: number; bio: string };
  member?: { fitnessGoal: string; trainingLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"; trainingPreference: string };
};

const USERS: SeedUser[] = [
  { key: "admin", role: "ADMIN", fullName: "Quản trị hệ thống", gender: "MALE" },
  { key: "manager.q1", role: "MANAGER", fullName: "Trần Quốc Minh", gender: "MALE", facilities: ["seed-fac-q1"] },
  { key: "manager.q7", role: "MANAGER", fullName: "Lê Thu Hà", gender: "FEMALE", facilities: ["seed-fac-q7"] },
  { key: "reception.q1", role: "RECEPTIONIST", fullName: "Nguyễn Thị Lan", gender: "FEMALE", facilities: ["seed-fac-q1"] },
  { key: "reception.q7", role: "RECEPTIONIST", fullName: "Phạm Văn Hùng", gender: "MALE", facilities: ["seed-fac-q7"] },
  {
    key: "coach.yoga", role: "COACH", fullName: "Võ Ngọc Ánh", gender: "FEMALE", facilities: ["seed-fac-q1"],
    coach: { specialization: "Yoga Flow", experienceYears: 6, bio: "HLV Yoga 6 năm, chuyên Vinyasa và phục hồi." },
  },
  {
    key: "coach.hiit", role: "COACH", fullName: "Đặng Tuấn Kiệt", gender: "MALE", facilities: ["seed-fac-q1", "seed-fac-q7"],
    coach: { specialization: "HIIT Cardio, Boxing cơ bản", experienceYears: 8, bio: "HLV HIIT/Boxing, dạy ở cả Quận 1 và Quận 7." },
  },
  {
    key: "coach.swim", role: "COACH", fullName: "Huỳnh Thanh Tâm", gender: "MALE", facilities: ["seed-fac-q7"],
    coach: { specialization: "Bơi tự do", experienceYears: 10, bio: "Cựu VĐV bơi, có chứng chỉ cứu hộ." },
  },
  {
    key: "coach.badminton", role: "COACH", fullName: "Bùi Khánh Linh", gender: "FEMALE", facilities: ["seed-fac-q1"],
    coach: { specialization: "Cầu lông đôi, Yoga Flow", experienceYears: 4, bio: "HLV cầu lông, có thể dạy thay lớp Yoga." },
  },
  {
    key: "coach.demo", role: "COACH", fullName: "Lý Gia Bảo", gender: "MALE", facilities: ["seed-fac-q1"],
    coach: { specialization: "Yoga Flow", experienceYears: 3, bio: "HLV phụ trách lớp demo điểm danh QR." },
  },
  {
    key: "coach.nospec", role: "COACH", fullName: "Mai Văn Phúc", gender: "MALE", facilities: ["seed-fac-q1"],
    coach: { specialization: "Chưa có chuyên môn", experienceYears: 1, bio: "HLV mới — dùng để test COACH_SPECIALIZATION_REQUIRED." },
  },
  {
    key: "member.premium", role: "MEMBER", fullName: "Nguyễn Hoàng Nam", gender: "MALE",
    member: { fitnessGoal: "Tăng sức bền", trainingLevel: "ADVANCED", trainingPreference: "Sáng sớm và buổi tối" },
  },
  {
    key: "member.membership", role: "MEMBER", fullName: "Trương Mỹ Linh", gender: "FEMALE",
    member: { fitnessGoal: "Giảm mỡ", trainingLevel: "INTERMEDIATE", trainingPreference: "Buổi tối" },
  },
  {
    key: "member.expiring", role: "MEMBER", fullName: "Phan Đức Huy", gender: "MALE",
    member: { fitnessGoal: "Duy trì thể lực", trainingLevel: "BEGINNER", trainingPreference: "Cuối tuần" },
  },
  {
    key: "member.free", role: "MEMBER", fullName: "Đỗ Thị Hồng", gender: "FEMALE",
    member: { fitnessGoal: "Tìm hiểu các lớp", trainingLevel: "BEGINNER", trainingPreference: "Linh hoạt" },
  },
  {
    key: "member.expired", role: "MEMBER", fullName: "Hồ Minh Khang", gender: "MALE",
    member: { fitnessGoal: "Quay lại tập luyện", trainingLevel: "INTERMEDIATE", trainingPreference: "Buổi trưa" },
  },
  {
    key: "member.pending", role: "MEMBER", fullName: "Vũ Thanh Trúc", gender: "FEMALE",
    member: { fitnessGoal: "Tăng cơ", trainingLevel: "BEGINNER", trainingPreference: "Buổi tối" },
  },
  {
    key: "member.refunded", role: "MEMBER", fullName: "Cao Văn Lộc", gender: "MALE",
    member: { fitnessGoal: "Giảm cân", trainingLevel: "BEGINNER", trainingPreference: "Buổi sáng" },
  },
  {
    key: "member.lowatt", role: "MEMBER", fullName: "Lâm Bảo Ngọc", gender: "FEMALE",
    member: { fitnessGoal: "Dẻo dai", trainingLevel: "BEGINNER", trainingPreference: "Sáng sớm" },
  },
  {
    key: "member.q7", role: "MEMBER", fullName: "Tạ Quang Vinh", gender: "MALE",
    member: { fitnessGoal: "Bơi tốt hơn", trainingLevel: "INTERMEDIATE", trainingPreference: "Buổi tối" },
  },
  {
    key: "member.locked", role: "MEMBER", fullName: "Kiều Anh Thư", gender: "FEMALE", isActive: false,
    member: { fitnessGoal: "—", trainingLevel: "BEGINNER", trainingPreference: "—" },
  },
];

const SPORTS = [
  { id: "seed-sport-yoga", name: "Yoga Flow", description: "Yoga Vinyasa nhịp nhàng.", areaTypes: ["INDOOR"], requirements: { yoga_mat: 10 } },
  { id: "seed-sport-hiit", name: "HIIT Cardio", description: "Cường độ cao ngắt quãng.", areaTypes: ["INDOOR"], requirements: { dumbbell_pair: 10, sound_system: 1 } },
  { id: "seed-sport-swim", name: "Bơi tự do", description: "Kỹ thuật bơi tự do.", areaTypes: ["POOL"], requirements: { lifeguard: 1, lane: 4 } },
  { id: "seed-sport-badminton", name: "Cầu lông đôi", description: "Cầu lông đánh đôi.", areaTypes: ["INDOOR"], requirements: { court: 2, net: 2 } },
  { id: "seed-sport-boxing", name: "Boxing cơ bản", description: "Boxing kỹ thuật nền tảng.", areaTypes: ["INDOOR"], requirements: { punching_bag: 8, gloves_pair: 10 } },
] as const;

const SPECIALIZATIONS: Record<string, string[]> = {
  "coach.yoga": ["seed-sport-yoga"],
  "coach.hiit": ["seed-sport-hiit", "seed-sport-boxing"],
  "coach.swim": ["seed-sport-swim"],
  "coach.badminton": ["seed-sport-badminton", "seed-sport-yoga"],
  "coach.demo": ["seed-sport-yoga"],
  "coach.nospec": [],
};

const ROOMS = [
  { id: "seed-room-q1-yoga", facilityId: "seed-fac-q1", name: "Q1 – Studio Yoga", capacity: 20, areaType: "INDOOR", location: "Tầng 2", capabilities: { yoga_mat: 20, sound_system: 1 } },
  { id: "seed-room-q1-functional", facilityId: "seed-fac-q1", name: "Q1 – Phòng Functional", capacity: 20, areaType: "INDOOR", location: "Tầng 3", capabilities: { dumbbell_pair: 12, sound_system: 1, punching_bag: 10, gloves_pair: 15 } },
  { id: "seed-room-q1-badminton", facilityId: "seed-fac-q1", name: "Q1 – Sân cầu lông", capacity: 12, areaType: "INDOOR", location: "Tầng 1", capabilities: { court: 3, net: 3 } },
  { id: "seed-room-q1-multi", facilityId: "seed-fac-q1", name: "Q1 – Phòng đa năng", capacity: 25, areaType: "INDOOR", location: "Tầng 4", capabilities: { yoga_mat: 25, sound_system: 1 } },
  { id: "seed-room-q1-small", facilityId: "seed-fac-q1", name: "Q1 – Phòng nhỏ (8 chỗ)", capacity: 8, areaType: "INDOOR", location: "Tầng 2", capabilities: { yoga_mat: 8 } },
  { id: "seed-room-q1-maintenance", facilityId: "seed-fac-q1", name: "Q1 – Phòng đang bảo trì", capacity: 15, areaType: "INDOOR", location: "Tầng 5", capabilities: {}, isActive: false },
  { id: "seed-room-q7-pool", facilityId: "seed-fac-q7", name: "Q7 – Hồ bơi", capacity: 25, areaType: "POOL", location: "Khu ngoài trời có mái", capabilities: { lifeguard: 2, lane: 6 } },
  { id: "seed-room-q7-hiit", facilityId: "seed-fac-q7", name: "Q7 – Phòng HIIT", capacity: 18, areaType: "INDOOR", location: "Tầng 1", capabilities: { dumbbell_pair: 10, sound_system: 1 } },
] as const;

const SLOTS = [
  { key: "morning", name: "Sáng 06:00–07:00", startMinute: 360, endMinute: 420 },
  { key: "noon", name: "Trưa 12:00–13:00", startMinute: 720, endMinute: 780 },
  { key: "evening1", name: "Tối 18:00–19:00", startMinute: 1080, endMinute: 1140 },
  { key: "evening2", name: "Tối 19:30–20:30", startMinute: 1170, endMinute: 1230 },
] as const;
type SlotKey = (typeof SLOTS)[number]["key"];

type SeedClass = {
  key: string;
  facilityId: string;
  name: string;
  description: string;
  sports: string[];
  capacity: number;
  classType: "REGULAR" | "PREMIUM";
  areaType: "INDOOR" | "POOL";
  roomId: string;
  coach: string;
  weekdays: number[];
  slot: SlotKey;
};

const CLASSES: SeedClass[] = [
  { key: "yoga-morning", facilityId: "seed-fac-q1", name: "Yoga Flow buổi sáng", description: "Lớp Yoga sáng T2/T4/T6.", sports: ["seed-sport-yoga"], capacity: 15, classType: "REGULAR", areaType: "INDOOR", roomId: "seed-room-q1-yoga", coach: "coach.yoga", weekdays: [1, 3, 5], slot: "morning" },
  { key: "hiit-evening", facilityId: "seed-fac-q1", name: "HIIT Cardio buổi tối", description: "HIIT T3/T5.", sports: ["seed-sport-hiit"], capacity: 15, classType: "REGULAR", areaType: "INDOOR", roomId: "seed-room-q1-functional", coach: "coach.hiit", weekdays: [2, 4], slot: "evening1" },
  { key: "boxing-premium", facilityId: "seed-fac-q1", name: "Boxing Premium", description: "Lớp PREMIUM — chỉ gói PREMIUM được đăng ký.", sports: ["seed-sport-boxing"], capacity: 10, classType: "PREMIUM", areaType: "INDOOR", roomId: "seed-room-q1-functional", coach: "coach.hiit", weekdays: [6], slot: "evening1" },
  { key: "badminton-weekend", facilityId: "seed-fac-q1", name: "Cầu lông cuối tuần", description: "Cầu lông đôi T7/CN.", sports: ["seed-sport-badminton"], capacity: 12, classType: "REGULAR", areaType: "INDOOR", roomId: "seed-room-q1-badminton", coach: "coach.badminton", weekdays: [6, 7], slot: "evening2" },
  { key: "yoga-full", facilityId: "seed-fac-q1", name: "Yoga nhóm nhỏ (đã đầy)", description: "Sức chứa 2 — đã đủ chỗ, dùng test CLASS_FULL.", sports: ["seed-sport-yoga"], capacity: 2, classType: "REGULAR", areaType: "INDOOR", roomId: "seed-room-q1-yoga", coach: "coach.badminton", weekdays: [2, 4], slot: "noon" },
  { key: "swim-q7", facilityId: "seed-fac-q7", name: "Bơi tự do Quận 7", description: "Bơi T2/T4/T6.", sports: ["seed-sport-swim"], capacity: 20, classType: "REGULAR", areaType: "POOL", roomId: "seed-room-q7-pool", coach: "coach.swim", weekdays: [1, 3, 5], slot: "evening1" },
  { key: "hiit-q7", facilityId: "seed-fac-q7", name: "HIIT Quận 7", description: "HIIT T2/T4 — HLV dạy chung với Quận 1.", sports: ["seed-sport-hiit"], capacity: 15, classType: "REGULAR", areaType: "INDOOR", roomId: "seed-room-q7-hiit", coach: "coach.hiit", weekdays: [1, 3], slot: "evening2" },
];

/** Lớp demo điểm danh: 1 buổi đang diễn ra (mở QR) + 1 buổi sau 3 giờ (chưa tới giờ). */
const DEMO_CLASS = {
  key: "demo-qr", facilityId: "seed-fac-q1", name: "Lớp demo điểm danh QR", description: "Có buổi ĐANG diễn ra để test QR / mã dự phòng.",
  sports: ["seed-sport-yoga"], capacity: 20, classType: "REGULAR" as const, areaType: "INDOOR" as const, roomId: "seed-room-q1-multi", coach: "coach.demo",
};

const PLANS = [
  { id: "seed-plan-monthly", name: "Seed – Gói tháng", description: "MEMBERSHIP 30 ngày, tối đa 3 lớp song song.", price: 300000, durationDays: 30, tier: "MEMBERSHIP", maxConcurrentClasses: 3, isActive: true },
  { id: "seed-plan-quarterly", name: "Seed – Gói quý", description: "MEMBERSHIP 90 ngày, tối đa 3 lớp song song.", price: 800000, durationDays: 90, tier: "MEMBERSHIP", maxConcurrentClasses: 3, isActive: true },
  { id: "seed-plan-premium", name: "Seed – Premium quý", description: "PREMIUM 90 ngày, tối đa 6 lớp, học được lớp PREMIUM.", price: 1500000, durationDays: 90, tier: "PREMIUM", maxConcurrentClasses: 6, isActive: true },
  { id: "seed-plan-retired", name: "Seed – Gói ngừng bán", description: "Gói đã ngừng bán (isActive = false).", price: 250000, durationDays: 30, tier: "MEMBERSHIP", maxConcurrentClasses: 3, isActive: false },
] as const;

/** Lớp mà từng member đăng ký toàn khoá. */
const ENROLLMENTS: Record<string, string[]> = {
  "member.premium": ["yoga-morning", "hiit-evening", "boxing-premium", "yoga-full", "demo-qr"],
  "member.membership": ["yoga-morning", "hiit-evening", "badminton-weekend"],
  "member.lowatt": ["yoga-morning", "yoga-full", "demo-qr"],
  "member.q7": ["swim-q7", "hiit-q7", "demo-qr"],
};

// ─── Tiện ích ─────────────────────────────────────────────────────────────
const ids: Record<string, string> = {}; // key -> Mongo/PG user id
const memberIds: Record<string, string> = {}; // key -> MemberProfile id
const coachIds: Record<string, string> = {}; // key -> CoachProfile id
const count: Record<string, number> = {};
const bump = (name: string, created = true) => {
  if (created) count[name] = (count[name] ?? 0) + 1;
};
const email = (key: string) => `${key}@${DOMAIN}`;

async function ensureCreated<T>(name: string, exists: () => Promise<unknown>, create: () => Promise<T>) {
  if (await exists()) return false;
  await create();
  bump(name);
  return true;
}

// ─── 1. Identity (MongoDB) + projection (PostgreSQL) ───────────────────────
async function seedUsers() {
  const hashed = await bcrypt.hash(PASSWORD, 12);
  let phoneSeq = 1;
  for (const u of USERS) {
    const phone = `0388${String(phoneSeq++).padStart(6, "0")}`;
    let user = await User.findOne({ email: email(u.key) });
    if (!user) {
      const phoneTaken = await User.exists({ phone });
      user = await User.create({
        email: email(u.key),
        password: hashed,
        fullName: u.fullName,
        phone: phoneTaken ? undefined : phone,
        gender: u.gender ?? null,
        dateOfBirth: new Date(Date.UTC(1990 + (phoneSeq % 12), phoneSeq % 12, 1 + (phoneSeq % 27))),
        role: u.role,
        isActive: u.isActive ?? true,
      });
      bump("users");
    }
    const userId = user._id.toString();
    ids[u.key] = userId;

    if (u.role === "MEMBER" && !(await MemberProfile.exists({ userId })))
      await MemberProfile.create({ userId, ...u.member });
    if (u.role === "COACH" && !(await CoachProfile.exists({ userId })))
      await CoachProfile.create({ userId, ...u.coach });
    if (u.role === "MANAGER" && !(await ManagerProfile.exists({ userId })))
      await ManagerProfile.create({ userId });

    await synchronizeUserProjection(userId);

    if (u.role === "MEMBER") {
      memberIds[u.key] = (await prisma.memberProfile.findUniqueOrThrow({ where: { userId } })).id;
    }
    if (u.role === "COACH") {
      const coach = await prisma.coachProfile.findUniqueOrThrow({ where: { userId } });
      coachIds[u.key] = coach.id;
      if (!coach.specialization && u.coach)
        await prisma.coachProfile.update({ where: { id: coach.id }, data: u.coach });
    }
  }
}

// ─── 2. Cơ sở + phân công nhân sự ─────────────────────────────────────────
async function seedFacilities() {
  for (const f of FACILITIES) {
    await ensureCreated("facilities", () => prisma.facility.findUnique({ where: { id: f.id } }), () =>
      prisma.facility.create({ data: { ...f, timezone: "Asia/Ho_Chi_Minh" } }),
    );
  }
  for (const u of USERS) {
    for (const facilityId of u.facilities ?? []) {
      const where = { userId_facilityId_role: { userId: ids[u.key], facilityId, role: u.role } };
      await ensureCreated("facilityStaff", () => prisma.facilityStaff.findUnique({ where }), () =>
        prisma.facilityStaff.create({ data: { userId: ids[u.key], facilityId, role: u.role } }),
      );
    }
  }
}

// ─── 3. Môn học, phòng, chuyên môn, khung giờ, gói tập ────────────────────
async function seedCatalog() {
  for (const s of SPORTS) {
    await ensureCreated("sports", () => prisma.sport.findUnique({ where: { id: s.id } }), () =>
      prisma.sport.create({ data: { id: s.id, name: s.name, description: s.description, areaTypes: [...s.areaTypes] as any } }),
    );
    for (const [key, minimum] of Object.entries(s.requirements)) {
      const where = { sportId_key: { sportId: s.id, key } };
      await ensureCreated("subjectRequirements", () => prisma.subjectRequirement.findUnique({ where }), () =>
        prisma.subjectRequirement.create({ data: { sportId: s.id, key, minimum } }),
      );
    }
  }

  for (const r of ROOMS) {
    await ensureCreated("rooms", () => prisma.room.findUnique({ where: { id: r.id } }), () =>
      prisma.room.create({
        data: {
          id: r.id, facilityId: r.facilityId, name: r.name, capacity: r.capacity,
          areaType: r.areaType as any, location: r.location, isActive: "isActive" in r ? r.isActive : true,
        },
      }),
    );
    for (const [key, quantity] of Object.entries(r.capabilities)) {
      const where = { roomId_key: { roomId: r.id, key } };
      await ensureCreated("roomCapabilities", () => prisma.roomCapability.findUnique({ where }), () =>
        prisma.roomCapability.create({ data: { roomId: r.id, key, quantity } }),
      );
    }
  }

  for (const [coachKey, sportIds] of Object.entries(SPECIALIZATIONS)) {
    for (const sportId of sportIds) {
      const where = { coachId_sportId: { coachId: coachIds[coachKey], sportId } };
      await ensureCreated("coachSpecializations", () => prisma.coachSpecialization.findUnique({ where }), () =>
        prisma.coachSpecialization.create({ data: { coachId: coachIds[coachKey], sportId } }),
      );
    }
  }

  for (const f of FACILITIES) {
    for (const s of SLOTS) {
      const id = `seed-slot-${f.code.toLowerCase()}-${s.key}`;
      await ensureCreated("slots", () => prisma.slot.findUnique({ where: { id } }), () =>
        prisma.slot.create({ data: { id, facilityId: f.id, name: s.name, startMinute: s.startMinute, endMinute: s.endMinute } }),
      );
    }
  }

  for (const p of PLANS) {
    await ensureCreated("plans", () => prisma.membershipPlan.findUnique({ where: { id: p.id } }), () =>
      prisma.membershipPlan.create({ data: { ...p, tier: p.tier as any } }),
    );
  }
}

// ─── 4. Lớp học + lịch ────────────────────────────────────────────────────
function snapshotOf(sportIds: string[]) {
  const result: Record<string, number> = {};
  for (const id of sportIds) {
    const sport = SPORTS.find((s) => s.id === id)!;
    for (const [key, min] of Object.entries(sport.requirements)) result[key] = Math.max(result[key] ?? 0, min);
  }
  return result;
}

const scheduleIdsByClass: Record<string, { id: string; startTime: Date; endTime: Date; status: string }[]> = {};

async function upsertClass(c: Omit<SeedClass, "weekdays" | "slot">) {
  const id = `seed-class-${c.key}`;
  await ensureCreated("classes", () => prisma.class.findUnique({ where: { id } }), () =>
    prisma.class.create({
      data: {
        id, facilityId: c.facilityId, name: c.name, description: c.description, capacity: c.capacity,
        classType: c.classType, areaType: c.areaType, requirementsSnapshot: snapshotOf(c.sports),
        sports: { connect: c.sports.map((sid) => ({ id: sid })) },
      },
    }),
  );
  const where = { classId_coachId: { classId: id, coachId: coachIds[c.coach] } };
  await ensureCreated("classCoaches", () => prisma.classMember.findUnique({ where }), () =>
    prisma.classMember.create({ data: { classId: id, coachId: coachIds[c.coach], isPrimary: true } }),
  );
  return id;
}

async function upsertSchedule(id: string, classId: string, roomId: string, startTime: Date, endTime: Date, status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
  const existing = await prisma.classSchedule.findUnique({ where: { id } });
  if (!existing) {
    await prisma.classSchedule.create({ data: { id, classId, roomId, startTime, endTime, status } });
    bump("schedules");
  }
  return existing ?? { id, startTime, endTime, status };
}

async function seedClasses() {
  for (const c of CLASSES) {
    const classId = await upsertClass(c);
    const slot = SLOTS.find((s) => s.key === c.slot)!;
    const list: (typeof scheduleIdsByClass)[string] = [];
    let cancelledOne = false;
    for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
      if (!c.weekdays.includes(vnWeekday(offset))) continue;
      const startTime = atMinute(offset, slot.startMinute);
      const endTime = atMinute(offset, slot.endMinute);
      let status: "SCHEDULED" | "COMPLETED" | "CANCELLED" = endTime < now ? "COMPLETED" : "SCHEDULED";
      // Một buổi HIIT tương lai bị huỷ để test hiển thị / notification SCHEDULE_CANCELLED.
      if (c.key === "hiit-evening" && offset >= 7 && !cancelledOne) {
        status = "CANCELLED";
        cancelledOne = true;
      }
      const row = await upsertSchedule(`seed-sch-${c.key}-${vnDateKey(offset)}`, classId, c.roomId, startTime, endTime, status);
      list.push({ id: row.id, startTime: row.startTime, endTime: row.endTime, status: row.status });
    }
    scheduleIdsByClass[c.key] = list;

    const patternId = `seed-pattern-${c.key}`;
    const facilityCode = FACILITIES.find((f) => f.id === c.facilityId)!.code.toLowerCase();
    await ensureCreated("schedulePatterns", () => prisma.schedulePattern.findUnique({ where: { id: patternId } }), () =>
      prisma.schedulePattern.create({
        data: {
          id: patternId, facilityId: c.facilityId, classId, roomId: c.roomId, weekdays: c.weekdays,
          slotId: `seed-slot-${facilityCode}-${c.slot}`, startDate: vnDayStart(-PAST_DAYS), endDate: vnDayStart(FUTURE_DAYS),
        },
      }),
    );
  }

  // Lớp demo QR: dùng lại buổi "đang diễn ra" nếu còn, tránh sinh buổi chồng giờ khi chạy lại.
  const demoClassId = await upsertClass(DEMO_CLASS);
  const live = await prisma.classSchedule.findFirst({
    where: { classId: demoClassId, status: "SCHEDULED", endTime: { gt: now } },
    orderBy: { startTime: "asc" },
  });
  const demo: (typeof scheduleIdsByClass)[string] = [];
  if (live && live.startTime <= now) {
    demo.push(live);
  } else {
    const start = new Date(Math.floor((now.getTime() - 10 * 60000) / 300000) * 300000);
    const stamp = start.toISOString().slice(0, 16).replace(/\D/g, "");
    demo.push(await upsertSchedule(`seed-sch-demo-qr-live-${stamp}`, demoClassId, DEMO_CLASS.roomId, start, new Date(start.getTime() + 60 * 60000), "SCHEDULED"));
  }
  const laterStart = new Date(demo[0].endTime.getTime() + 2 * 60 * 60000);
  const laterStamp = laterStart.toISOString().slice(0, 16).replace(/\D/g, "");
  const later = await prisma.classSchedule.findFirst({ where: { classId: demoClassId, startTime: { gt: demo[0].endTime } } });
  demo.push(later ?? (await upsertSchedule(`seed-sch-demo-qr-later-${laterStamp}`, demoClassId, DEMO_CLASS.roomId, laterStart, new Date(laterStart.getTime() + 60 * 60000), "SCHEDULED")));
  scheduleIdsByClass["demo-qr"] = demo;
}

// ─── 5. Gói tập, thanh toán, hoá đơn ──────────────────────────────────────
type SubSpec = {
  member: string;
  planId: string;
  startOffset: number;
  endOffset: number;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  payment?: { method: "CASH" | "BANK_TRANSFER" | "SEPAY"; refund?: { amount: number; offset: number } };
};

const SUBSCRIPTIONS: SubSpec[] = [
  { member: "member.premium", planId: "seed-plan-premium", startOffset: -10, endOffset: 80, status: "ACTIVE", payment: { method: "BANK_TRANSFER" } },
  { member: "member.membership", planId: "seed-plan-quarterly", startOffset: -20, endOffset: 70, status: "ACTIVE", payment: { method: "CASH" } },
  { member: "member.expiring", planId: "seed-plan-monthly", startOffset: -27, endOffset: 3, status: "ACTIVE", payment: { method: "SEPAY" } },
  { member: "member.lowatt", planId: "seed-plan-quarterly", startOffset: -25, endOffset: 65, status: "ACTIVE", payment: { method: "CASH" } },
  { member: "member.q7", planId: "seed-plan-quarterly", startOffset: -5, endOffset: 85, status: "ACTIVE", payment: { method: "BANK_TRANSFER" } },
  { member: "member.expired", planId: "seed-plan-monthly", startOffset: -60, endOffset: -30, status: "EXPIRED", payment: { method: "CASH" } },
  { member: "member.refunded", planId: "seed-plan-monthly", startOffset: -15, endOffset: 15, status: "CANCELLED", payment: { method: "BANK_TRANSFER", refund: { amount: 150000, offset: -5 } } },
];

const facilityOfMember = (key: string) => (key === "member.q7" ? "seed-fac-q7" : "seed-fac-q1");
const cashierOf = (facilityId: string) => (facilityId === "seed-fac-q7" ? "reception.q7" : "reception.q1");

async function seedSubscriptions() {
  const freePlan = await prisma.membershipPlan.findFirst({ where: { tier: "FREE", isActive: true }, orderBy: { createdAt: "asc" } });
  if (!freePlan) throw new Error("Không tìm thấy gói FREE đang hoạt động — chạy server/đăng ký 1 lần để hệ thống tự tạo.");

  let invoiceSeq = 0;
  for (const s of SUBSCRIPTIONS) {
    const plan = PLANS.find((p) => p.id === s.planId)!;
    const memberId = memberIds[s.member];
    const facilityId = facilityOfMember(s.member);
    const subId = `seed-sub-${s.member.replace("member.", "")}`;
    const startDate = vnDayStart(s.startOffset);
    await ensureCreated("subscriptions", () => prisma.membershipSubscription.findUnique({ where: { id: subId } }), () =>
      prisma.membershipSubscription.create({
        data: {
          id: subId, facilityId, memberId, planId: plan.id, tier: plan.tier as any, startDate,
          endDate: vnDayStart(s.endOffset), status: s.status, priceSnapshot: plan.price,
          maxConcurrentClassesSnapshot: plan.maxConcurrentClasses,
          cancelledAt: s.status === "CANCELLED" ? vnDayStart(s.payment?.refund?.offset ?? 0) : null,
        },
      }),
    );
    if (!s.payment) continue;
    invoiceSeq++;
    const paymentId = `seed-pay-${s.member.replace("member.", "")}`;
    const refund = s.payment.refund;
    await ensureCreated("payments", () => prisma.payment.findUnique({ where: { id: paymentId } }), async () => {
      await prisma.payment.create({
        data: {
          id: paymentId, facilityId, memberId, subscriptionId: subId, planId: plan.id, amount: plan.price,
          method: s.payment!.method, status: refund ? "REFUNDED" : "SUCCESS", paidAt: startDate,
          gateway: s.payment!.method === "SEPAY" ? "SEPAY" : null,
          transactionCode: s.payment!.method === "SEPAY" ? `SEED${String(invoiceSeq).padStart(6, "0")}` : null,
          note: s.payment!.method === "SEPAY" ? "Seed: thanh toán VietQR" : "Seed: thu tại quầy",
          createdById: s.payment!.method === "SEPAY" ? null : ids[cashierOf(facilityId)],
          planNameSnapshot: plan.name, planTierSnapshot: plan.tier as any, durationDaysSnapshot: plan.durationDays,
          maxConcurrentClassesSnapshot: plan.maxConcurrentClasses, activationStatus: "ACTIVATED",
          refundedAmount: refund?.amount ?? 0, refundedAt: refund ? vnDayStart(refund.offset) : null,
        },
      });
      await prisma.invoice.create({
        data: {
          id: `seed-inv-${s.member.replace("member.", "")}`, invoiceNumber: `INV-SEED-${String(invoiceSeq).padStart(4, "0")}`,
          memberId, paymentId, subtotal: plan.price, discount: 0, total: plan.price, status: "ISSUED", issuedAt: startDate,
          memberName: USERS.find((u) => u.key === s.member)!.fullName, planName: plan.name, planTier: plan.tier,
        },
      });
    });
  }

  // Gói FREE hệ thống: SUSPENDED khi member đang có gói trả phí ACTIVE (đúng luật applyPlanSwitchRules),
  // ACTIVE với các member còn lại (free, expired, pending, refunded, locked).
  for (const u of USERS.filter((x) => x.role === "MEMBER")) {
    const paidActive = SUBSCRIPTIONS.find((s) => s.member === u.key && s.status === "ACTIVE");
    const id = `seed-sub-free-${u.key.replace("member.", "")}`;
    const startDate = vnDayStart(-30);
    await ensureCreated("subscriptions", () => prisma.membershipSubscription.findUnique({ where: { id } }), () =>
      prisma.membershipSubscription.create({
        data: {
          id, facilityId: facilityOfMember(u.key), memberId: memberIds[u.key], planId: freePlan.id, tier: "FREE",
          startDate, endDate: new Date(startDate.getTime() + freePlan.durationDays * DAY),
          status: paidActive ? "SUSPENDED" : "ACTIVE", suspendedAt: paidActive ? vnDayStart(paidActive.startOffset) : null,
          priceSnapshot: freePlan.price, maxConcurrentClassesSnapshot: freePlan.maxConcurrentClasses,
        },
      }),
    );
  }

  // Đơn bán tại quầy chờ xác nhận (test POST /counter-orders/:id/confirm).
  const monthly = PLANS[0];
  await ensureCreated("payments", () => prisma.payment.findUnique({ where: { id: "seed-pay-counter-pending" } }), () =>
    prisma.payment.create({
      data: {
        id: "seed-pay-counter-pending", facilityId: "seed-fac-q1", memberId: memberIds["member.pending"], planId: monthly.id,
        amount: monthly.price, method: "CASH", status: "PENDING", note: "Seed: khách hẹn quay lại thanh toán tiền mặt",
        createdById: ids["reception.q1"], planNameSnapshot: monthly.name, planTierSnapshot: "MEMBERSHIP",
        durationDaysSnapshot: monthly.durationDays, maxConcurrentClassesSnapshot: monthly.maxConcurrentClasses,
      },
    }),
  );
  // Giao dịch online thất bại (không tính doanh thu).
  await ensureCreated("payments", () => prisma.payment.findUnique({ where: { id: "seed-pay-free-failed" } }), () =>
    prisma.payment.create({
      data: {
        id: "seed-pay-free-failed", facilityId: "seed-fac-q1", memberId: memberIds["member.free"], planId: monthly.id,
        amount: monthly.price, method: "SEPAY", status: "FAILED", gateway: "SEPAY", transactionCode: "SEEDFAIL01",
        note: "Seed: hết hạn chờ chuyển khoản", planNameSnapshot: monthly.name, planTierSnapshot: "MEMBERSHIP",
        durationDaysSnapshot: monthly.durationDays, maxConcurrentClassesSnapshot: monthly.maxConcurrentClasses,
      },
    }),
  );
}

// ─── 6. Đăng ký lớp + điểm danh ───────────────────────────────────────────
function attendanceFor(member: string, index: number): { status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; note?: string } {
  if (member === "member.lowatt") {
    // ~45% có mặt => rơi vào nhóm RELEASE (dưới 70%) để test cảnh báo / hình phạt chuyên cần.
    return index % 9 < 4 ? { status: "PRESENT" } : { status: "ABSENT", note: ATTENDANCE.SYSTEM_NO_SHOW_NOTE };
  }
  if (member === "member.premium" && index === 1) return { status: "LATE", note: "Đến trễ 10 phút" };
  if (member === "member.membership" && index === 2) return { status: "EXCUSED", note: "Seed: nghỉ ốm có giấy xác nhận" };
  return { status: "PRESENT" };
}

async function seedEnrollments() {
  for (const [member, classKeys] of Object.entries(ENROLLMENTS)) {
    const memberId = memberIds[member];
    for (const classKey of classKeys) {
      const classId = `seed-class-${classKey}`;
      let pastIndex = 0;
      for (const s of scheduleIdsByClass[classKey] ?? []) {
        const past = s.endTime < now;
        const status = s.status === "CANCELLED" ? "CANCELLED" : past ? "COMPLETED" : "BOOKED";
        const where = { memberId_scheduleId: { memberId, scheduleId: s.id } };
        await ensureCreated("enrollments", () => prisma.enrollment.findUnique({ where }), () =>
          prisma.enrollment.create({
            data: {
              memberId, classId, scheduleId: s.id, status, bookedAt: vnDayStart(-PAST_DAYS - 1),
              cancelledAt: status === "CANCELLED" ? vnDayStart(0) : null,
            },
          }),
        );
        if (!past || s.status !== "COMPLETED") continue;
        const att = attendanceFor(member, pastIndex++);
        const aw = { scheduleId_memberId: { scheduleId: s.id, memberId } };
        await ensureCreated("attendances", () => prisma.attendance.findUnique({ where: aw }), () =>
          prisma.attendance.create({ data: { scheduleId: s.id, memberId, status: att.status, note: att.note ?? null } }),
        );
      }
    }
  }
}

// ─── 7. Vận hành: nghỉ phép, ticket, audit, thông báo, feedback, chat ─────
const firstOffset = (weekdays: number[], minOffset: number) => {
  for (let o = minOffset; o < minOffset + 7; o++) if (weekdays.includes(vnWeekday(o))) return o;
  return minOffset;
};

async function seedOperations() {
  // Đơn PENDING: trùng 1 buổi Yoga sáng tương lai => duyệt phải gửi resolutions (REPLACE bằng coach.badminton).
  const yogaDay = firstOffset([1, 3, 5], 3);
  // Đơn APPROVED trong quá khứ: Chủ nhật — coach.hiit không có lịch ngày CN.
  const pastSunday = firstOffset([7], -14);
  const leaves = [
    { id: "seed-leave-pending", facilityId: "seed-fac-q1", coach: "coach.yoga", start: atMinute(yogaDay, 300), end: atMinute(yogaDay, 480), reason: "Seed: khám sức khoẻ định kỳ buổi sáng", status: "PENDING" },
    { id: "seed-leave-approved", facilityId: "seed-fac-q1", coach: "coach.hiit", start: atMinute(pastSunday, 0), end: atMinute(pastSunday, 1439), reason: "Seed: việc gia đình", status: "APPROVED", decidedBy: "manager.q1", decision: "Không ảnh hưởng lịch dạy" },
    { id: "seed-leave-rejected", facilityId: "seed-fac-q7", coach: "coach.swim", start: atMinute(firstOffset([1, 3, 5], 10), 1020), end: atMinute(firstOffset([1, 3, 5], 10), 1200), reason: "Seed: xin nghỉ đột xuất", status: "REJECTED", decidedBy: "manager.q7", decision: "Không có HLV bơi thay thế" },
  ];
  for (const l of leaves) {
    await ensureCreated("leaveRequests", () => prisma.leaveRequest.findUnique({ where: { id: l.id } }), () =>
      prisma.leaveRequest.create({
        data: {
          id: l.id, facilityId: l.facilityId, coachId: coachIds[l.coach], startTime: l.start, endTime: l.end, reason: l.reason,
          status: l.status, decisionReason: l.decision ?? null, decidedBy: l.decidedBy ? ids[l.decidedBy] : null,
          decidedAt: l.decidedBy ? vnDayStart(-1) : null,
        },
      }),
    );
  }

  const issues = [
    { id: "seed-issue-open", facilityId: "seed-fac-q1", member: "member.premium", title: "Máy lạnh Studio Yoga yếu", description: "Buổi sáng phòng Yoga rất nóng, mong trung tâm kiểm tra máy lạnh.", status: "OPEN" },
    { id: "seed-issue-progress", facilityId: "seed-fac-q1", member: "member.membership", title: "Thiếu tạ đơn 5kg", description: "Lớp HIIT tối thứ 3 thiếu tạ đơn 5kg cho học viên.", status: "IN_PROGRESS", response: "Đã đặt mua thêm, dự kiến có trong tuần.", by: "reception.q1" },
    { id: "seed-issue-resolved", facilityId: "seed-fac-q7", member: "member.q7", title: "Tủ đồ hồ bơi bị kẹt", description: "Tủ số 12 khu hồ bơi không mở được.", status: "RESOLVED", response: "Đã thay ổ khoá tủ số 12.", by: "manager.q7" },
    { id: "seed-issue-closed", facilityId: "seed-fac-q1", member: "member.expiring", title: "Hỏi về gia hạn gói", description: "Cho hỏi gia hạn gói tháng có được giữ lớp không?", status: "CLOSED", response: "Gia hạn trước ngày hết hạn sẽ giữ nguyên lớp.", by: "reception.q1" },
  ];
  for (const i of issues) {
    await ensureCreated("issues", () => prisma.issue.findUnique({ where: { id: i.id } }), () =>
      prisma.issue.create({
        data: {
          id: i.id, facilityId: i.facilityId, memberId: ids[i.member], title: i.title, description: i.description,
          status: i.status, response: i.response ?? null, resolvedBy: i.by ? ids[i.by] : null,
        },
      }),
    );
  }

  const cancelled = scheduleIdsByClass["hiit-evening"].find((s) => s.status === "CANCELLED");
  const audits = [
    { id: "seed-audit-plan", actor: "admin", entity: "MembershipPlan", entityId: "seed-plan-monthly", action: "update", before: { price: 280000 }, after: { price: 300000 }, reason: "Seed: điều chỉnh giá gói tháng" },
    { id: "seed-audit-schedule", actor: "manager.q1", entity: "ClassSchedule", entityId: cancelled?.id ?? null, action: "update", before: { status: "SCHEDULED" }, after: { status: "CANCELLED" }, reason: "Seed: HLV bận đột xuất, huỷ buổi" },
    { id: "seed-audit-payment", actor: "reception.q1", entity: "Payment", entityId: "seed-pay-membership", action: "update", before: { status: "PENDING" }, after: { status: "SUCCESS" }, reason: "Seed: xác nhận thu tiền mặt" },
    { id: "seed-audit-leave", actor: "manager.q1", entity: "LeaveRequest", entityId: "seed-leave-approved", action: "update", before: { status: "PENDING" }, after: { status: "APPROVED" }, reason: "Không ảnh hưởng lịch dạy" },
  ];
  for (const a of audits) {
    await ensureCreated("auditLogs", () => prisma.auditLog.findUnique({ where: { id: a.id } }), () =>
      prisma.auditLog.create({
        data: { id: a.id, facilityId: "seed-fac-q1", actorId: ids[a.actor], action: a.action, entity: a.entity, entityId: a.entityId, before: a.before, after: a.after, reason: a.reason },
      }),
    );
  }

  const notifications: { id: string; user: string; type: any; title: string; body: string; isRead?: boolean }[] = [
    ...USERS.filter((u) => u.role === "MEMBER").map((u) => ({
      id: `seed-noti-welcome-${u.key.replace("member.", "")}`, user: u.key, type: "MEMBER_REGISTERED",
      title: "Chào mừng đến với Trung tâm Thể thao!", body: `Xin chào ${u.fullName}! Tài khoản của bạn đã được tạo thành công.`, isRead: true,
    })),
    { id: "seed-noti-premium-paid", user: "member.premium", type: "PAYMENT_SUCCESS", title: "Thanh toán thành công", body: "Gói Seed – Premium quý đã được kích hoạt." },
    { id: "seed-noti-premium-enrolled", user: "member.premium", type: "ENROLLMENT_CONFIRMED", title: "Đặt lớp thành công", body: "Bạn đã đăng ký khoá Yoga Flow buổi sáng." },
    { id: "seed-noti-expiring", user: "member.expiring", type: "SUBSCRIPTION_EXPIRING", title: "Gói tập sắp hết hạn", body: "Gói Seed – Gói tháng của bạn sẽ hết hạn sau 3 ngày." },
    { id: "seed-noti-refunded", user: "member.refunded", type: "PAYMENT_REFUNDED", title: "Hoàn tiền thành công", body: "Trung tâm đã hoàn 150.000đ cho gói Seed – Gói tháng." },
    { id: "seed-noti-lowatt", user: "member.lowatt", type: "ATTENDANCE_WARNING", title: "Cảnh báo chuyên cần", body: "Tỉ lệ tham gia lớp Yoga Flow buổi sáng của bạn đang dưới 80%." },
    ...["member.premium", "member.membership"].map((m) => ({
      id: `seed-noti-cancel-${m.replace("member.", "")}`, user: m, type: "SCHEDULE_CANCELLED", title: "Buổi học bị huỷ",
      body: "Một buổi HIIT Cardio buổi tối đã bị huỷ, các buổi khác vẫn diễn ra bình thường.",
    })),
  ];
  for (const n of notifications) {
    await ensureCreated("notifications", () => prisma.notification.findUnique({ where: { id: n.id } }), () =>
      prisma.notification.create({
        data: { id: n.id, userId: ids[n.user], type: n.type, title: n.title, body: n.body, isRead: n.isRead ?? false, readAt: n.isRead ? now : null },
      }),
    );
  }

  const feedbacks = [
    { id: "seed-fb-1", coach: "coach.yoga", member: "member.premium", classKey: "yoga-morning", rating: 5, comment: "Cô hướng dẫn rất kỹ, lớp đông vui.", isAnonymous: false },
    { id: "seed-fb-2", coach: "coach.hiit", member: "member.membership", classKey: "hiit-evening", rating: 4, comment: "Bài tập hơi nặng với người mới.", isAnonymous: true },
    { id: "seed-fb-3", coach: "coach.swim", member: "member.q7", classKey: "swim-q7", rating: 5, comment: "Thầy sửa kỹ thuật thở rất hiệu quả.", isAnonymous: false },
  ];
  for (const f of feedbacks) {
    await ensureCreated("feedbacks", () => prisma.coachFeedback.findUnique({ where: { id: f.id } }), () =>
      prisma.coachFeedback.create({
        data: { id: f.id, coachId: coachIds[f.coach], memberId: memberIds[f.member], classId: `seed-class-${f.classKey}`, rating: f.rating, comment: f.comment, isAnonymous: f.isAnonymous },
      }),
    );
  }

  const chats = [
    { id: "seed-chat-1", from: "member.premium", to: "coach.yoga", content: "Chào cô, mai em đến sớm 10 phút được không ạ?", minutesAgo: 120, isRead: true },
    { id: "seed-chat-2", from: "coach.yoga", to: "member.premium", content: "Được em nhé, nhớ mang thêm khăn.", minutesAgo: 110, isRead: true },
    { id: "seed-chat-3", from: "member.premium", to: "coach.yoga", content: "Dạ em cảm ơn cô!", minutesAgo: 100, isRead: false },
    { id: "seed-chat-4", from: "member.q7", to: "coach.swim", content: "Thầy ơi tối nay hồ bơi có mở không ạ?", minutesAgo: 30, isRead: false },
  ];
  for (const c of chats) {
    await ensureCreated("chatMessages", () => prisma.chatMessage.findUnique({ where: { id: c.id } }), () =>
      prisma.chatMessage.create({
        data: { id: c.id, senderId: ids[c.from], receiverId: ids[c.to], content: c.content, isRead: c.isRead, createdAt: new Date(now.getTime() - c.minutesAgo * 60000) },
      }),
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  configureDns();
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Seeding SCMS test data (chỉ thêm, chạy lại an toàn)…");

  await seedUsers();
  console.log("  ✓ users (MongoDB + PostgreSQL projection)");
  await seedFacilities();
  console.log("  ✓ facilities + staff assignments");
  await seedCatalog();
  console.log("  ✓ sports, requirements, rooms, capabilities, specializations, slots, plans");
  await seedClasses();
  console.log("  ✓ classes, schedules, patterns");
  await seedSubscriptions();
  console.log("  ✓ subscriptions, payments, invoices");
  await seedEnrollments();
  console.log("  ✓ enrollments, attendance");
  await seedOperations();
  console.log("  ✓ leave requests, issues, audit logs, notifications, feedback, chat");

  console.log("\nBản ghi mới tạo trong lần chạy này:", Object.keys(count).length ? count : "không có (đã seed trước đó)");
  console.log(`\nĐăng nhập: <tài khoản>@${DOMAIN} / ${PASSWORD}`);
  console.table(USERS.map((u) => ({ email: email(u.key), role: u.role, facilities: (u.facilities ?? []).join(", ") || (u.role === "ADMIN" ? "tất cả" : "—"), active: u.isActive ?? true })));
  console.log("Header cơ sở cho API nghiệp vụ: X-Facility-Id = seed-fac-q1 | seed-fac-q7");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
