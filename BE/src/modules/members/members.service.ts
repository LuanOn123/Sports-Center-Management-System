import { User } from "../../models/User.js";
import { synchronizeUserProjection } from "../users/user-projection.service.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import { hashPassword } from "../../utils/bcrypt.js";
import { ensureActiveFreeSubscription } from "../subscriptions/free-subscription.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import { getStaffFacilityId } from "../../middlewares/facilityScope.js";
import mongoose from "mongoose";
import type { UpdateMemberInput, MemberQueryInput, CreateMemberInput } from "./members.schema.js";

function transformProfile(doc: any) {
  if (!doc) return null;
  return { ...doc, id: doc._id?.toString(), _id: undefined, __v: undefined };
}

export async function assertMemberFacilityAccess(memberProfileId: string, user?: { id: string; role: string }) {
  if (!user || user.role === "ADMIN") return;
  if (user.role === "RECEPTIONIST" || user.role === "MANAGER") {
    const facilityId = await getStaffFacilityId(user.id, user.role);
    const [hasSystemRelation, hasThisFacilityRelation] = await Promise.all([
      (async () => {
        const e = await prisma.enrollment.findFirst({ where: { memberId: memberProfileId } });
        if (e) return true;
        const v = await prisma.facilityVisit.findFirst({ where: { memberId: memberProfileId } });
        if (v) return true;
        const p = await prisma.payment.findFirst({ where: { memberId: memberProfileId } });
        return Boolean(p);
      })(),
      (async () => {
        const e = await prisma.enrollment.findFirst({ where: { memberId: memberProfileId, class: { facilityId } } });
        if (e) return true;
        const v = await prisma.facilityVisit.findFirst({ where: { memberId: memberProfileId, facilityId } });
        if (v) return true;
        const p = await prisma.payment.findFirst({ where: { memberId: memberProfileId, facilityId } });
        if (p) return true;
        const s = await prisma.membershipSubscription.findFirst({ where: { memberId: memberProfileId, facilityId } });
        return Boolean(s);
      })(),
    ]);

    if (hasSystemRelation && !hasThisFacilityRelation) {
      throw new AppError("Member not found", 404);
    }
  }
}

