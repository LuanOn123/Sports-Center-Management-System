import { randomUUID } from "node:crypto";
import { checkFacilityCoachLimit } from "../facilities/facility-limits.service.js";
import mongoose from "mongoose";
import { User } from "../../models/User.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { ManagerProfile } from "../../models/ManagerProfile.js";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/bcrypt.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { ensureActiveFreeSubscription } from "../subscriptions/free-subscription.service.js";
import type { CreateUserInput } from "./users.schema.js";

/** A recoverable saga: authentication remains blocked until both stores are ready. */
export async function provisionAccount(
  data: CreateUserInput,
  facilityId?: string,
) {
  const email = data.email.trim().toLowerCase();
  const leaseToken = randomUUID(),
    leaseUntil = new Date(Date.now() + 300000);
  let user = await User.findOne({ email }).select("+password");
  if (
    user &&
    (user.provisioningStatus === "READY" ||
      !user.provisioningStatus ||
      user.role !== data.role ||
      !(await comparePassword(data.password, user.password)))
  )
    throw new AppError("Email is already in use", 409);
  // Fail fast on business limits before any account document exists; re-checked under lock below.
  if (facilityId && data.role === "COACH") await checkFacilityCoachLimit(facilityId);

  if (user) {
    user = await User.findOneAndUpdate(
      {
        _id: user._id,
        provisioningStatus: { $in: ["PENDING", "FAILED"] },
        $or: [
          { provisioningLeaseUntil: null },
          { provisioningLeaseUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          provisioningLeaseToken: leaseToken,
          provisioningLeaseUntil: leaseUntil,
        },
      },
      { returnDocument: "after" },
    ).select("+password");
    if (!user)
      throw new AppError(
        "Tài khoản đang được tạo bởi một yêu cầu khác. Vui lòng thử lại sau.",
        409,
        { code: "ACCOUNT_PROVISIONING_BUSY" },
      );
  }
  if (!user) {
    if (await prisma.user.findUnique({ where: { email } }))
      throw new AppError("Email is already in use", 409);
    const password = await hashPassword(data.password);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      user = new User({
        ...data,
        email,
        password,
        isActive: false,
        provisioningStatus: "PENDING",
        provisioningLeaseToken: leaseToken,
        provisioningLeaseUntil: leaseUntil,
      });
      await user.save({ session });
      const userId = user._id.toString();
      if (data.role === "MEMBER")
        await new MemberProfile({
          userId,
          fitnessGoal: data.fitnessGoal,
          trainingLevel: data.trainingLevel,
          trainingPreference: data.trainingPreference,
        }).save({ session });
      if (data.role === "COACH")
        await new CoachProfile({
          userId,
          experienceYears: data.experienceYears,
          bio: data.bio,
        }).save({ session });
      if (data.role === "MANAGER")
        await new ManagerProfile({ userId }).save({ session });
      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  const userId = user!._id.toString();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('provision:' || ${userId}::text))`;
      const fields = {
        email,
        password: user!.password,
        fullName: user!.fullName,
        phone: user!.phone,
        gender: user!.gender as any,
        dateOfBirth: user!.dateOfBirth,
        role: user!.role as any,
        isActive: false,
      };
      if (facilityId && data.role === "COACH") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('facility:coach-limit:' || ${facilityId}::text))`;
        await checkFacilityCoachLimit(facilityId, tx);
      }
      await tx.user.upsert({
        where: { id: userId },
        create: { id: userId, ...fields },
        update: fields,
      });
      if (data.role === "MEMBER") {
        const profile = await MemberProfile.findOne({ userId });
        if (!profile) throw new Error("PROVISION_MEMBER_PROFILE_MISSING");
        const pg = await tx.memberProfile.upsert({
          where: { userId },
          create: {
            id: profile._id.toString(),
            userId,
            fitnessGoal: profile.fitnessGoal,
            trainingLevel: profile.trainingLevel as any,
            trainingPreference: profile.trainingPreference,
          },
          update: {},
        });
        await ensureActiveFreeSubscription(tx, pg.id);
      }
      if (data.role === "COACH") {
        const profile = await CoachProfile.findOne({ userId });
        if (!profile) throw new Error("PROVISION_COACH_PROFILE_MISSING");
        const pg = await tx.coachProfile.upsert({
          where: { userId },
          create: {
            id: profile._id.toString(),
            userId,
            experienceYears: data.experienceYears,
            bio: data.bio,
          },
          update: {},
        });
        await tx.coachSpecialization.createMany({
          data: [...new Set(data.sportIds ?? [])].map((sportId) => ({
            coachId: pg.id,
            sportId,
          })),
          skipDuplicates: true,
        });
      }
      if (data.role === "MANAGER") {
        const profile = await ManagerProfile.findOne({ userId });
        if (!profile) throw new Error("PROVISION_MANAGER_PROFILE_MISSING");
        await tx.managerProfile.upsert({
          where: { userId },
          create: { id: profile._id.toString(), userId },
          update: {},
        });
      }
      if (facilityId && ["COACH", "RECEPTIONIST"].includes(data.role))
        await tx.facilityStaff.upsert({
          where: {
            userId_facilityId_role: {
              userId,
              facilityId,
              role: data.role as any,
            },
          },
          create: {
            userId,
            facilityId,
            role: data.role as any,
            isActive: true,
          },
          update: { isActive: true },
        });
    });
    await User.updateOne(
      { _id: userId, provisioningLeaseToken: leaseToken },
      { $set: { isActive: true, provisioningStatus: "READY" } },
    );
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
    await User.updateOne(
      { _id: userId, provisioningLeaseToken: leaseToken },
      { $set: { provisioningLeaseToken: null, provisioningLeaseUntil: null } },
    ).catch(() => {});
    return userId;
  } catch (error) {
    // A failed cleanup must never leave an authenticatable account. Retain IDs for retry/reconciliation.
    await prisma.user
      .updateMany({ where: { id: userId }, data: { isActive: false } })
      .catch(() => {});
    await User.updateOne(
      { _id: userId, provisioningLeaseToken: leaseToken },
      {
        $set: {
          isActive: false,
          provisioningStatus: "FAILED",
          provisioningLeaseToken: null,
          provisioningLeaseUntil: null,
        },
      },
    ).catch(() => {});
    // Business rejections (e.g. facility coach limit) keep their own message; retrying will not help.
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Chưa hoàn tất tạo tài khoản. Có thể gửi lại cùng email và mật khẩu để tiếp tục an toàn.",
      503,
      { code: "ACCOUNT_PROVISIONING_INCOMPLETE" },
    );
  }
}
