import dotenv from "dotenv";
dotenv.config({ path: ".env.test", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestContext } from "../src/config/request-context.js";

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { bookClass, transferEnrollment } =
    await import("../src/modules/enrollments/enrollments.service.js");
  const { enrollWholeCourse } =
    await import("../src/modules/enrollments/course-enrollment.service.js");
  const { updateSchedule } =
    await import("../src/modules/class-schedules/class-schedules.service.js");
  const run = randomUUID();
  const facilities: string[] = [],
    users: string[] = [],
    classes: string[] = [];
  let memberId = "",
    planId = "";
  const scope = <T>(i: number, fn: () => Promise<T>) =>
    requestContext.run(
      {
        facilityId: facilities[i],
        actorId: "cross-facility-test",
        role: "ADMIN",
      },
      fn,
    );
  const reject409 = (error: any) => error.statusCode === 409;
  try {
    const user = await prisma.user.create({
      data: {
        email: run + "@test.invalid",
        fullName: "Cross facility member",
        password: "fixture-only",
        role: "MEMBER",
      },
    });
    users.push(user.id);
    const member = await prisma.memberProfile.create({
      data: { userId: user.id },
    });
    memberId = member.id;
    const plan = await prisma.membershipPlan.create({
      data: {
        name: run,
        tier: "MEMBERSHIP",
        price: 300000,
        durationDays: 30,
        maxConcurrentClasses: 3,
      },
    });
    planId = plan.id;
    const start = new Date(Date.now() + 3 * 86400000),
      end = new Date(+start + 3600000);
    const sessions: { id: string; classId: string }[] = [];
    for (let i = 0; i < 2; i++) {
      const facility = await prisma.facility.create({
        data: { code: run + i, name: "Test " + i, address: "Fixture" },
      });
      facilities.push(facility.id);
      const room = await prisma.room.create({
        data: {
          facilityId: facility.id,
          name: run + "room" + i,
          capacity: 10,
          areaType: "INDOOR",
        },
      });
      const coachUser = await prisma.user.create({
        data: {
          email: run + "coach" + i + "@test.invalid",
          fullName: "Coach " + i,
          password: "fixture-only",
          role: "COACH",
        },
      });
      users.push(coachUser.id);
      const coach = await prisma.coachProfile.create({
        data: { userId: coachUser.id },
      });
      await prisma.facilityStaff.create({
        data: { facilityId: facility.id, userId: coachUser.id, role: "COACH" },
      });
      const cls = await prisma.class.create({
        data: {
          facilityId: facility.id,
          name: run + "class" + i,
          capacity: 10,
          areaType: "INDOOR",
        },
      });
      classes.push(cls.id);
      await prisma.classMember.create({
        data: { classId: cls.id, coachId: coach.id, isPrimary: true },
      });
      sessions.push(
        await prisma.classSchedule.create({
          data: {
            classId: cls.id,
            roomId: room.id,
            startTime: new Date(+start + i * 1800000),
            endTime: new Date(+end + i * 1800000),
          },
        }),
      );
    }
    await prisma.membershipSubscription.create({
      data: {
        facilityId: facilities[0],
        memberId,
        planId,
        tier: "MEMBERSHIP",
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        maxConcurrentClassesSnapshot: 3,
      },
    });
    await assert.rejects(
      scope(1, () => bookClass(sessions[1].id, memberId, "MEMBER")),
      (e: any) => e.statusCode === 403,
    );
    console.log("PASS a facility A subscription cannot book at facility B");
    await prisma.membershipSubscription.create({
      data: {
        facilityId: facilities[1],
        memberId,
        planId,
        tier: "MEMBERSHIP",
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        maxConcurrentClassesSnapshot: 3,
      },
    });
    await scope(0, () => bookClass(sessions[0].id, memberId, "MEMBER"));
    await assert.rejects(
      scope(1, () => bookClass(sessions[1].id, memberId, "MEMBER")),
      reject409,
    );
    await assert.rejects(
      scope(1, () => enrollWholeCourse(sessions[1].classId, memberId)),
      reject409,
    );
    console.log(
      "PASS single-session and whole-course bookings reject overlap across facilities even with two valid subscriptions",
    );
    const other = await prisma.classSchedule.create({
      data: {
        classId: sessions[1].classId,
        roomId: (
          await prisma.classSchedule.findUniqueOrThrow({
            where: { id: sessions[1].id },
          })
        ).roomId,
        startTime: end,
        endTime: new Date(+end + 3600000),
      },
    });
    const bookedB = await scope(1, () =>
      bookClass(other.id, memberId, "MEMBER"),
    );
    await assert.rejects(
      scope(1, () =>
        transferEnrollment(bookedB.id, sessions[1].id, user.id, "MEMBER"),
      ),
      reject409,
    );
    assert.equal(
      (await prisma.enrollment.findUniqueOrThrow({ where: { id: bookedB.id } }))
        .status,
      "BOOKED",
    );
    console.log(
      "PASS touching time boundaries are allowed; a conflicting transfer rolls back and preserves the original seat",
    );
    // Cancel the unbooked overlapping session so the move is tested against the
    // member's booking at A, rather than a room/coach collision at B.
    await prisma.classSchedule.update({
      where: { id: sessions[1].id },
      data: { status: "CANCELLED" },
    });
    await assert.rejects(
      scope(1, () =>
        updateSchedule(other.id, { startTime: start, endTime: end }),
      ),
      reject409,
    );
    assert.equal(
      +(
        await prisma.classSchedule.findUniqueOrThrow({
          where: { id: other.id },
        })
      ).startTime,
      +end,
    );
    console.log(
      "PASS moving a booked session cannot create a member conflict at another facility",
    );
    await prisma.enrollment.deleteMany({ where: { memberId } });
    await prisma.classSchedule.update({
      where: { id: sessions[1].id },
      data: { status: "SCHEDULED" },
    });
    const race = await Promise.allSettled(
      sessions.map((s, i) =>
        scope(i, () => bookClass(s.id, memberId, "MEMBER")),
      ),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(race.filter((r) => r.status === "rejected").length, 1);
    assert.equal(
      await prisma.enrollment.count({ where: { memberId, status: "BOOKED" } }),
      1,
    );
    console.log(
      "PASS simultaneous cross-facility requests create exactly one overlapping booking",
    );
  } finally {
    if (memberId) {
      await prisma.enrollment.deleteMany({ where: { memberId } });
      await prisma.membershipSubscription.deleteMany({ where: { memberId } });
    }
    await prisma.notificationOutbox.deleteMany({
      where: { userId: { in: users } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.classSchedule.deleteMany({
      where: { classId: { in: classes } },
    });
    await prisma.classMember.deleteMany({
      where: { classId: { in: classes } },
    });
    await prisma.class.deleteMany({ where: { id: { in: classes } } });
    await prisma.auditLog.deleteMany({
      where: { facilityId: { in: facilities } },
    });
    await prisma.room.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (planId) await prisma.membershipPlan.delete({ where: { id: planId } });
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
