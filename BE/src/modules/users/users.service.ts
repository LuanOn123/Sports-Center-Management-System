import { synchronizeUserProjection } from "./user-projection.service.js";
import { staffAssignmentView } from "../facilities/staff-assignment-view.js";
import { User } from "../../models/User.js";
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

export async function createUser(data: CreateUserInput) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError("Email is already in use", 409);

  const hashed = await hashPassword(data.password);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = new User({
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
    } else if (data.role === "COACH") {
      const cp = new CoachProfile({ userId });
      await cp.save({ session });
    } else if (data.role === "MANAGER") {
      const mgr = new ManagerProfile({ userId });
      await mgr.save({ session });
    }

    await session.commitTransaction();

    // DUAL-WRITE: Tạo bản sao trong PostgreSQL
    await prisma.user.create({
      data: {
        id: userId,
        email: user.email,
        password: user.password,
        fullName: user.fullName,
        phone: user.phone,
        gender: user.gender as any,
        dateOfBirth: user.dateOfBirth,
        role: user.role as any,
      }
    });

    if (data.role === "MEMBER") {
      const mp = await MemberProfile.findOne({ userId });
      if (mp) {
        await prisma.memberProfile.create({
          data: {
            id: mp._id.toString(),
            userId: userId,
            fitnessGoal: data.fitnessGoal || null,
            trainingLevel: data.trainingLevel as any || null,
            trainingPreference: data.trainingPreference || null,
          }
        });
        await prisma.$transaction((tx) =>
          ensureActiveFreeSubscription(tx, mp._id.toString())
        );
      }
    } else if (data.role === "COACH") {
      const cp = await CoachProfile.findOne({ userId });
      if (cp) {
        await prisma.coachProfile.create({
          data: { id: cp._id.toString(), userId: userId }
        });
      }
    } else if (data.role === "MANAGER") {
      const mgr = await ManagerProfile.findOne({ userId });
      if (mgr) {
        await prisma.managerProfile.create({
          data: { id: mgr._id.toString(), userId: userId }
        });
      }
    }

    return buildUserResponse(userId);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
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

  if (["MANAGER", "ADMIN"].includes(user.role) && (data.isActive === false || (data.role && data.role !== user.role))) {
    const activeManagers = await User.countDocuments({ role: user.role, isActive: true });
    if (activeManagers <= 1) {
      throw new AppError("Cannot deactivate or demote the last active MANAGER", 400);
    }
  }

  // BR-16: Prevent role change if active engagements exist
  if (data.role && data.role !== user.role) {
    const userId = user._id.toString();
    if (user.role === "MEMBER") {
      const mp = await MemberProfile.findOne({ userId });
      if (mp) {
        const activeSubs = await prisma.membershipSubscription.count({
          where: { memberId: mp._id.toString(), status: "ACTIVE" },
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
      const cp = await CoachProfile.findOne({ userId });
      if (cp) {
        const upcomingSchedules = await prisma.classSchedule.count({
          where: {
            class: { coaches: { some: { coachId: cp._id.toString() } } },
            status: "SCHEDULED",
            startTime: { gt: new Date() },
          },
        });
        if (upcomingSchedules > 0)
          throw new AppError("Cannot change role: COACH is assigned to upcoming classes.", 400);
      }
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

  if (["MANAGER", "ADMIN"].includes(user.role)) {
    const activeManagers = await User.countDocuments({ role: "MANAGER", isActive: true });
    if (activeManagers <= 1) {
      throw new AppError("Cannot deactivate the last active MANAGER", 400);
    }
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
