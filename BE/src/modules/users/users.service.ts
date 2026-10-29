import { RefreshToken } from "../../models/RefreshToken.js";
import { requestContext } from "../../config/request-context.js";
import { effectiveCoachWhere } from "../operations/effective-coaches.js";
import { provisionAccount } from "./provisioning.service.js";
import { synchronizeUserProjection } from "./user-projection.service.js";
import { staffAssignmentView } from "../facilities/staff-assignment-view.js";
import { User } from "../../models/User.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { ManagerProfile } from "../../models/ManagerProfile.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import { disconnectUserSockets } from "../chat/chat.socket.js";
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

export async function createUser(data: CreateUserInput, facilityId?: string) {
  const sportIds = [...new Set(data.sportIds ?? [])];
  if (data.role === "COACH" && (!sportIds.length || await prisma.sport.count({ where: { id: { in: sportIds }, isActive: true } }) !== sportIds.length))
    throw new AppError("Vui lòng chọn bộ môn đang hoạt động cho HLV.", 400);
  const userId = await provisionAccount({ ...data, sportIds }, facilityId);
  return buildUserResponse(userId);
}

export async function getUserById(id: string) {
  const result = await buildUserResponse(id);
  if (!result) throw new AppError("User not found", 404);
  return result;
}

async function updateUserInternal(id: string, data: UpdateUserInput, requesterId: string) {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  if (id === requesterId) {
    if (data.isActive === false) throw new AppError("Cannot deactivate your own account", 400);
    if (data.role && data.role !== user.role) throw new AppError("Cannot change your own role", 400);
  }

  if (["MANAGER", "ADMIN"].includes(user.role) && (data.isActive === false || (data.role && data.role !== user.role))) {
    const activeManagers = await User.countDocuments({ role: user.role, isActive: true });
    if (activeManagers <= 1) {
      throw new AppError(`Không thể khóa hoặc đổi vai trò của ${user.role === "ADMIN" ? "quản trị viên" : "quản lý"} cuối cùng.`, 400);
    }
  }

  // BR-16: Prevent role change if active engagements exist
  if (data.role && data.role !== user.role) {
    const userId = user._id.toString();
    if (user.role === "MEMBER") {
      const mp = await MemberProfile.findOne({ userId });
      if (mp) {
        // Gói FREE hệ thống (ACTIVE khi chưa có gói trả phí) không phải cam kết ⇒ chỉ chặn khi còn gói TRẢ PHÍ đang dùng/chờ kích hoạt.
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
    await User.updateOne({ _id: id }, { role: data.role, $inc: { tokenVersion: 1 } });
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
    if (data.isActive === false) await User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
    await RefreshToken.deleteMany({ userId: id });
    disconnectUserSockets(id);
  }

  await synchronizeUserProjection(id);
  return buildUserResponse(id);
}

async function deactivateUserInternal(id: string, requesterId: string) {
  if (id === requesterId) throw new AppError("Cannot deactivate your own account", 400);

  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);

  if (["MANAGER", "ADMIN"].includes(user.role)) {
    const activeManagers = await User.countDocuments({ role: user.role, isActive: true });
    if (activeManagers <= 1) {
      throw new AppError(`Không thể khóa ${user.role === "ADMIN" ? "quản trị viên" : "quản lý"} cuối cùng.`, 400);
    }
  }

  await User.updateOne({ _id: id }, { isActive: false, $inc: { tokenVersion: 1 } });
  await RefreshToken.deleteMany({ userId: id });
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

export async function updateUser(id: string, data: UpdateUserInput, requesterId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users:administration'))`;
    if (data.isActive === false || (data.role && data.role !== (await User.findById(id))?.role)) await assertAccountCanDeactivate(id, tx);
    return updateUserInternal(id, data, requesterId);
  });
}
export async function deactivateUser(id: string, requesterId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users:administration'))`;
    await assertAccountCanDeactivate(id, tx);
    return deactivateUserInternal(id, requesterId);
  });
}
async function assertAccountCanDeactivate(userId: string, tx: any) {
  const profile = await prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:coach:' || ${profile.id}::text))`;
  const count = await requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () => prisma.classSchedule.count({
    where: { status: "SCHEDULED", endTime: { gt: new Date() }, ...effectiveCoachWhere(profile.id) } }));
  if (count) throw new AppError("HLV còn lịch giảng dạy. Hãy điều phối người thay trước khi khóa tài khoản.", 409);
}
