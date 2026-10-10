import { User } from "../../models/User.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { synchronizeUserProjection } from "../users/user-projection.service.js";
import type { CoachQueryInput, UpdateCoachInput } from "./coaches.schema.js";

async function managerCoachIds() {
  if (requestContext.getStore()?.role !== "MANAGER") return undefined;
  const rows = await prisma.facilityStaff.findMany({ where: { role: "COACH", isActive: true }, select: { userId: true } });
  return rows.map(row => row.userId);
}
async function assertManagerCoach(id: string) {
  const ids = await managerCoachIds();
  if (ids && !ids.includes(id)) throw new AppError("FORBIDDEN_SCOPE", 403);
}

export async function listCoaches(query: CoachQueryInput) {
  const { search, specialization } = query;
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;

  // Tìm user COACH active
  const userFilter: any = { role: "COACH", isActive: true };
  const assignedIds = await managerCoachIds();
  if (assignedIds) userFilter._id = { $in: assignedIds };
  if (search) {
    userFilter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const matchedUsers = await User.find(userFilter).lean();

  // Filter by specialization if provided
  let profileFilter: any = { userId: { $in: matchedUsers.map((u) => (u._id as any).toString()) } };
  if (specialization) {
    profileFilter.specialization = { $regex: specialization, $options: "i" };
  }

  const profiles = await CoachProfile.find(profileFilter).lean();
  const profileUserIds = new Set(profiles.map((p) => p.userId));

  // Chỉ lấy user có profile match
  const filteredUsers = matchedUsers.filter((u) => profileUserIds.has((u._id as any).toString()));

  const total = filteredUsers.length;
  const paged = filteredUsers.slice(skip, skip + limit);

  const coaches = paged.map((u) => {
    const uid = (u._id as any).toString();
    const profile = profiles.find((p) => p.userId === uid);
    return {
      id: uid,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      gender: u.gender,
      dateOfBirth: u.dateOfBirth,
      avatarUrl: u.avatarUrl,
      role: u.role,
      isActive: u.isActive,
      coachProfile: profile
        ? { ...profile, id: (profile._id as any).toString(), _id: undefined, __v: undefined }
        : null,
    };
  });

  const pagination = buildPaginationMeta(total, page, limit);
  return { coaches, pagination };
}

export async function getCoachById(id: string) {
  await assertManagerCoach(id);
  const user = await User.findOne({ _id: id, role: "COACH" }).lean();
  if (!user) throw new AppError("Coach not found", 404);

  const uid = (user._id as any).toString();
  const coachProfile = await CoachProfile.findOne({ userId: uid }).lean();

  // Lấy classes assignment từ PostgreSQL
  let classesData: any[] = [];
  if (coachProfile) {
    const cpId = (coachProfile._id as any).toString();
    const classMembers = await prisma.classMember.findMany({
      where: { coachId: cpId },
      include: {
        class: {
          include: {
            sports: true,
            schedules: {
              where: { status: "SCHEDULED" },
              take: 5,
              orderBy: { startTime: "asc" },
            },
          },
        },
      },
    });
    classesData = classMembers;
  }

  return {
    id: uid,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    coachProfile: coachProfile
      ? {
          ...(coachProfile as any),
          id: (coachProfile._id as any).toString(),
          _id: undefined,
          __v: undefined,
          classes: classesData,
        }
      : null,
  };
}

export async function updateCoach(id: string, data: UpdateCoachInput) {
  await assertManagerCoach(id);
  const coachProfile = await CoachProfile.findOne({ userId: id });
  if (!coachProfile) {
    const user = await User.findOne({ _id: id, role: "COACH" });
    if (!user) throw new AppError("Coach not found", 404);
  }

  const { fullName, phone, gender, dateOfBirth, ...profileData } = data;
  const userFields: any = {};
  if (fullName !== undefined) userFields.fullName = fullName;
  if (phone !== undefined) userFields.phone = phone;
  if (gender !== undefined) userFields.gender = gender;
  if (dateOfBirth !== undefined) userFields.dateOfBirth = new Date(dateOfBirth);

  if (Object.keys(userFields).length > 0) {
    await User.updateOne({ _id: id }, userFields);
  }

  const profileUpdate: any = {};
  if (profileData.specialization !== undefined) profileUpdate.specialization = profileData.specialization;
  if (profileData.experienceYears !== undefined) profileUpdate.experienceYears = profileData.experienceYears;
  if (profileData.bio !== undefined) profileUpdate.bio = profileData.bio;

  if (Object.keys(profileUpdate).length > 0) {
    await CoachProfile.updateOne({ userId: id }, profileUpdate);
  }

  await synchronizeUserProjection(id);
  // Return updated coach
  const updatedProfile = await CoachProfile.findOne({ userId: id }).lean();
  const updatedUser = await User.findById(id).lean();

  return {
    ...(updatedProfile
      ? { ...updatedProfile, id: (updatedProfile._id as any).toString(), _id: undefined, __v: undefined }
      : {}),
    user: updatedUser
      ? {
          id: (updatedUser._id as any).toString(),
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          phone: updatedUser.phone,
          gender: updatedUser.gender,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
        }
      : null,
  };
}
