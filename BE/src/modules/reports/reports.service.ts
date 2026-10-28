import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { computeAttendanceBuckets } from "../attendance/attendance-analytics.service.js";
import { expireStalePenalties } from "../attendance/attendance-penalties.service.js";

export async function getRevenueReport(startDate: string, endDate: string) {
  // BR-26: Parse as VN business day boundaries (start of startDate, end of endDate in +07:00)
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);

  // C11 — TÁCH RÕ HAI COHORT (trước đây doanh thu theo paidAt nhưng đếm/list theo createdAt):
  //  * "cash" (paidAt): tiền THỰC THU / ĐÃ HOÀN trong kỳ → revenue, refunded, net, by-method, danh sách.
  //  * "order" (createdAt): đơn được TẠO trong kỳ nhưng CHƯA/không thu được → đếm PENDING/FAILED.
  const cashFilter = { paidAt: { gte: start, lte: end } };
  const orderFilter = { createdAt: { gte: start, lte: end } };

  const [collectedAgg, refundedAgg, pendingCount, failedCount, ordersCreated, byMethod, recentPayments] =
    await Promise.all([
      prisma.payment.aggregate({
        where: { ...cashFilter, status: { in: ["SUCCESS", "REFUNDED"] } },
        _sum: { amount: true },
        _count: true,
      }),
      // Tiền đã hoàn trong kỳ — payment REFUNDED giữ `paidAt` của lần thu gốc.
      prisma.payment.aggregate({
        where: { refundedAt: { gte: start, lte: end }, status: "REFUNDED" },
        _sum: { refundedAmount: true },
        _count: true,
      }),
      prisma.payment.count({ where: { ...orderFilter, status: "PENDING" } }),
      prisma.payment.count({ where: { ...orderFilter, status: "FAILED" } }),
      prisma.payment.count({ where: orderFilter }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { ...cashFilter, status: "SUCCESS" },
        _sum: { amount: true },
        _count: true,
      }),
      // Danh sách "dòng tiền" CÙNG cohort cash (SUCCESS/REFUNDED, sắp theo paidAt) — không lẫn đơn PENDING.
      prisma.payment.findMany({
        where: { ...cashFilter, status: { in: ["SUCCESS", "REFUNDED"] } },
        include: {
          member: { include: { user: { select: { fullName: true } } } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 10,
      }),
    ]);

  const methodMap: Record<string, number> = {};
  for (const m of byMethod) methodMap[m.method] = Number(m._sum.amount ?? 0);

  const totalRevenue = Number(collectedAgg._sum.amount ?? 0);
  const refundedAmount = Number(refundedAgg._sum.refundedAmount ?? 0);
  const unreconciledRefunds = await prisma.payment.count({ where: { status: "REFUNDED", refundedAt: null } });

  return {
    /** Tiền THỰC THU trong kỳ (tổng payment SUCCESS theo `paidAt`). */
    totalRevenue,
    /** Tiền ĐÃ HOÀN trong kỳ (tổng payment REFUNDED theo `paidAt`). */
    refundedAmount,
    /** Thực nhận = totalRevenue − refundedAmount (không âm). */
    netRevenue: totalRevenue - refundedAmount,
    unreconciledRefunds,
    netRevenueVerified: unreconciledRefunds === 0,
    /** Tổng số ĐƠN được tạo trong kỳ (mọi trạng thái, theo `createdAt`). */
    totalPayments: ordersCreated,
    /** Số giao dịch THU ĐƯỢC trong kỳ (cùng cohort paidAt với totalRevenue). */
    successPayments: collectedAgg._count,
    /** Số giao dịch ĐÃ HOÀN trong kỳ (cùng cohort paidAt với refundedAmount). */
    refundedPayments: refundedAgg._count,
    /** Đơn tạo trong kỳ còn chờ thanh toán (cohort createdAt). */
    pendingPayments: pendingCount,
    /** Đơn tạo trong kỳ đã đóng/thất bại (cohort createdAt). */
    failedPayments: failedCount,
    revenueByMethod: {
      CASH: methodMap["CASH"] ?? 0,
      BANK_TRANSFER: methodMap["BANK_TRANSFER"] ?? 0,
      SEPAY: methodMap["SEPAY"] ?? 0,
    },
    recentPayments,
    note: "Thực thu theo paidAt; hoàn tiền thực tế theo refundedAt.",
  };
}