export async function listMembers(query: MemberQueryInput) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;

  // Tìm user MEMBER trước, rồi match profile
  const userFilter: any = { role: "MEMBER" };
  if (query.search) {
    userFilter.$or = [
      { fullName: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }

  const matchedUsers = await User.find(userFilter).select("_id").lean();
  const matchedUserIds = matchedUsers.map((u) => (u._id as any).toString());

  const profileFilter: any = { userId: { $in: matchedUserIds } };
  if (query.trainingLevel) profileFilter.trainingLevel = query.trainingLevel;

  const [total, profiles] = await Promise.all([
    MemberProfile.countDocuments(profileFilter),
    MemberProfile.find(profileFilter).skip(skip).limit(limit).lean(),
  ]);

  // Enrich with user data + active subscription from PostgreSQL
  const members = await Promise.all(
    profiles.map(async (profile) => {
      const user = await User.findById(profile.userId).lean();
      const memberProfileId = (profile._id as any).toString();

      // Lấy subscription ACTIVE từ PostgreSQL
      const subscriptions = await prisma.membershipSubscription.findMany({
        where: {
          memberId: memberProfileId,
          status: "ACTIVE",
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        orderBy: { endDate: "desc" },
        take: 1,
        include: { plan: true },
      });

      return {
        ...transformProfile(profile),
        user: user
          ? {
              id: (user._id as any).toString(),
              email: user.email,
              fullName: user.fullName,
              phone: user.phone,
              gender: user.gender,
              dateOfBirth: user.dateOfBirth,
              avatarUrl: user.avatarUrl,
              role: user.role,
              isActive: user.isActive,
              createdAt: user.createdAt,
            }
          : null,
        subscriptions,
      };
    })
  );

  // Sort by user fullName
  members.sort((a, b) => (a.user?.fullName ?? "").localeCompare(b.user?.fullName ?? ""));

  return { members, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getMemberById(id: string, requestUser?: { id: string; role: string }) {
  // Tìm bằng profileId hoặc userId
  let memberProfile = await MemberProfile.findById(id).lean();
  if (!memberProfile) {
    memberProfile = await MemberProfile.findOne({ userId: id }).lean();
  }
  if (!memberProfile) throw new AppError("Member not found", 404);

  const user = await User.findById(memberProfile.userId).lean();
  if (!user || user.role !== "MEMBER") throw new AppError("Member not found", 404);

  const memberProfileId = (memberProfile._id as any).toString();
  await assertMemberFacilityAccess(memberProfileId, requestUser);

  const subscriptions = await prisma.membershipSubscription.findMany({
    where: {
      memberId: memberProfileId,
      status: "ACTIVE",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: { endDate: "desc" },
    take: 1,
  });

  return {
    ...transformProfile(memberProfile),
    user: {
      id: (user._id as any).toString(),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
    subscriptions,
  };
}

export async function createMember(data: CreateMemberInput, creatorUser?: { id: string; role: string }) {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new AppError("Email is already in use", 409);
  if (data.phone) {
    const existingPhone = await User.findOne({ phone: data.phone });
    if (existingPhone) throw new AppError("Phone number is already in use", 409);
  }

  const rawPassword = data.password || "Member@123456";
  const hashed = await hashPassword(rawPassword);

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
      role: "MEMBER", // ALWAYS strictly MEMBER!
    });
    await user.save({ session });
    const userId = user._id.toString();

    const memberProfile = new MemberProfile({
      userId,
      fitnessGoal: data.fitnessGoal || null,
      trainingLevel: data.trainingLevel || null,
      trainingPreference: data.trainingPreference || null,
    });
    await memberProfile.save({ session });

    await session.commitTransaction();

    const memberProfileId = memberProfile._id.toString();

    // DUAL-WRITE: PostgreSQL
    await prisma.user.create({
      data: {
        id: userId,
        email: user.email,
        password: user.password,
        fullName: user.fullName,
        phone: user.phone,
        gender: user.gender as any,
        dateOfBirth: user.dateOfBirth,
        role: "MEMBER",
      },
    });

    await prisma.memberProfile.create({
      data: {
        id: memberProfileId,
        userId,
        fitnessGoal: data.fitnessGoal || null,
        trainingLevel: (data.trainingLevel as any) || null,
        trainingPreference: data.trainingPreference || null,
      },
    });

    await prisma.$transaction((tx) =>
      ensureActiveFreeSubscription(tx, memberProfileId)
    );

    createNotification(
      userId,
      "MEMBER_REGISTERED",
      "Chào mừng đến với Trung tâm Thể thao!",
      `Xin chào ${user.fullName}! Tài khoản hội viên của bạn đã được tạo thành công tại quầy lễ tân.`
    ).catch(() => {});

    return getMemberById(memberProfileId);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}


export async function updateMember(id: string, data: UpdateMemberInput) {
  let memberProfile = await MemberProfile.findById(id);
  if (!memberProfile) {
    memberProfile = await MemberProfile.findOne({ userId: id });
  }
  if (!memberProfile) throw new AppError("Member not found", 404);

  const user = await User.findById(memberProfile.userId);
  if (!user || user.role !== "MEMBER") throw new AppError("Member not found", 404);

  const { fitnessGoal, trainingLevel, trainingPreference, ...userFields } = data;

  // Update user fields
  if (Object.keys(userFields).length > 0) {
    const updateData: any = { ...userFields };
    if (userFields.dateOfBirth) updateData.dateOfBirth = new Date(userFields.dateOfBirth);
    await User.updateOne({ _id: memberProfile.userId }, updateData);
  }

  // Update profile fields
  const profileData: any = {};
  if (fitnessGoal !== undefined) profileData.fitnessGoal = fitnessGoal;
  if (trainingLevel !== undefined) profileData.trainingLevel = trainingLevel;
  if (trainingPreference !== undefined) profileData.trainingPreference = trainingPreference;
  if (Object.keys(profileData).length > 0) {
    await MemberProfile.updateOne({ _id: memberProfile._id }, profileData);
  }

  await synchronizeUserProjection(memberProfile.userId);
  return getMemberById(id);
}

export async function getMembershipStatus(memberId: string) {
  let memberProfile = await MemberProfile.findById(memberId).lean();
  if (!memberProfile) {
    memberProfile = await MemberProfile.findOne({ userId: memberId }).lean();
  }
  if (!memberProfile) throw new AppError("Member not found", 404);

  const memberProfileId = (memberProfile._id as any).toString();
  const activeSub = await prisma.membershipSubscription.findFirst({
    where: {
      memberId: memberProfileId,
      status: "ACTIVE",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: [{ tier: "desc" }, { endDate: "desc" }],
  });

  const effectiveTier = activeSub ? activeSub.tier : null;
  const daysRemaining = activeSub
    ? Math.ceil((activeSub.endDate.getTime() - Date.now()) / 86400000)
    : null;

  return { effectiveTier, activeSubscription: activeSub, daysRemaining };
}
