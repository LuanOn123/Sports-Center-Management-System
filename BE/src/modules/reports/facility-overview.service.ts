import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";

export async function getFacilityOverview(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+07:00`),
    end = new Date(`${endDate}T23:59:59.999+07:00`);
  return requestContext.run(
    { ...requestContext.getStore(), facilityId: undefined },
    async () => {
      const [
        facilities,
        collected,
        refunds,
        members,
        enrollments,
        schedules,
        classesByFacility,
        roomsByFacility,
        coachesByFacility,
        classesWithSports,
        subsByFacility,
      ] = await Promise.all([
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
        prisma.class.groupBy({
          by: ["facilityId"],
          where: { isActive: true },
          _count: true,
        }),
        prisma.room.groupBy({
          by: ["facilityId"],
          where: { isActive: true },
          _count: true,
        }),
        prisma.facilityStaff.groupBy({
          by: ["facilityId"],
          where: { role: "COACH", isActive: true },
          _count: true,
        }),
        prisma.class.findMany({
          where: { isActive: true },
          select: { facilityId: true, sports: { select: { id: true } } },
        }),
        prisma.membershipSubscription.groupBy({
          by: ["facilityId"],
          where: { facilityId: { not: null } },
          _count: true,
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
        const activeClasses =
          classesByFacility.find((c) => c.facilityId === f.id)?._count ?? 0;
        const activeRooms =
          roomsByFacility.find((r) => r.facilityId === f.id)?._count ?? 0;
        const activeCoaches =
          coachesByFacility.find((c) => c.facilityId === f.id)?._count ?? 0;
        const activeMembersCount = members.filter(
          (row) => row.facilityId === f.id,
        ).length;
        const activeSportsCount = new Set(
          classesWithSports
            .filter((c) => c.facilityId === f.id)
            .flatMap((c) => c.sports.map((s) => s.id)),
        ).size;
        const totalSubscriptionsCount =
          subsByFacility.find((s) => s.facilityId === f.id)?._count ?? 0;

        return {
          id: f.id,
          name: f.name,
          code: f.code,
          isActive: f.isActive,
          managers: f.staffs.map((s) => s.user.fullName),
          totalRevenue,
          refundedAmount,
          netRevenue: totalRevenue - refundedAmount,
          members: activeMembersCount,
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
          limits: {
            maxClasses: f.maxClasses,
            maxRooms: f.maxRooms,
            maxCoaches: f.maxCoaches,
            maxMembers: f.maxMembers,
            maxSports: f.maxSports,
          },
          usage: {
            activeClasses,
            activeRooms,
            activeCoaches,
            activeMembers: activeMembersCount,
            activeSports: activeSportsCount,
            totalSubscriptions: totalSubscriptionsCount,
            classUtilization: f.maxClasses
              ? Math.round((activeClasses / f.maxClasses) * 100)
              : null,
            roomUtilization: f.maxRooms
              ? Math.round((activeRooms / f.maxRooms) * 100)
              : null,
            coachUtilization: f.maxCoaches
              ? Math.round((activeCoaches / f.maxCoaches) * 100)
              : null,
            memberUtilization: f.maxMembers
              ? Math.round((activeMembersCount / f.maxMembers) * 100)
              : null,
            sportUtilization: f.maxSports
              ? Math.round((activeSportsCount / f.maxSports) * 100)
              : null,
          },
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
