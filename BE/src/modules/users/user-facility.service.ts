import type { Prisma, UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler.js";
import { effectiveCoachWhere } from "../operations/effective-coaches.js";
import { checkFacilityCoachLimit } from "../facilities/facility-limits.service.js";

export async function setUserFacility(
  tx: Prisma.TransactionClient,
  userId: string,
  role: UserRole,
  facilityId: string | null,
) {
  if (!["MANAGER", "COACH", "RECEPTIONIST"].includes(role)) {
    if (facilityId) throw new AppError("Chỉ phân công cơ sở cho Quản lý, HLV hoặc Lễ tân.", 400);
    return;
  }
  if (role === "MANAGER" && facilityId)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"manager-facility:" + facilityId}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"staff-assignment:" + userId}))`;
  if (role === "MANAGER")
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"facility-manager:" + userId}))`;
  const current = await tx.facilityStaff.findMany({ where: { userId, isActive: true } });
  if (current.length === 1 && current[0].facilityId === facilityId && current[0].role === role) return;
  if (facilityId) {
    const facility = await tx.facility.findUnique({ where: { id: facilityId } });
    if (!facility?.isActive) throw new AppError("Cơ sở không tồn tại hoặc đã ngừng hoạt động.", 400);
    if (role === "MANAGER" && await tx.facilityStaff.findFirst({
      where: { facilityId, role: "MANAGER", isActive: true, userId: { not: userId } },
    })) throw new AppError("Cơ sở đã có quản lý phụ trách. Vui lòng dùng chức năng Thay quản lý tại Cơ sở.", 409);
  }
  if (role === "COACH") {
    const profile = await tx.coachProfile.findUnique({ where: { userId }, select: { id: true } });
    if (profile) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('schedule:coach:' || ${profile.id}::text))`;
      const hasTeaching = await tx.class.count({
        where: { isActive: true, coaches: { some: { coachId: profile.id } } },
      });
      const hasSchedule = await tx.classSchedule.count({
        where: { status: "SCHEDULED", endTime: { gt: new Date() }, ...effectiveCoachWhere(profile.id) },
      });
      if (hasTeaching || hasSchedule)
        throw new AppError("HLV còn phân công lớp hoặc lịch dạy. Hãy điều phối người thay trước khi chuyển cơ sở.", 409);
    }
    if (facilityId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('facility:coach-limit:' || ${facilityId}::text))`;
      await checkFacilityCoachLimit(facilityId, tx);
    }
  }
  await tx.facilityStaff.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
  if (facilityId) await tx.facilityStaff.upsert({
    where: { userId_facilityId_role: { userId, facilityId, role } },
    create: { userId, facilityId, role, isActive: true },
    update: { isActive: true },
  });
}
