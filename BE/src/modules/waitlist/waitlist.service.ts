import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { lockMemberClass, lockMemberQuota, lockSchedule } from "../../utils/dbLocks.js";
import { assertCanBook } from "../enrollments/enrollments.service.js";
import { enqueueNotification, flushNotificationOutbox } from "../notifications/outbox.service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

const enrollmentInclude = {
  schedule: { include: { class: { include: { sports: true } }, room: true } },
} as const;

/**
 * Join waitlist cho buổi đã FULL (schedule-specific).
 * - Buổi phải SCHEDULED + chưa bắt đầu; member chưa BOOKED/COMPLETED buổi này.
 * - Chống join trùng: unique từng phần (scheduleId, memberId) WHERE WAITING
 *   + kiểm tra mềm trước để trả 409 thân thiện; race còn lại DB chặn (P2002).
 * - `position` = max(position WAITING của buổi) + 1 trong lock schedule
 *   → đơn điệu, deterministic, không cho sửa tay (không có API update).
 */
export async function joinWaitlist(scheduleId: string, memberProfileId: string) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class: true },
  });
  if (!schedule) throw new AppError("Schedule not found", 404);
  if (schedule.status !== "SCHEDULED")
    throw new AppError("This schedule is not available for waitlist", 400);
  if (schedule.startTime <= new Date())
    throw new AppError("Cannot join waitlist for a past class", 400);

  const memberProfile = await prisma.memberProfile.findUnique({
    where: { id: memberProfileId },
    include: { user: { select: { isActive: true, role: true } } },
  });
  if (!memberProfile || !memberProfile.user.isActive || memberProfile.user.role !== "MEMBER")
    throw new AppError("Cannot join waitlist: user is not an active MEMBER", 400);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockMemberQuota(tx, memberProfileId);
      await lockMemberClass(tx, memberProfileId, schedule.classId);
      await lockSchedule(tx, scheduleId);

      const existingEnrollment = await tx.enrollment.findUnique({
        where: { memberId_scheduleId: { memberId: memberProfileId, scheduleId } },
      });
      if (
        existingEnrollment &&
        (existingEnrollment.status === "BOOKED" || existingEnrollment.status === "COMPLETED")
      )
        throw new AppError("You are already enrolled in this class", 409);

      const existingWaiting = await tx.waitlistEntry.findFirst({
        where: { scheduleId, memberId: memberProfileId, status: "WAITING" },
      });
      if (existingWaiting)
        throw new AppError("You are already on the waitlist for this schedule", 409);

      const bookedCount = await tx.enrollment.count({
        where: { scheduleId, status: { in: ["BOOKED", "COMPLETED"] } },
      });
      if (bookedCount < schedule.class.capacity)
        throw new AppError("This class still has available slots. Please book directly.", 409);

      const last = await tx.waitlistEntry.findFirst({
        where: { scheduleId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      return tx.waitlistEntry.create({
        data: {
          scheduleId,
          memberId: memberProfileId,
          position: (last?.position ?? 0) + 1,
        },
        include: { schedule: { include: { class: true } } },
      });
    });
  } catch (err: any) {
    if (err?.code === "P2002")
      throw new AppError("You are already on the waitlist for this schedule", 409);
    throw err;
  }
}

/** Member hủy mục chờ của chính mình (WAITING → CANCELLED, CAS). */
export async function cancelWaitlistEntry(entryId: string, memberProfileId: string) {
  const updated = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, memberId: memberProfileId, status: "WAITING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (updated.count !== 1)
    throw new AppError("Waitlist entry not found or no longer active", 404);
  return prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { schedule: { include: { class: true } } },
  });
}
