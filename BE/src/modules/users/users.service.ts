import { synchronizeUserProjection } from "./user-projection.service.js";
import { staffAssignmentView } from "../facilities/staff-assignment-view.js";
import { User, type IUser } from "../../models/User.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { ManagerProfile } from "../../models/ManagerProfile.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { hashPassword } from "../../utils/bcrypt.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import { ensureActiveFreeSubscription } from "../subscriptions/free-subscription.service.js";
import { disconnectUserSockets } from "../chat/chat.socket.js";
import mongoose from "mongoose";
import type { CreateUserInput, UpdateUserInput, UserQueryInput } from "./users.schema.js";

function transformProfile(doc: any) {
  if (!doc) return null;
  return { ...doc, id: doc._id?.toString(), _id: undefined, __v: undefined };
}

async function buildUserResponse(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const uid = (user._id as any).toString();
  const memberProfile = await MemberProfile.findOne({ userId: uid }).lean();
  const coachProfile = await CoachProfile.findOne({ userId: uid }).lean();
  const managerProfile = await ManagerProfile.findOne({ userId: uid }).lean();

  return {
    id: uid,
    ...(await staffAssignmentView(uid, user.role)),
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    memberProfile: transformProfile(memberProfile),
    coachProfile: transformProfile(coachProfile),
    managerProfile: transformProfile(managerProfile),
  };
}

export async function listUsers(query: UserQueryInput) {
  const currentPage = Math.max(1, parseInt(query.page ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skipVal = (currentPage - 1) * pageSize;

  const filter: any = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }

  const [total, rawUsers] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).skip(skipVal).limit(pageSize).sort({ fullName: 1 }).lean(),
  ]);

  // Enrich with profiles
  const users = await Promise.all(
    rawUsers.map(async (u: any) => {
      const uid = u._id.toString();
      const memberProfile = await MemberProfile.findOne({ userId: uid }).lean();
      const coachProfile = await CoachProfile.findOne({ userId: uid }).lean();
      const managerProfile = await ManagerProfile.findOne({ userId: uid }).lean();
      return {
        id: uid,
        ...(await staffAssignmentView(uid, u.role)),
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        gender: u.gender,
        dateOfBirth: u.dateOfBirth,
        avatarUrl: u.avatarUrl,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        memberProfile: transformProfile(memberProfile),
        coachProfile: transformProfile(coachProfile),
        managerProfile: transformProfile(managerProfile),
      };
    })
  );

  return { users, pagination: buildPaginationMeta(total, currentPage, pageSize) };
}

/**
 * AUD-08: bảo vệ tài khoản quản trị cuối cùng — đếm ĐÚNG role của tài khoản bị khóa/hạ quyền
 * (trước đây deactivate luôn đếm MANAGER, kể cả khi target là ADMIN). Dùng chung cho update/deactivate.
 */
async function assertNotLastPrivilegedAccount(role: IUser["role"]) {
  if (!["MANAGER", "ADMIN"].includes(role)) return;
  const remaining = await User.countDocuments({ role, isActive: true });
  if (remaining <= 1) {
    throw new AppError(`Cannot deactivate or demote the last active ${role}`, 400);
  }
}

/**
 * R-10: HLV còn buổi dạy tương lai (là HLV của lớp hoặc HLV thay theo buổi) thì phải
 * điều phối người thay trước khi khóa tài khoản/đổi role, tránh lịch "mồ côi".
 */
async function assertCoachHasNoUpcomingSchedules(userId: string, action: string) {
  const cp = await CoachProfile.findOne({ userId });
  if (!cp) return;
  const coachId = cp._id.toString();
  const upcomingSchedules = await prisma.classSchedule.count({
    where: {
      status: "SCHEDULED",
      startTime: { gt: new Date() },
      OR: [{ coachId }, { class: { coaches: { some: { coachId } } } }],
    },
  });
  if (upcomingSchedules > 0)
    throw new AppError(`${action}: HLV còn ${upcomingSchedules} buổi dạy sắp tới. Hãy phân công HLV khác trước.`, 400);
}

