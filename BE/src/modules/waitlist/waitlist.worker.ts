import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import {
  promoteNextEligible,
  flushWaitlistNotifications,
} from "./waitlist.promotion.js";

/** Retry a temporarily busy candidate without a blocking schedule -> member lock edge. */
export async function runWaitlistPromotions() {
  const available = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "ClassSchedule" s JOIN "Class" c ON c.id = s."classId"
    WHERE s.status = 'SCHEDULED' AND s."startTime" > NOW() AND c."isActive"
      AND EXISTS (SELECT 1 FROM "WaitlistEntry" w WHERE w."scheduleId" = s.id AND w.status = 'WAITING')
      AND (SELECT COUNT(*) FROM "Enrollment" e WHERE e."scheduleId" = s.id AND e.status IN ('BOOKED','COMPLETED')) < c.capacity
    ORDER BY s."startTime", s.id LIMIT 100`;
  let promoted = 0;
  for (const row of available) {
    promoted += await prisma.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext('enrollment:schedule:' || ${row.id}::text)) AS locked`;
      if (!locks[0]?.locked) return 0;
      const schedule = await tx.classSchedule.findUnique({
        where: { id: row.id },
        include: { class: true },
      });
      if (
        !schedule ||
        schedule.status !== "SCHEDULED" ||
        schedule.startTime <= new Date()
      )
        return 0;
      return requestContext.run(
        {
          ...requestContext.getStore(),
          facilityId: schedule.class.facilityId,
          actorId: "system:waitlist",
          reason: "Retry eligible waitlist after temporary contention",
        },
        async () => {
          let count = 0;
          for (let i = 0; i < Math.min(schedule.class.capacity, 100); i++) {
            if (!(await promoteNextEligible(tx, schedule.id, schedule))) break;
            count++;
          }
          return count;
        },
      );
    });
  }
  if (promoted) await flushWaitlistNotifications();
  return { promoted };
}
