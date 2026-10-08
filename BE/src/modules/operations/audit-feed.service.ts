import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";

export async function getAuditFeed(
  role: string,
  query: { skip?: string; entity?: string; filterFacilityId?: string },
) {
  return requestContext.run(
    {
      ...requestContext.getStore(),
      ...(role === "ADMIN" ? { facilityId: undefined } : {}),
    },
    async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          ...(query.entity ? { entity: query.entity } : {}),
          ...(role === "ADMIN" && query.filterFacilityId
            ? { facilityId: query.filterFacilityId }
            : {}),
        },
        take: 100,
        skip: Math.max(0, parseInt(query.skip ?? "0", 10) || 0),
        orderBy: { createdAt: "desc" },
        include: { facility: { select: { name: true } } },
      });
      const [actors, schedules, enrollments] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: [...new Set(rows.map((row) => row.actorId))] } },
          select: { id: true, fullName: true, role: true },
        }),
        prisma.classSchedule.findMany({
          where: {
            id: {
              in: rows
                .filter((row) => row.entity === "ClassSchedule" && row.entityId)
                .map((row) => row.entityId!),
            },
          },
          include: {
            class: { select: { name: true } },
            room: { select: { name: true } },
          },
        }),
        prisma.enrollment.findMany({
          where: {
            id: {
              in: rows
                .filter((row) => row.entity === "Enrollment" && row.entityId)
                .map((row) => row.entityId!),
            },
          },
          include: {
            class: { select: { name: true } },
            member: { include: { user: { select: { fullName: true } } } },
            schedule: { select: { startTime: true } },
          },
        }),
      ]);
      return rows.map((row) => {
        const session =
          row.entity === "ClassSchedule"
            ? schedules.find((s) => s.id === row.entityId)
            : undefined;
        const booking =
          row.entity === "Enrollment"
            ? enrollments.find((e) => e.id === row.entityId)
            : undefined;
        return {
          ...row,
          actor: actors.find((a) => a.id === row.actorId) ?? null,
          subject: booking
            ? `${booking.member.user.fullName} · ${booking.class.name}`
            : session
              ? `${session.class.name} · ${session.room.name}`
              : null,
          sessionStart:
            booking?.schedule.startTime ?? session?.startTime ?? null,
        };
      });
    },
  );
}
