import { User } from "../../models/User.js";
import { synchronizeUserProjection } from "../users/user-projection.service.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import type { UpdateMemberInput, MemberQueryInput } from "./members.schema.js";

function transformProfile(doc: any) {
  if (!doc) return null;
  return { ...doc, id: doc._id?.toString(), _id: undefined, __v: undefined };
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

export async function getMemberById(id: string) {
  // Tìm bằng profileId hoặc userId
  let memberProfile = await MemberProfile.findById(id).lean();
  if (!memberProfile) {
    memberProfile = await MemberProfile.findOne({ userId: id }).lean();
  }
  if (!memberProfile) throw new AppError("Member not found", 404);

  const user = await User.findById(memberProfile.userId).lean();
  if (!user || user.role !== "MEMBER") throw new AppError("Member not found", 404);

  const memberProfileId = (memberProfile._id as any).toString();
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
