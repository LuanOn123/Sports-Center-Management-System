import { activateMemberDue } from "../subscriptions/entitlement.service.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { requestContext } from "../../config/request-context.js";

import { assertCanBook } from "../enrollments/enrollments.service.js";
import { enqueueNotification, flushNotificationOutbox } from "../notifications/outbox.service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

const enrollmentInclude = {
  schedule: { include: { class: { include: { sports: true } }, room: true } },
} as const;

/**
 * Promotion sau khi có chỗ trống: duyệt WAITING theo position, member đầu tiên
 * còn đủ điều kiện (tái dùng `assertCanBook` đầy đủ: gói/tier/quota/capacity/
 * trùng giờ/phạt) được tạo Enrollment + đánh PROMOTED. Member không còn đủ
 * điều kiện → bỏ qua (giữ WAITING) và xét tiếp người sau.
 *
 * An toàn race: caller (cancelEnrollment) phải giữ `lockSchedule` trước khi gọi;
 * tạo Enrollment + PROMOTED nằm CÙNG transaction với cancel → 2 cancel đồng thời
 * không promote 2 lần cho 1 slot. Claim từng entry bằng CAS
 * (status WAITING → PROMOTED) để worker/request đua không đôn trùng.
 *
 * Trả về enrollment mới + entry được promote, hoặc null nếu không ai đủ điều kiện.
 */
export async function promoteNextEligible(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  freshSchedule: { id: string; startTime: Date; endTime: Date; class: { id: string; classType: string; capacity: number } },
) {
  const waiting = await tx.waitlistEntry.findMany({
    where: { scheduleId, status: "WAITING" },
    orderBy: { position: "asc" },
  });

  for (const entry of waiting) {
    // Lock theo member được promote để serialize với booking khác của họ.
    const keys = ["membership:member:" + entry.memberId, "enrollment:member-quota:" + entry.memberId,
      "enrollment:member-class:" + entry.memberId + ":" + freshSchedule.class.id];
    // Xact advisory locks cannot be unlocked one by one, but rolling back to a savepoint releases
    // the ones taken after it — so a skipped (busy) candidate keeps none of their locks.
    await tx.$executeRaw`SAVEPOINT waitlist_candidate_locks`;
    let acquired = true;
    for (const key of keys) {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
      if (!rows[0]?.locked) { acquired = false; break; }
    }
    if (!acquired) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT waitlist_candidate_locks`;
      continue;
    }
    await tx.$executeRaw`RELEASE SAVEPOINT waitlist_candidate_locks`;
    await activateMemberDue(tx, entry.memberId);

    let existing: any = null;
    let subscriptionId: string | undefined;
    try {
      existing = await assertCanBook(tx, entry.memberId, freshSchedule as any, { onSubscriptionSelected: (id) => { subscriptionId = id; } });
    } catch {
      continue;
    }

    const claimed = await tx.waitlistEntry.updateMany({
      where: { id: entry.id, status: "WAITING" },
      data: { status: "PROMOTED", promotedAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const enrolled = existing
      ? await tx.enrollment.update({
          where: { id: existing.id },
          data: { status: "BOOKED", bookedAt: new Date(), cancelledAt: null, subscriptionId, termMembershipGrant: Prisma.DbNull },
          include: {
            ...enrollmentInclude,
            member: { select: { id: true, userId: true } },
          },
        })
      : await tx.enrollment.create({
          data: {
            subscriptionId,
            memberId: entry.memberId,
            classId: freshSchedule.class.id,
            scheduleId,
            status: "BOOKED",
          },
          include: {
            ...enrollmentInclude,
            member: { select: { id: true, userId: true } },
          },
        });

    const startStr = freshSchedule.startTime.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const className = (enrolled as any).schedule?.class?.name ?? "lớp học";
    await enqueueNotification(tx, {
      userId: (enrolled as any).member.userId,
      type: "ENROLLMENT_CONFIRMED",
      title: `Được xếp chỗ từ waitlist: ${className}`,
      body: `Bạn đã được xếp chỗ vào "${className}" lúc ${startStr} từ danh sách chờ. Chúc bạn tập luyện vui vẻ!`,
      metadata: { scheduleId, enrollmentId: enrolled.id, waitlistEntryId: entry.id },
    });

    return { enrollment: enrolled, entry };
  }

  return null;
}

/** Lịch chờ của chính member — GLOBAL (mọi cơ sở). */
export async function getMyWaitlist(memberProfileId: string, query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = { memberId: memberProfileId };
  if (query.status) where.status = query.status;
  if (query.scheduleId) where.scheduleId = query.scheduleId;

  const [total, entries] = await requestContext.run(
    { ...requestContext.getStore(), facilityId: undefined },
    () =>
      Promise.all([
        prisma.waitlistEntry.count({ where }),
        prisma.waitlistEntry.findMany({
          where,
          skip,
          take: limit,
          include: {
            schedule: {
              include: {
                class: {
                  include: {
                    sports: true,
                    facility: { select: { id: true, name: true, code: true } },
                  },
                },
                room: true,
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        }),
      ]),
  );
  return { entries, pagination: buildPaginationMeta(total, page, limit) };
}

/** Staff xem waitlist của 1 buổi — FACILITY-SCOPED qua DAL (Schedule → Class). */
export async function listScheduleWaitlist(scheduleId: string, query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = { scheduleId };
  if (query.status) where.status = query.status;

  const [total, entries] = await Promise.all([
    prisma.waitlistEntry.count({ where }),
    prisma.waitlistEntry.findMany({
      where,
      skip,
      take: limit,
      include: {
        member: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    }),
  ]);
  return { entries, pagination: buildPaginationMeta(total, page, limit) };
}

/** Gửi outbox sau commit (dùng cho promotion kích hoạt từ cancel). */
export async function flushWaitlistNotifications() {
  await flushNotificationOutbox().catch(() => {});
}

export type { DbClient };
