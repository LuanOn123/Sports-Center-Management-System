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

export async function getMembershipReport(startDate: string, endDate: string) {
  // BR-26: VN timezone boundary
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T23:59:59.999+07:00`);
  const now = new Date();
  const dateFilter = { createdAt: { gte: start, lte: end } };
  // Báo cáo theo CƠ SỞ: chỉ đếm gói có ORIGIN facility = facility đang chọn (giữ nguyên
  // ngữ cảnh cũ khi MembershipSubscription còn bị DAL tự lọc). Doanh thu tính theo Payment
  // vẫn facility-scoped nên số liệu counts/revenue cùng một cohort.
  // MF-07: fail-fast — thiếu facility context phải lỗi thay vì âm thầm biến thành báo cáo GLOBAL
  // (Prisma hiểu `facilityId: undefined` là "không lọc").
  const originFacilityId = requestContext.getStore()?.facilityId;
  if (!originFacilityId) throw new AppError("FACILITY_CONTEXT_REQUIRED", 400);

  const [totalSubs, newSubs, byStatus, byTier, revenueAgg] = await Promise.all([
    prisma.membershipSubscription.count({ where: { facilityId: originFacilityId } }),
    prisma.membershipSubscription.count({ where: { ...dateFilter, facilityId: originFacilityId } }),
    prisma.membershipSubscription.groupBy({
      by: ["status"],
      where: { facilityId: originFacilityId },
      _count: true,
    }),
    // BR-19: Count subscriptions currently effective (not just in date range) by tier
    prisma.membershipSubscription.groupBy({
      by: ["tier"],
      where: {
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
        facilityId: originFacilityId,
      },
      _count: true,
    }),
    // BR-20: Use paidAt for revenue
    prisma.payment.aggregate({
      where: {
        paidAt: { gte: start, lte: end },
        status: "SUCCESS",
        subscriptionId: { not: null },
      },
      _sum: { amount: true },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s.status] = s._count;

  const tierMap: Record<string, number> = { MEMBERSHIP: 0, PREMIUM: 0 };
  for (const t of byTier) tierMap[t.tier] = t._count;

  return {
    totalSubscriptions: totalSubs,
    newSubscriptions: newSubs,
    // MF-06: "đang hiệu lực" phải dùng CÙNG định nghĩa với subscriptionsByTier
    // (status ACTIVE + startDate <= now <= endDate). Đếm theo `status` thuần túy từng tính cả
    // gói renewed chưa tới startDate (stacking) và gói quá hạn nhưng chưa được job chuyển EXPIRED.
    activeSubscriptions: byTier.reduce((sum, t) => sum + t._count, 0),
    expiredSubscriptions: statusMap["EXPIRED"] ?? 0,
    cancelledSubscriptions: statusMap["CANCELLED"] ?? 0,
    suspendedSubscriptions: statusMap["SUSPENDED"] ?? 0,
    subscriptionsByTier: tierMap,
    totalRevenue: Number(revenueAgg._sum.amount ?? 0),
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