export async function getMemberReport(startDate: string, endDate: string) {
  // BR-26: VN timezone boundary
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);
  const now = new Date();

  // BR-19: Use distinct memberId to count PEOPLE not subscriptions
  const [totalMembers, newMembers, activeSubs] = await Promise.all([
    // Count members whose user is still MEMBER role and active
    prisma.memberProfile.count({
      where: { user: { role: "MEMBER", isActive: true } },
    }),
    prisma.memberProfile.count({
      where: {
        createdAt: { gte: start, lte: end },
        user: { role: "MEMBER", isActive: true },
      },
    }),
    // MF-04: đếm PEOPLE — phải dùng CÙNG cohort với totalMembers/newMembers.
    // MemberProfile KHÔNG có facilityId nên không thể scope theo cơ sở; lọc theo ORIGIN ở đây
    // từng làm `expiredMembers = totalMembers - activeCount` sai lệch (trộn 2 cohort).
    // Báo cáo theo DOANH THU / gói phát hành tách riêng ở /reports/memberships và
    // /reports/subscription-logs (vẫn ORIGIN-scoped).
    prisma.membershipSubscription.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { memberId: true, tier: true },
    }),
  ]);

  // Count distinct members (max tier per person)
  const memberTierMap: Record<string, string> = {};
  for (const s of activeSubs) {
    // Priority: PREMIUM > MEMBERSHIP
    if (!memberTierMap[s.memberId] || s.tier === "PREMIUM") {
      memberTierMap[s.memberId] = s.tier;
    }
  }

  const activeCount = Object.keys(memberTierMap).length;
  const tierCounts: Record<string, number> = { FREE: 0, MEMBERSHIP: 0, PREMIUM: 0 };
  for (const tier of Object.values(memberTierMap)) {
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }
  // Member KHÔNG có gói ACTIVE hiệu lực → coi như đang ở gói FREE mặc định (provisioning).
  // KHÔNG được ghi đè số FREE thật bằng (totalMembers - activeCount) như trước — cách cũ
  // biến member FREE đang hoạt động thành 0 khi mọi member đều FREE.
  tierCounts.FREE += Math.max(0, totalMembers - activeCount);

  return {
    totalMembers,
    newMembers,
    activeMembers: activeCount,
    expiredMembers: totalMembers - activeCount,
    membersByTier: tierCounts,
    note: "membersByTier counts PEOPLE (max tier per person), not subscriptions.",
  };
}

export async function getEnrollmentReport(startDate: string, endDate: string) {
  // BR-26: VN timezone boundary
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);
  const dateFilter = { createdAt: { gte: start, lte: end } };

  const [totalEnrollments, completedEnrollments, cancelledEnrollments, topClasses, byClassType] = await Promise.all([
    // BR-19: Count both BOOKED and COMPLETED as "enrolled" (not just BOOKED)
    prisma.enrollment.count({ where: { ...dateFilter, status: { in: ["BOOKED", "COMPLETED"] } } }),
    prisma.enrollment.count({ where: { ...dateFilter, status: "COMPLETED" } }),
    prisma.enrollment.count({ where: { ...dateFilter, status: "CANCELLED" } }),
    prisma.enrollment.groupBy({
      by: ["classId"],
      where: { ...dateFilter, status: { in: ["BOOKED", "COMPLETED"] } },
      _count: { classId: true },
      orderBy: { _count: { classId: "desc" } },
      take: 5,
    }),
    prisma.enrollment.groupBy({
      by: ["classId"],
      where: { ...dateFilter, status: { in: ["BOOKED", "COMPLETED"] } },
      _count: true,
    }),
  ]);

  // Fetch class names for top classes
  const topClassIds = topClasses.map((c) => c.classId);
  const topClassDetails = await prisma.class.findMany({
    where: { id: { in: topClassIds } },
    select: { id: true, name: true, classType: true },
  });
  const classMap = Object.fromEntries(topClassDetails.map((c) => [c.id, c]));
  const topClassesResult = topClasses.map((c) => ({
    classId: c.classId,
    className: classMap[c.classId]?.name ?? "Unknown",
    count: c._count.classId,
  }));

  // By class type
  const allClassIds = byClassType.map((c) => c.classId);
  const allClassDetails = await prisma.class.findMany({
    where: { id: { in: allClassIds } },
    select: { id: true, classType: true },
  });
  const classTypeMap = Object.fromEntries(allClassDetails.map((c) => [c.id, c.classType]));
  const byType = { REGULAR: 0, PREMIUM: 0 };
  for (const item of byClassType) {
    const type = classTypeMap[item.classId] ?? "REGULAR";
    byType[type as "REGULAR" | "PREMIUM"] = (byType[type as "REGULAR" | "PREMIUM"] ?? 0) + item._count;
  }

  return {
    totalEnrollments,
    completedEnrollments,
    cancelledEnrollments,
    topClasses: topClassesResult,
    enrollmentsByClassType: byType,
  };
}

