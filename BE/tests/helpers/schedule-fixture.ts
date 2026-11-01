import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";

/** Test data must satisfy the same term/primary-coach constraints as real schedules. */
export function scheduleFixture(db: PrismaClient) {
  const terms = new Map<string, string>();
  const users: string[] = [];
  return {
    async create(args: { data: Prisma.ClassScheduleUncheckedCreateInput }) {
      assert.match(
        new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "",
        /^scms_verify_/,
      );
      const cls = await db.class.findUniqueOrThrow({
        where: { id: args.data.classId },
      });
      if (
        !(await db.classMember.findFirst({
          where: { classId: cls.id, isPrimary: true },
        }))
      ) {
        const user = await db.user.create({
          data: {
            email: `schedule-${randomUUID()}@test.invalid`,
            fullName: "Fixture coach",
            password: "fixture-only",
            role: "COACH",
            coachProfile: { create: {} },
          },
          include: { coachProfile: true },
        });
        users.push(user.id);
        await db.facilityStaff.create({
          data: { facilityId: cls.facilityId, userId: user.id, role: "COACH" },
        });
        await db.classMember.create({
          data: {
            classId: cls.id,
            coachId: user.coachProfile!.id,
            isPrimary: true,
          },
        });
      }
      let termId = args.data.termId ?? terms.get(cls.facilityId);
      if (!termId) {
        const start = new Date(args.data.startTime),
          end = new Date(args.data.endTime);
        const term = await db.term.create({
          data: {
            code: `fixture-${randomUUID()}`,
            name: "Fixture term",
            facilityId: cls.facilityId,
            startDate: new Date(Math.min(+start, Date.now()) - 366 * 86400000),
            endDate: new Date(Math.max(+end, Date.now()) + 366 * 86400000),
            registrationStartDate: new Date(Date.now() - 366 * 86400000),
            registrationEndDate: new Date(
              Math.max(+end, Date.now()) + 366 * 86400000,
            ),
            status: "OPEN_REGISTRATION",
          },
        });
        terms.set(cls.facilityId, term.id);
        termId = term.id;
      }
      return db.classSchedule.create({ data: { ...args.data, termId } });
    },
    // Call after deleting fixture schedules, before deleting facilities.
    async cleanup() {
      await db.term.deleteMany({ where: { id: { in: [...terms.values()] } } });
      await db.classMember.deleteMany({
        where: { coach: { userId: { in: users } } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
    },
  };
}