export async function createUser(data: CreateUserInput) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError("Email is already in use", 409);

  const sportIds = [...new Set(data.sportIds ?? [])];
  if (data.role === "COACH") {
    const count = await prisma.sport.count({ where: { id: { in: sportIds }, isActive: true } });
    if (!sportIds.length || count !== sportIds.length)
      throw new AppError("Vui lòng chọn bộ môn đang hoạt động cho HLV.", 400);
  }
  const hashed = await hashPassword(data.password);

  const session = await mongoose.startSession();
  session.startTransaction();
  let user: InstanceType<typeof User>;
  let profileId: string | null = null;
  try {
    user = new User({
      email: data.email,
      password: hashed,
      fullName: data.fullName,
      phone: data.phone || null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      role: data.role,
    });
    await user.save({ session });
    const userId = user._id.toString();

    if (data.role === "MEMBER") {
      const mp = new MemberProfile({
        userId,
        fitnessGoal: data.fitnessGoal || null,
        trainingLevel: data.trainingLevel || null,
        trainingPreference: data.trainingPreference || null,
      });
      await mp.save({ session });
      profileId = mp._id.toString();
    } else if (data.role === "COACH") {
      const cp = new CoachProfile({ userId, experienceYears: data.experienceYears, bio: data.bio });
      await cp.save({ session });
      profileId = cp._id.toString();
    } else if (data.role === "MANAGER") {
      const mgr = new ManagerProfile({ userId });
      await mgr.save({ session });
      profileId = mgr._id.toString();
    }

    await session.commitTransaction();
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const userId = user._id.toString();

  // DUAL-WRITE sang PostgreSQL trong MỘT transaction (user + profile + quyền mặc định).
  // AUD-04: lỗi ở bất kỳ bước nào ⇒ xóa bù dữ liệu Mongo vừa commit (giống luồng register),
  // tránh tài khoản đăng nhập được nhưng thiếu projection/profile/FREE và chặn tạo lại vì trùng email.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email: user.email,
          password: user.password,
          fullName: user.fullName,
          phone: user.phone,
          gender: user.gender as any,
          dateOfBirth: user.dateOfBirth,
          role: user.role as any,
        },
      });

      if (data.role === "MEMBER" && profileId) {
        await tx.memberProfile.create({
          data: {
            id: profileId,
            userId,
            fitnessGoal: data.fitnessGoal || null,
            trainingLevel: data.trainingLevel as any || null,
            trainingPreference: data.trainingPreference || null,
          },
        });
        await ensureActiveFreeSubscription(tx, profileId);
      } else if (data.role === "COACH" && profileId) {
        await tx.coachProfile.create({
          data: { id: profileId, userId, experienceYears: data.experienceYears, bio: data.bio, specializations: { create: sportIds.map((sportId) => ({ sportId })) } },
        });
      } else if (data.role === "MANAGER" && profileId) {
        await tx.managerProfile.create({ data: { id: profileId, userId } });
      }
    });
  } catch (pgErr) {
    console.error("[createUser] PostgreSQL sync failed, rolling back MongoDB user:", userId, pgErr);
    await Promise.allSettled([
      MemberProfile.deleteOne({ userId }),
      CoachProfile.deleteOne({ userId }),
      ManagerProfile.deleteOne({ userId }),
      User.deleteOne({ _id: user._id }),
    ]);
    throw pgErr;
  }

  return buildUserResponse(userId);
}

export async function getUserById(id: string) {
  const result = await buildUserResponse(id);
  if (!result) throw new AppError("User not found", 404);
  return result;
}

export async function updateUser(id: string, data: UpdateUserInput, requesterId: string) {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  if (id === requesterId) {
    if (data.isActive === false) throw new AppError("Cannot deactivate your own account", 400);
    if (data.role && data.role !== user.role) throw new AppError("Cannot change your own role", 400);
  }

  if (data.isActive === false || (data.role && data.role !== user.role)) {
    await assertNotLastPrivilegedAccount(user.role);
  }
  if (data.isActive === false && user.role === "COACH") {
    await assertCoachHasNoUpcomingSchedules(user._id.toString(), "Không thể khóa tài khoản");
  }

  // BR-16: Prevent role change if active engagements exist
  if (data.role && data.role !== user.role) {
    const userId = user._id.toString();
    if (user.role === "MEMBER") {
      const mp = await MemberProfile.findOne({ userId });
      if (mp) {
        // Gói FREE hệ thống luôn ACTIVE với mọi member ⇒ chỉ chặn khi còn gói TRẢ PHÍ đang dùng/chờ kích hoạt.
        const activeSubs = await prisma.membershipSubscription.count({
          where: { memberId: mp._id.toString(), status: { in: ["ACTIVE", "SCHEDULED"] }, tier: { not: "FREE" } },
        });
        if (activeSubs > 0)
          throw new AppError("Cannot change role: MEMBER has active subscriptions. Cancel them first.", 400);
        const bookedEnrollments = await prisma.enrollment.count({
          where: { memberId: mp._id.toString(), status: "BOOKED" },
        });
        if (bookedEnrollments > 0)
          throw new AppError("Cannot change role: MEMBER has upcoming booked classes. Cancel them first.", 400);
      }
    }
    if (user.role === "COACH") {
      await assertCoachHasNoUpcomingSchedules(userId, "Cannot change role");
    }
  }

  const updateData: any = { ...data };
  if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
  delete updateData.role; // role change handled separately below

  await User.updateOne({ _id: id }, updateData);

  // Create profile if role changed
  if (data.role && data.role !== user.role) {
    await User.updateOne({ _id: id }, { role: data.role });
    const userId = user._id.toString();
    if (data.role === "COACH") {
      await CoachProfile.findOneAndUpdate({ userId }, { userId }, { upsert: true });
    } else if (data.role === "MANAGER") {
      await ManagerProfile.findOneAndUpdate({ userId }, { userId }, { upsert: true });
    } else if (data.role === "MEMBER") {
      await MemberProfile.findOneAndUpdate({ userId }, { userId }, { upsert: true });
    }
  }

  // Ngắt socket khi khóa tài khoản hoặc đổi role
  if (data.isActive === false || (data.role && data.role !== user.role)) {
    disconnectUserSockets(id);
  }

  await synchronizeUserProjection(id);
  return buildUserResponse(id);
}

export async function deactivateUser(id: string, requesterId: string) {
  if (id === requesterId) throw new AppError("Cannot deactivate your own account", 400);

  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  await assertNotLastPrivilegedAccount(user.role);
  if (user.role === "COACH") {
    await assertCoachHasNoUpcomingSchedules(user._id.toString(), "Không thể khóa tài khoản");
  }

  await User.updateOne({ _id: id }, { isActive: false });
  disconnectUserSockets(id);
  await synchronizeUserProjection(id);

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: false,
  };
}
