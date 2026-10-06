import { prisma } from "../../config/prisma.js";
import { User } from "../../models/User.js";
import { MemberProfile } from "../../models/MemberProfile.js";
import { CoachProfile } from "../../models/CoachProfile.js";
import { ManagerProfile } from "../../models/ManagerProfile.js";
// MongoDB owns identities. PostgreSQL retains relational projections for the
// business modules; role and active state must not become stale there.
export async function synchronizeUserProjection(id: string) {
  const user = await User.findById(id).select("+password").lean();
  if (!user) throw new Error("User not found");
  const [member, coach, manager] = await Promise.all([
    MemberProfile.findOne({ userId: id }).lean(),
    CoachProfile.findOne({ userId: id }).lean(),
    ManagerProfile.findOne({ userId: id }).lean(),
  ]);
  await prisma.$transaction(async (tx) => {
    const data = {
      email: user.email,
      password: user.password,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender as any,
      dateOfBirth: user.dateOfBirth,
      role: user.role as any,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
    };
    const old = await tx.user.findUnique({ where: { email: user.email } });
    if (old && old.id !== id) {
      if (await tx.user.findUnique({ where: { id } }))
        throw new Error("Identity collision: manual reconciliation required");
      // Existing foreign keys use ON UPDATE CASCADE, preserving payments,
      // enrollments and staff assignments when legacy UUIDs become ObjectIds.
      await tx.user.update({ where: { id: old.id }, data: { id } });
    }
    await tx.user.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    if (member) {
      const old = await tx.memberProfile.findUnique({ where: { userId: id } });
      if (old && old.id !== member._id.toString())
        await tx.memberProfile.update({
          where: { userId: id },
          data: { id: member._id.toString() },
        });
      const data = {
        fitnessGoal: member.fitnessGoal,
        trainingLevel: member.trainingLevel as any,
        trainingPreference: member.trainingPreference,
      };
      await tx.memberProfile.upsert({
        where: { userId: id },
        create: { id: member._id.toString(), userId: id, ...data },
        update: data,
      });
    }
    if (coach) {
      const old = await tx.coachProfile.findUnique({ where: { userId: id } });
      if (old && old.id !== coach._id.toString()) {
        await tx.coachProfile.update({
          where: { userId: id },
          data: { id: coach._id.toString() },
        });
        await tx.classSchedule.updateMany({
          where: { coachId: old.id },
          data: { coachId: coach._id.toString() },
        });
        await tx.leaveRequest.updateMany({
          where: { coachId: old.id },
          data: { coachId: coach._id.toString() },
        });
      }
      const data = {
        specialization: coach.specialization,
        experienceYears: coach.experienceYears,
        bio: coach.bio,
      };
      await tx.coachProfile.upsert({
        where: { userId: id },
        create: { id: coach._id.toString(), userId: id, ...data },
        update: data,
      });
    }
    if (manager) {
      const old = await tx.managerProfile.findUnique({ where: { userId: id } });
      if (old && old.id !== manager._id.toString())
        await tx.managerProfile.update({
          where: { userId: id },
          data: { id: manager._id.toString() },
        });
      await tx.managerProfile.upsert({
        where: { userId: id },
        create: { id: manager._id.toString(), userId: id },
        update: {},
      });
    }
    await tx.facilityStaff.updateMany({
      where: {
        userId: id,
        OR: [
          { role: { not: user.role as any } },
          ...(!user.isActive ? [{}] : []),
        ],
      },
      data: { isActive: false },
    });
  });
}