export async function getMembershipReport(startDate: string, endDate: string, facilityIdParam?: string, termId?: string) {
  const context = requestContext.getStore();
  if (context?.role === "MANAGER" && facilityIdParam && facilityIdParam !== context.facilityId)
    throw new AppError("Báo cáo chỉ áp dụng cho cơ sở đang quản lý.", 403);
  const facilityId = facilityIdParam === "ALL" ? undefined : facilityIdParam ?? context?.facilityId;
  // Keep DAL scope consistent for payments, enrollments and subscriptions.
  return requestContext.run({ ...context, facilityId }, () => buildMembershipReport(startDate, endDate, facilityIdParam, termId));
}

async function buildMembershipReport(startDate: string, endDate: string, facilityIdParam?: string, termId?: string) {
  // BR-26: VN timezone boundary
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);
  const now = new Date();
  const dateFilter = { createdAt: { gte: start, lte: end } };

  const store = requestContext.getStore();
  const originFacilityId = facilityIdParam || store?.facilityId;

  // MF-07: fail-fast — thiếu facility context phải lỗi nếu không có facilityId và không phải ALL
  if (!originFacilityId && facilityIdParam !== "ALL") {
    throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);
  }

  const isGlobal = originFacilityId === "ALL" || !originFacilityId;
  const facilityFilter: any = isGlobal ? {} : { facilityId: originFacilityId };
  const paymentFacilityFilter: any = isGlobal ? {} : { facilityId: originFacilityId };

  const [totalSubs, newSubs, byStatus, byTier, revenueAgg, plans, periodSubs] = await Promise.all([
    prisma.membershipSubscription.count({ where: facilityFilter }),
    prisma.membershipSubscription.count({ where: { ...dateFilter, ...facilityFilter } }),
    prisma.membershipSubscription.groupBy({
      by: ["status"],
      where: facilityFilter,
      _count: true,
    }),
    // BR-19: Count subscriptions currently effective (not just in date range) by tier
    prisma.membershipSubscription.groupBy({
      by: ["tier"],
      where: {
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
        ...facilityFilter,
      },
      _count: true,
    }),
    // BR-20: Use paidAt for revenue
    prisma.payment.aggregate({
      where: {
        paidAt: { gte: start, lte: end },
        status: "SUCCESS",
        subscriptionId: { not: null },
        ...paymentFacilityFilter,
      },
      _sum: { amount: true },
    }),
    prisma.membershipPlan.findMany({
      where: { tier: { not: "FREE" } },
      orderBy: { price: "desc" },
    }),
    prisma.membershipSubscription.findMany({
      where: {
        ...dateFilter,
        ...facilityFilter,
      },
      select: {
        id: true,
        planId: true,
        memberId: true,
        tier: true,
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s.status] = s._count;

  const tierMap: Record<string, number> = { MEMBERSHIP: 0, PREMIUM: 0 };
  for (const t of byTier) tierMap[t.tier] = t._count;

  // Active subscriptions count per plan
  const activeSubsByPlan = await prisma.membershipSubscription.groupBy({
    by: ["planId"],
    where: {
      status: "ACTIVE",
      startDate: { lte: now },
      endDate: { gte: now },
      ...facilityFilter,
    },
    _count: true,
  });
  const activeSubsMap = Object.fromEntries(activeSubsByPlan.map((a) => [a.planId, a._count]));

  // Revenue per plan in the date range
  const paymentsByPlan = await prisma.payment.groupBy({
    by: ["planId"],
    where: {
      paidAt: { gte: start, lte: end },
      status: "SUCCESS",
      planId: { not: null },
      ...paymentFacilityFilter,
    },
    _sum: { amount: true },
  });
  const planRevenueMap = Object.fromEntries(paymentsByPlan.map((p) => [p.planId!, Number(p._sum.amount ?? 0)]));

  if (termId) {
    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term || (!isGlobal && term.facilityId && term.facilityId !== originFacilityId))
      throw new AppError("Kỳ học không tồn tại hoặc không thuộc phạm vi báo cáo.", 403);
  }
  // Attribute usage to the entitlement recorded when booking, including plans bought before the period.
  const usage = await requestContext.run({ ...store, facilityId: isGlobal ? undefined : originFacilityId }, () => prisma.enrollment.findMany({
    where: {
      bookedAt: { gte: start, lte: end }, status: { in: ["BOOKED", "COMPLETED"] },
      ...(termId ? { schedule: { termId } } : {}),
      ...(isGlobal ? {} : { class: { facilityId: originFacilityId } }),
    },
    select: {
      id: true, memberId: true, classId: true, subscriptionId: true,
      subscription: { select: { planId: true } },
      member: { select: { user: { select: { fullName: true } } } },
      class: { select: { id: true, name: true, classType: true, sports: { select: { name: true } } } },
    },
  }));
  const unattributedEnrollments = usage.filter((row) => !row.subscription).length;
  const enrollmentsByPlan = new Map<string, typeof usage>();
  for (const row of usage) {
    if (!row.subscription) continue;
    const list = enrollmentsByPlan.get(row.subscription.planId) ?? [];
    list.push(row);
    enrollmentsByPlan.set(row.subscription.planId, list);
  }
  const plansBreakdown = plans.map((plan) => {
    const subsForThisPlan = periodSubs.filter((s) => s.planId === plan.id);
    const soldCount = subsForThisPlan.length;
    const planMembers = Array.from(new Set(subsForThisPlan.map((s) => s.memberId)));
    const uniqueMembersCount = planMembers.length;

    const planEnrollments = enrollmentsByPlan.get(plan.id) ?? [];
    const bookingsByMember = new Map<string, typeof planEnrollments>();
    for (const row of planEnrollments) {
      const list = bookingsByMember.get(row.memberId) ?? [];
      list.push(row);
      bookingsByMember.set(row.memberId, list);
    }
    const totalClassEnrollments = planEnrollments.length;
    const enrolledMembersCount = new Set(planEnrollments.map((e) => e.memberId)).size;

    // Group by class to find top enrolled classes
    const classStatsMap = new Map<
      string,
      {
        classId: string;
        className: string;
        classType: string;
        sports: string[];
        enrollmentsCount: number;
        memberIds: Set<string>;
      }
    >();

    for (const e of planEnrollments) {
      let cs = classStatsMap.get(e.classId);
      if (!cs) {
        cs = {
          classId: e.classId,
          className: e.class.name,
          classType: e.class.classType,
          sports: e.class.sports.map((s) => s.name),
          enrollmentsCount: 0,
          memberIds: new Set<string>(),
        };
        classStatsMap.set(e.classId, cs);
      }
      cs.enrollmentsCount++;
      cs.memberIds.add(e.memberId);
    }

    const topClasses = Array.from(classStatsMap.values())
      .map((cs) => ({
        classId: cs.classId,
        className: cs.className,
        classType: cs.classType,
        sports: cs.sports,
        enrollmentsCount: cs.enrollmentsCount,
        uniqueMembersCount: cs.memberIds.size,
      }))
      .sort((a, b) => b.uniqueMembersCount - a.uniqueMembersCount || b.enrollmentsCount - a.enrollmentsCount);

    return {
      planId: plan.id,
      planName: plan.name,
      tier: plan.tier,
      price: Number(plan.price),
      durationDays: plan.durationDays,
      maxConcurrentClasses: plan.maxConcurrentClasses,
      isActive: plan.isActive,
      soldCount,
      revenue: planRevenueMap[plan.id] ?? 0,
      activeSubscribers: activeSubsMap[plan.id] ?? 0,
      uniqueMembersCount,
      enrollmentStats: {
        totalClassEnrollments,
        enrolledMembersCount,
        classRegistrationCount: new Set(planEnrollments.map((row) => row.memberId + ":" + row.classId)).size,
        topClasses,
        memberUsage: Array.from(bookingsByMember.entries()).map(([memberId, bookings]) => {
          const counts = new Map<string, { classId: string; className: string; bookings: number }>();
          for (const booking of bookings) {
            const entry = counts.get(booking.classId) ?? { classId: booking.classId, className: booking.class.name, bookings: 0 };
            entry.bookings++;
            counts.set(booking.classId, entry);
          }
          return { memberId, memberName: bookings[0].member.user.fullName, totalBookings: bookings.length,
            classes: [...counts.values()].sort((a, b) => b.bookings - a.bookings) };
        }).sort((a, b) => b.totalBookings - a.totalBookings),
      },
    };
  });

  return {
    facilityId: isGlobal ? "ALL" : originFacilityId,
    totalSubscriptions: totalSubs,
    newSubscriptions: newSubs,
    // MF-06: "đang hiệu lực" phải dùng CÙNG định nghĩa với subscriptionsByTier
    activeSubscriptions: byTier.reduce((sum, t) => sum + t._count, 0),
    expiredSubscriptions: statusMap["EXPIRED"] ?? 0,
    cancelledSubscriptions: statusMap["CANCELLED"] ?? 0,
    suspendedSubscriptions: statusMap["SUSPENDED"] ?? 0,
    subscriptionsByTier: tierMap,
    subscriptionsByStatus: statusMap,
    totalRevenue: Number(revenueAgg._sum.amount ?? 0),
    plansBreakdown,
    unattributedEnrollments,
    attributedEnrollments: usage.length - unattributedEnrollments,
    usageScope: "CLASS_FACILITY",
  };
}

export async function getSubscriptionLogs(startDate?: string, endDate?: string, pageStr?: string, limitStr?: string) {
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? "20") || 20));
  const skip = (page - 1) * limit;

  // Danh sách subscription-logs chứa PII (tên/email hội viên) → vẫn scope theo ORIGIN facility.
  // MF-07: fail-fast khi thiếu facility context (không âm thầm thành danh sách GLOBAL).
  const originFacilityId = requestContext.getStore()?.facilityId;
  if (!originFacilityId) throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);
  const where: any = { facilityId: originFacilityId };
  if (startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00+07:00`);
    const end = new Date(`${endDate}T23:59:59.999+07:00`);
    where.createdAt = { gte: start, lte: end };
  }

  const [total, subs] = await Promise.all([
    prisma.membershipSubscription.count({ where }),
    prisma.membershipSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        member: { include: { user: { select: { fullName: true, email: true } } } },
        plan: { select: { name: true, price: true } },
        payments: { select: { amount: true, status: true, paidAt: true }, take: 1, orderBy: { createdAt: "desc" } }
      }
    })
  ]);

  const formattedLogs = subs.map(sub => ({
    id: sub.id,
    action: "Mua / Gia hạn gói", // Action description as requested
    username: sub.member.user.fullName,
    email: sub.member.user.email,
    planName: sub.plan.name,
    planTier: sub.tier,
    price: Number(sub.payments[0]?.amount ?? sub.plan.price),
    paymentStatus: sub.payments[0]?.status ?? "N/A",
    startDate: sub.startDate,
    endDate: sub.endDate,
    purchasedAt: sub.createdAt, // Real-time timestamp
  }));

  return {
    data: formattedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  };
}

/**
 * Phase 3 — origin-vs-usage: "Member mua gói ở A đang dùng ở đâu?"
 * - originFacility = MembershipSubscription.facilityId (nơi phát hành gói).
 * - usageFacility = Class.facilityId của Enrollment / Facility.facilityId của Visit.
 * - Không đổi model subscription, không tạo bảng usage mới: dùng Enrollment +
 *   FacilityVisit hiện có. Báo cáo doanh thu hiện hữu KHÔNG bị sửa.
 */
export async function getCrossFacilityUsageReport(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);
  const originFacilityId = requestContext.getStore()?.facilityId;
  if (!originFacilityId) throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);

  const [enrollmentRows, visitRows, facilities] = await Promise.all([
    requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () =>
      prisma.enrollment.findMany({
        where: {
          bookedAt: { gte: start, lte: end },
          status: { in: ["BOOKED", "COMPLETED"] },
          member: { subscriptions: { some: { facilityId: originFacilityId } } },
        },
        select: {
          memberId: true,
          schedule: { select: { class: { select: { facilityId: true } } } },
        },
      }),
    ),
    requestContext.run({ ...requestContext.getStore(), facilityId: undefined }, () =>
      prisma.facilityVisit.findMany({
        where: {
          checkInAt: { gte: start, lte: end },
          member: { subscriptions: { some: { facilityId: originFacilityId } } },
        },
        select: { memberId: true, facilityId: true },
      }),
    ),
    prisma.facility.findMany({ select: { id: true, name: true, code: true } }),
  ]);

  const facilityMap = Object.fromEntries(facilities.map((f) => [f.id, f]));
  const buckets = new Map<string, { bookings: number; visits: number; members: Set<string> }>();
  const touch = (usageFacilityId: string) => {
    let bucket = buckets.get(usageFacilityId);
    if (!bucket) {
      bucket = { bookings: 0, visits: 0, members: new Set<string>() };
      buckets.set(usageFacilityId, bucket);
    }
    return bucket;
  };

  for (const row of enrollmentRows) {
    const bucket = touch(row.schedule.class.facilityId);
    bucket.bookings += 1;
    bucket.members.add(row.memberId);
  }
  for (const row of visitRows) {
    const bucket = touch(row.facilityId);
    bucket.visits += 1;
    bucket.members.add(row.memberId);
  }

  const usage = [...buckets.entries()]
    .map(([usageFacilityId, bucket]) => ({
      usageFacilityId,
      usageFacilityName: facilityMap[usageFacilityId]?.name ?? usageFacilityId,
      usageFacilityCode: facilityMap[usageFacilityId]?.code ?? null,
      bookings: bucket.bookings,
      visits: bucket.visits,
      uniqueMembers: bucket.members.size,
    }))
    .sort((a, b) => b.bookings + b.visits - (a.bookings + a.visits));

  const allMembers = new Set<string>();
  for (const bucket of buckets.values()) for (const m of bucket.members) allMembers.add(m);

  return {
    originFacilityId,
    originFacilityName: facilityMap[originFacilityId]?.name ?? originFacilityId,
    originFacilityCode: facilityMap[originFacilityId]?.code ?? null,
    startDate,
    endDate,
    totalBookings: enrollmentRows.length,
    totalVisits: visitRows.length,
    totalUniqueMembers: allMembers.size,
    usage,
  };
}

/**
 * §6: Báo cáo chuyên cần theo (member × class) cho Manager review.
 * FINAL:
 * - FIXED (có totalPlannedSessions): allowance = floor(total × 20%);
 *   < allowance NORMAL; == allowance NOTICE; > allowance WARNING.
 * - RECURRING: fallback rolling, >= 80% NORMAL; 70–<80% NOTICE; < 70% WARNING.
 * - Advisory only + penalty thủ công riêng; sort WARNING vượt allowance trước.
 */
export async function getAttendanceReport(query: {
  status?: string;
  classId?: string;
  memberId?: string;
  page?: string;
  limit?: string;
}) {
  await expireStalePenalties();

  const buckets = await computeAttendanceBuckets(prisma);
  const penalties = await prisma.attendancePenalty.findMany({
    where: { status: { in: ["PENDING", "APPLIED"] } },
    select: {
      id: true,
      memberId: true,
      classId: true,
      status: true,
      blockedUntil: true,
      releasedCount: true,
    },
  });
  const penaltyMap = new Map(penalties.map((p) => [`${p.memberId}|${p.classId}`, p]));

  let rows = buckets.map((bucket) => {
    const penalty = penaltyMap.get(`${bucket.memberId}|${bucket.classId}`);
    return {
      ...bucket,
      activePenalty: penalty
        ? {
            id: penalty.id,
            status: penalty.status,
            blockedUntil: penalty.blockedUntil,
            releasedCount: penalty.releasedCount,
          }
        : null,
    };
  });

  const summary = {
    total: rows.length,
    normal: rows.filter((r) => r.status === "NORMAL").length,
    notice: rows.filter((r) => r.status === "NOTICE").length,
    warning: rows.filter((r) => r.status === "WARNING").length,
  };

  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.classId) rows = rows.filter((r) => r.classId === query.classId);
  if (query.memberId) rows = rows.filter((r) => r.memberId === query.memberId);

  // Ưu tiên rủi ro cao trước: FIXED vượt allowance nhiều nhất, rồi tới rate thấp nhất.
  rows.sort(
    (a, b) =>
      (b.currentAbsences - b.allowedAbsences) - (a.currentAbsences - a.allowedAbsences) ||
      a.attendanceRate - b.attendanceRate ||
      b.sampleSize - a.sampleSize,
  );

  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20") || 20));
  const total = rows.length;
  const paged = rows.slice((page - 1) * limit, page * limit);

  return { rows: paged, summary, pagination: buildPaginationMeta(total, page, limit) };
}
