import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";

export async function getFacilityOverview(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+07:00`),
    end = new Date(`${endDate}T23:59:59.999+07:00`);
  return requestContext.run(
    { ...requestContext.getStore(), facilityId: undefined },
    async () => {
      const [facilities, collected, refunds, members, enrollments, schedules] =
        await Promise.all([
          prisma.facility.findMany({
            include: {
              staffs: {
                where: { role: "MANAGER", isActive: true },
                include: { user: { select: { fullName: true } } },
              },
            },
            orderBy: { name: "asc" },
          }),
          prisma.payment.groupBy({
            by: ["facilityId"],
            where: {
              status: { in: ["SUCCESS", "REFUNDED"] },
              paidAt: { gte: start, lte: end },
            },
            _sum: { amount: true },
          }),
          prisma.payment.groupBy({
            by: ["facilityId"],
            where: { status: "REFUNDED", refundedAt: { gte: start, lte: end } },
            _sum: { refundedAmount: true },
          }),
          prisma.membershipSubscription.findMany({
            where: {
              facilityId: { not: null },
              tier: { not: "FREE" },
              member: { user: { role: "MEMBER", isActive: true } },
            },
            select: { facilityId: true, memberId: true },
            distinct: ["facilityId", "memberId"],
          }),
          prisma.enrollment.findMany({
            where: { bookedAt: { gte: start, lte: end } },
            select: {
              status: true,
              memberId: true,
              class: { select: { facilityId: true } },
            },
          }),
          prisma.classSchedule.findMany({
            where: { startTime: { gte: start, lte: end } },
            select: { status: true, class: { select: { facilityId: true } } },
          }),
        ]);
      const rows = facilities.map((f) => {
        const totalRevenue = Number(
          collected.find((row) => row.facilityId === f.id)?._sum.amount ?? 0,
        );
        const refundedAmount = Number(
          refunds.find((row) => row.facilityId === f.id)?._sum.refundedAmount ??
            0,
        );
        const bookings = enrollments.filter(
          (row) => row.class.facilityId === f.id,
        );
        const sessions = schedules.filter(
          (row) => row.class.facilityId === f.id,
        );
        return {
          id: f.id,
          name: f.name,
          code: f.code,
          isActive: f.isActive,
          managers: f.staffs.map((s) => s.user.fullName),
          totalRevenue,
          refundedAmount,
          netRevenue: totalRevenue - refundedAmount,
          members: members.filter((row) => row.facilityId === f.id).length,
          participants: new Set(
            bookings
              .filter((row) => row.status !== "CANCELLED")
              .map((row) => row.memberId),
          ).size,
          bookings: bookings.filter((row) => row.status !== "CANCELLED").length,
          cancelledBookings: bookings.filter(
            (row) => row.status === "CANCELLED",
          ).length,
          sessions: sessions.length,
          scheduledSessions: sessions.filter(
            (row) => row.status === "SCHEDULED",
          ).length,
        };
      });
      return {
        startDate,
        endDate,
        facilities: rows,
        totalMembers: new Set(members.map((row) => row.memberId)).size,
        totalRevenue: rows.reduce((sum, row) => sum + row.totalRevenue, 0),
        refundedAmount: rows.reduce((sum, row) => sum + row.refundedAmount, 0),
        netRevenue: rows.reduce((sum, row) => sum + row.netRevenue, 0),
        totalBookings: rows.reduce((sum, row) => sum + row.bookings, 0),
      };
    },
  );
}
