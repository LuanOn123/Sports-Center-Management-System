import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { lockMemberCheckIn } from "../../utils/dbLocks.js";
import { FACILITY_CHECKIN } from "../../config/membership.js";
import { findActiveSubscription } from "../enrollments/enrollment-quota.service.js";

export type CheckInMethod = "QR" | "RECEPTION";

/** Resolve MemberProfile từ id hoặc userId, chặn user khóa/không phải MEMBER. */
export async function resolveMemberProfile(
  db: typeof prisma | Prisma.TransactionClient,
  idOrUserId: string,
) {
  const profile = await db.memberProfile.findFirst({
    where: { OR: [{ id: idOrUserId }, { userId: idOrUserId }] },
    include: { user: { select: { id: true, isActive: true, role: true } } },
  });
  if (!profile || !profile.user || profile.user.role !== "MEMBER")
    throw new AppError("Member not found", 404);
  if (!profile.user.isActive)
    throw new AppError("Cannot check in: member account is locked", 400);
  return profile;
}

/** Ghi lượt vào cửa: verify facility → entitlement GLOBAL → dedupe → create. */
export async function checkIn(
  memberProfileId: string,
  method: CheckInMethod,
  now: Date = new Date(),
) {
  const facilityId = requestContext.getStore()?.facilityId;
  if (!facilityId) throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);

  return prisma.$transaction(async (tx) => {
    await lockMemberCheckIn(tx, memberProfileId);

    const facility = await tx.facility.findUnique({ where: { id: facilityId } });
    if (!facility) throw new AppError("Facility not found", 404);
    if (!facility.isActive) throw new AppError("FORBIDDEN_SCOPE", 403);

    const activeSub = await findActiveSubscription(tx, memberProfileId, now);
    if (!activeSub) {
      throw new AppError(
        "Bạn không có gói tập đang hoạt động. Vui lòng mua/gia hạn gói để vào cơ sở.",
        403,
      );
    }

    const dedupeSince = new Date(
      now.getTime() - FACILITY_CHECKIN.DEDUPE_MINUTES * 60 * 1000,
    );
    const existing = await tx.facilityVisit.findFirst({
      where: {
        memberId: memberProfileId,
        facilityId,
        checkInAt: { gte: dedupeSince },
      },
      orderBy: { checkInAt: "desc" },
      include: { facility: { select: { id: true, name: true, code: true } } },
    });
    if (existing) return { visit: existing, duplicate: true as const };

    const visit = await tx.facilityVisit.create({
      data: { memberId: memberProfileId, facilityId, method, checkInAt: now },
      include: { facility: { select: { id: true, name: true, code: true } } },
    });
    return { visit, duplicate: false as const };
  });
}
