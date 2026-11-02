import { Prisma } from "@prisma/client";
import { requestContext } from "../../config/request-context.js";
import { lockMemberQuota, lockMemberClass, lockSchedule, lockMemberSubscription } from "../../utils/dbLocks.js";
import { readTermMembershipGrant, termMembershipCovers } from "../enrollments/term-membership-policy.js";
import { AppError } from "../../middlewares/errorHandler.js";

export async function isGrantSourceValid(db: any, value: unknown) {
  const grant = readTermMembershipGrant(value);
  if (!grant) return false;
  const source = await db.membershipSubscription.findFirst({
    where: {
      id: grant.subscriptionId,
      memberId: grant.memberId,
      status: { not: "CANCELLED" },
      cancelledAt: null,
      payments: { some: { status: "SUCCESS" } },
    },
    select: { id: true },
  });
  return source?.id === grant.subscriptionId;
}

/** Reads never mutate subscriptions. A paid scheduled period becomes effective at its start. */
export async function readEffectiveSubscription(
  db: any,
  memberId: string,
  now = new Date(),
) {
  const due = await db.membershipSubscription.findFirst({
    where: {
      memberId,
      status: "SCHEDULED",
      startDate: { lte: now },
      endDate: { gt: now },
      payments: { some: { status: "SUCCESS" } },
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    include: { plan: true },
  });
  if (due) return { ...due, status: "ACTIVE", persistedStatus: "SCHEDULED" };
  return db.membershipSubscription.findFirst({
    where: {
      memberId,
      status: "ACTIVE",
      startDate: { lte: now },
      endDate: { gt: now },
    },
    orderBy: [{ tier: "desc" }, { endDate: "desc" }],
    include: { plan: true },
  });
}

/** Shared with the job; cancellation/purchase use the same member lock. */
export async function activateDueSubscription(
  tx: any,
  id: string,
  memberId: string,
  now = new Date(),
) {
  await lockMemberSubscription(tx, memberId);
  const due = await tx.membershipSubscription.findFirst({
    where: {
      id,
      memberId,
      status: "SCHEDULED",
      startDate: { lte: now },
      endDate: { gt: now },
      payments: { some: { status: "SUCCESS" } },
    },
  });
  if (!due) {
    await tx.membershipSubscription.updateMany({
      where: { id, memberId, status: "SCHEDULED", endDate: { lte: now } },
      data: { status: "EXPIRED" },
    });
    return false;
  }
  // Suspend before activation so the partial ACTIVE unique index is never violated.
  await tx.membershipSubscription.updateMany({
    where: { memberId, status: "ACTIVE", id: { not: id } },
    data: { status: "SUSPENDED", suspendedAt: now },
  });
  const changed = await tx.membershipSubscription.updateMany({
    where: {
      id,
      status: "SCHEDULED",
      endDate: { gt: now },
      payments: { some: { status: "SUCCESS" } },
    },
    data: { status: "ACTIVE" },
  });
  if (changed.count !== 1)
    throw new AppError("Trạng thái gói đã thay đổi. Vui lòng tải lại.", 409, {
      code: "SUBSCRIPTION_STATE_CHANGED",
    });
  return true;
}

export async function activateMemberDue(
  tx: any,
  memberId: string,
  now = new Date(),
) {
  const due = await tx.membershipSubscription.findFirst({
    where: { memberId, status: "SCHEDULED", startDate: { lte: now } },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return due ? activateDueSubscription(tx, due.id, memberId, now) : false;
}

/** Revoke only rights funded by this subscription, across facilities. History is retained. */
export async function revokeSubscriptionBookings(
  tx: Prisma.TransactionClient,
  subscription: { id: string; memberId: string },
  now = new Date(),
) {
  const context = requestContext.getStore();
  return requestContext.run({ ...context, facilityId: undefined }, async () => {
    await lockMemberQuota(tx, subscription.memberId);
    const candidates = await tx.enrollment.findMany({
      where: { memberId: subscription.memberId, status: "BOOKED", schedule: { endTime: { gt: now } } },
      include: { schedule: true, class: { select: { facilityId: true, classType: true } } },
    });
    const alternatives = await tx.membershipSubscription.findMany({
      where: { memberId: subscription.memberId, id: { not: subscription.id }, cancelledAt: null,
        tier: { not: "FREE" }, status: { in: ["ACTIVE", "SCHEDULED"] },
        payments: { some: { status: "SUCCESS" } } },
    });
    const ids: string[] = [];
    for (const row of candidates) {
      const grant = readTermMembershipGrant(row.termMembershipGrant);
      const fundedBySource = row.subscriptionId === subscription.id || grant?.subscriptionId === subscription.id;
      if (fundedBySource) { ids.push(row.id); continue; }
      // Unknown legacy sources are retained only when an independent paid right covers the session.
      if (row.subscriptionId !== null) continue;
      if (grant && termMembershipCovers(row.termMembershipGrant, {
        memberId: row.memberId, classId: row.classId, termId: row.schedule.termId,
        startTime: row.schedule.startTime, endTime: row.schedule.endTime,
      }) && await isGrantSourceValid(tx, row.termMembershipGrant)) continue;
      const covered = alternatives.some(other => other.startDate <= row.schedule.startTime &&
        other.endDate >= row.schedule.endTime && (row.class.classType !== "PREMIUM" || other.tier === "PREMIUM"));
      if (!covered) ids.push(row.id);
    }
    const before = candidates.filter(row => ids.includes(row.id));
    for (const classId of [...new Set(before.map(row => row.classId))].sort())
      await lockMemberClass(tx, subscription.memberId, classId);
    for (const scheduleId of [...new Set(before.map(row => row.scheduleId))].sort())
      await lockSchedule(tx, scheduleId);
    const where: Prisma.EnrollmentWhereInput = {
      id: { in: ids }, memberId: subscription.memberId, status: "BOOKED",
    };
    const changed = await tx.enrollment.updateMany({
      where, data: { status: "CANCELLED", cancelledAt: now, termMembershipGrant: Prisma.DbNull },
    });
    const { promoteNextEligible } = await import("../waitlist/waitlist.promotion.js");
    for (const scheduleId of [...new Set(before.map(row => row.scheduleId))].sort()) {
      const schedule = await tx.classSchedule.findUnique({ where: { id: scheduleId }, include: { class: true } });
      if (schedule?.status === "SCHEDULED" && schedule.startTime > now)
        await promoteNextEligible(tx, scheduleId, schedule);
    }
    if (context?.actorId) for (const facilityId of new Set(before.map(row => row.class.facilityId))) {
      const rows = before.filter(row => row.class.facilityId === facilityId);
      await requestContext.run({ ...context, facilityId }, () => tx.auditLog.create({
        data: { facilityId, actorId: context.actorId!, entity: "Enrollment", entityId: subscription.id,
          action: "revokeEntitlement", reason: context.reason ?? "Subscription cancelled or refunded",
          before: rows.map(row => ({ id: row.id, status: row.status, subscriptionId: row.subscriptionId })),
          after: rows.map(row => ({ id: row.id, status: "CANCELLED", cancelledAt: now.toISOString() })) },
      }));
    }
    return changed;
  });
}
