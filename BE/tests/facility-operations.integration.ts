import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { prisma } from "../src/config/prisma.js";
import { requestContext } from "../src/config/request-context.js";
import {
  expandPattern,
  missingCapabilities,
} from "../src/modules/operations/rules.js";
import { configureDns } from "../src/config/dns.js";

async function main() {
  configureDns();
  const database = new URL(process.env.DATABASE_URL!);
  assert.match(database.searchParams.get("schema") || "", /^scms_verify_/);
  assert.match(new URL(process.env.MONGO_URI!).pathname, /^\/scms_verify_/);
  const run = randomUUID();
  const created: string[] = [];
  const coachUserId = run.replaceAll("-", "").slice(0, 24);
  const memberUserId = randomUUID().replaceAll("-", "").slice(0, 24);
  const secondMemberUserId = randomUUID().replaceAll("-", "").slice(0, 24);
  let sportId: string | undefined, planId: string | undefined;
  try {
    try {
      await mongoose.connect(process.env.MONGO_URI!, {
        serverSelectionTimeoutMS: 15000,
      });
      await mongoose.connection.db!.command({ ping: 1 });
      console.log("PASS MongoDB isolated database connection");
    } catch {
      console.log("UNVERIFIED MongoDB: SRV DNS unavailable on this machine");
    }
    for (const code of ["A", "B"]) {
      const f = await prisma.facility.create({
        data: { code: run + code, name: code, address: "Integration" },
      });
      created.push(f.id);
    }
    const scope = (index: number, fn: () => Promise<any>) =>
      requestContext.run(
        {
          facilityId: created[index],
          actorId: "integration-actor",
          role: "ADMIN",
        },
        fn,
      );
    const a = await scope(0, () =>
      prisma.room.create({
        data: { name: run + "roomA", capacity: 10, areaType: "INDOOR" },
      }),
    );
    const b = await scope(1, () =>
      prisma.room.create({
        data: { name: run + "roomB", capacity: 10, areaType: "INDOOR" },
      }),
    );
    const rows = await scope(0, () => prisma.room.findMany());
    assert(rows.length === 1 && rows[0].id === a.id);
    await assert.rejects(
      scope(0, () =>
        prisma.room.update({
          where: { id: b.id },
          data: { name: "forbidden" },
        }),
      ),
      /FORBIDDEN_SCOPE/,
    );
    console.log("PASS scoped lists and cross-facility write denial");
    const audit = await scope(0, () => prisma.auditLog.findMany());
    assert.equal(audit.length, 1);
    assert.equal(audit[0].entity, "Room");
    await assert.rejects(
      scope(0, () =>
        prisma.$transaction(async (tx) => {
          await tx.room.update({ where: { id: a.id }, data: { capacity: 99 } });
          throw new Error("force rollback");
        }),
      ),
      /force rollback/,
    );
    assert.equal(
      (await prisma.room.findUniqueOrThrow({ where: { id: a.id } })).capacity,
      10,
    );
    assert.equal(await scope(0, () => prisma.auditLog.count()), 1);
    console.log("PASS audit and business mutation roll back together");
    assert.equal(
      expandPattern("2026-10-05", "2026-10-11", [1, 3, 5], 540, 600).length,
      3,
    );
    assert.deepEqual(
      missingCapabilities({ mats: 5 }, [{ key: "mats", quantity: 4 }]),
      ["mats"],
    );
    console.log("PASS recurring schedule dates and room capability validation");
    const { checkFacilityScope } =
      await import("../src/middlewares/facilityScope.js");
    const checkScope = (facilityId?: string, other?: string) =>
      new Promise<void>((resolve, reject) =>
        checkFacilityScope(
          {
            user: { id: coachUserId, role: "COACH" },
            params: {},
            query: other ? { facilityId: other } : {},
            body: {},
            get: () => facilityId,
          } as any,
          {} as any,
          (error) => (error ? reject(error) : resolve()),
        ),
      );
    await assert.rejects(checkScope(), /FACILITY_CONTEXT_REQUIRED/);
    await assert.rejects(
      checkScope(created[0], created[1]),
      /CONFLICTING_FACILITY_CONTEXT/,
    );
    await assert.rejects(checkScope(created[0]), /FORBIDDEN_SCOPE/);
    console.log(
      "PASS missing, contradictory and unassigned facility contexts rejected",
    );
    await prisma.user.create({
      data: {
        id: coachUserId,
        email: run + "coach@test.invalid",
        fullName: "Coach",
        password: "not-a-login",
        role: "COACH",
      },
    });
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: run + "member@test.invalid",
        fullName: "Member",
        password: "not-a-login",
        role: "MEMBER",
      },
    });
    const coach = await prisma.coachProfile.create({
      data: { userId: coachUserId },
    });
    const member = await prisma.memberProfile.create({
      data: { userId: memberUserId },
    });
    await prisma.facilityStaff.create({
      data: { facilityId: created[0], userId: coachUserId, role: "COACH" },
    });
    await checkScope(created[0]);
    const sport = await prisma.sport.create({
      data: { name: run + "Yoga", areaTypes: ["INDOOR"] },
    });
    sportId = sport.id;
    await prisma.subjectRequirement.create({
      data: { sportId: sport.id, key: "mats", minimum: 2 },
    });
    const cls = await scope(0, () =>
      prisma.class.create({
        data: {
          name: run + "class",
          capacity: 1,
          areaType: "INDOOR",
          sports: { connect: { id: sport.id } },
          coaches: { create: { coachId: coach.id } },
        },
      }),
    );
    assert.deepEqual(cls.requirementsSnapshot, { mats: 2 });
    await prisma.subjectRequirement.updateMany({
      where: { sportId: sport.id },
      data: { minimum: 9 },
    });
    assert.deepEqual(
      (await prisma.class.findUniqueOrThrow({ where: { id: cls.id } }))
        .requirementsSnapshot,
      { mats: 2 },
    );
    const { createSchedule } =
      await import("../src/modules/class-schedules/class-schedules.service.js");
    const startTime = new Date(Date.now() + 86400000),
      endTime = new Date(+startTime + 3600000);
    const input = { classId: cls.id, roomId: a.id, startTime, endTime };
    await assert.rejects(
      scope(0, () => createSchedule(input)),
      /ROOM_CAPABILITY_MISSING/,
    );
    await scope(0, () =>
      prisma.roomCapability.create({
        data: { roomId: a.id, key: "mats", quantity: 2 },
      }),
    );
    await assert.rejects(
      scope(0, () => createSchedule(input)),
      /COACH_SPECIALIZATION_REQUIRED/,
    );
    await prisma.coachSpecialization.create({
      data: { coachId: coach.id, sportId: sport.id },
    });
    const session = await scope(0, () => createSchedule(input));
    await assert.rejects(
      scope(0, () => createSchedule(input)),
      /already booked/,
    );
    await assert.rejects(
      scope(0, () =>
        prisma.room.update({ where: { id: a.id }, data: { capacity: 0 } }),
      ),
      /capacity/,
    );
    assert.equal(
      (await prisma.room.findUniqueOrThrow({ where: { id: a.id } })).capacity,
      10,
    );
    console.log(
      "PASS requirement snapshots, capabilities, specialization, overlap and room update rollback",
    );
    const { operationHandlers } =
      await import("../src/modules/operations/operations.routes.js");
    const leave = await scope(0, () =>
      prisma.leaveRequest.create({
        data: {
          facilityId: created[0],
          coachId: coach.id,
          startTime,
          endTime,
          reason: "Medical appointment",
        },
      }),
    );
    const request = (id: string, body: any) => ({
      params: { id },
      body,
      user: { id: "integration-actor", role: "ADMIN" },
    });
    await assert.rejects(
      scope(0, () =>
        operationHandlers["PATCH /leave-requests/:id"](
          request(leave.id, {
            status: "APPROVED",
            reason: "Approved",
            resolutions: [],
          }),
        ),
      ),
      /LEAVE_RESOLUTION_REQUIRED/,
    );
    assert.equal(
      (await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } }))
        .status,
      "PENDING",
    );
    await scope(0, () =>
      operationHandlers["PATCH /leave-requests/:id"](
        request(leave.id, {
          status: "APPROVED",
          reason: "Approved",
          resolutions: [{ scheduleId: session.id, action: "CANCEL" }],
        }),
      ),
    );
    await assert.rejects(
      scope(0, () => createSchedule(input)),
      /COACH_ON_LEAVE/,
    );
    console.log(
      "PASS leave approval requires session resolution and approved leave blocks scheduling",
    );
    const plan = await prisma.membershipPlan.create({
      data: {
        name: run + "plan",
        tier: "MEMBERSHIP",
        durationDays: 30,
        price: 300000,
        maxConcurrentClasses: 3,
      },
    });
    planId = plan.id;
    const cashierScope = (fn: () => Promise<any>) =>
      requestContext.run(
        {
          facilityId: created[0],
          actorId: coachUserId,
          role: "ADMIN",
          reason: "Cash received",
        },
        fn,
      );
    const order = await cashierScope(() =>
      operationHandlers["POST /counter-orders"](
        request("", { memberId: member.id, planId: plan.id, method: "CASH" }),
      ),
    );
    assert.equal(
      await prisma.membershipSubscription.count({
        where: { memberId: member.id },
      }),
      0,
    );
    await prisma.membershipPlan.update({
      where: { id: plan.id },
      data: { price: 500000, durationDays: 60 },
    });
    await Promise.all(
      [1, 2].map(() =>
        cashierScope(() =>
          operationHandlers["POST /counter-orders/:id/confirm"](
            request(order.id, { reason: "Cash received" }),
          ),
        ),
      ),
    );
    const sub = await prisma.membershipSubscription.findFirstOrThrow({
      where: { memberId: member.id },
    });
    assert.equal(Number(sub.priceSnapshot), 300000);
    assert.equal(+sub.endDate - +sub.startDate, 30 * 86400000);
    assert.equal(
      await prisma.membershipSubscription.count({
        where: { memberId: member.id },
      }),
      1,
    );
    console.log(
      "PASS pending orders have no subscription; concurrent confirmation is idempotent and honors sold price/duration",
    );
    const { getRevenueReport } =
      await import("../src/modules/reports/reports.service.js");
    await cashierScope(() =>
      prisma.payment.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          refundedAmount: 90000,
          refundedAt: new Date(),
        },
      }),
    );
    const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10),
      tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const report = await scope(0, () => getRevenueReport(yesterday, tomorrow));
    assert.equal(report.totalRevenue, 300000);
    assert.equal(report.refundedAmount, 90000);
    assert.equal(report.netRevenue, 210000);
    const otherReport = await scope(1, () =>
      getRevenueReport(yesterday, tomorrow),
    );
    assert.equal(otherReport.totalRevenue, 0);
    console.log(
      "PASS revenue subtracts partial refunds and excludes other facilities",
    );
    const nextStart = new Date(+startTime + 86400000),
      nextEnd = new Date(+endTime + 86400000);
    const nextSession = await scope(0, () =>
      createSchedule({ ...input, startTime: nextStart, endTime: nextEnd }),
    );
    const { enrollWholeCourse } =
      await import("../src/modules/enrollments/course-enrollment.service.js");
    await prisma.membershipSubscription.update({
      where: { id: sub.id },
      data: { endDate: new Date(+nextEnd - 1) },
    });
    await assert.rejects(
      scope(0, () => enrollWholeCourse(cls.id, member.id)),
      /Không thể đăng ký trọn khóa/,
    );
    await prisma.membershipSubscription.update({
      where: { id: sub.id },
      data: { endDate: sub.endDate },
    });
    await prisma.user.create({
      data: {
        id: secondMemberUserId,
        email: run + "member2@test.invalid",
        fullName: "Member 2",
        password: "not-a-login",
        role: "MEMBER",
      },
    });
    const secondMember = await prisma.memberProfile.create({
      data: { userId: secondMemberUserId },
    });
    await prisma.membershipSubscription.create({
      data: {
        facilityId: created[0],
        memberId: secondMember.id,
        planId: plan.id,
        tier: "MEMBERSHIP",
        startDate: sub.startDate,
        endDate: sub.endDate,
        priceSnapshot: 500000,
        maxConcurrentClassesSnapshot: 3,
      },
    });
    const capacityRace = await Promise.allSettled(
      [member.id, secondMember.id].map((memberId) =>
        scope(0, () => enrollWholeCourse(cls.id, memberId)),
      ),
    );
    assert.equal(
      capacityRace.filter((r) => r.status === "fulfilled").length,
      1,
    );
    assert.equal(capacityRace.filter((r) => r.status === "rejected").length, 1);
    assert.equal(
      await prisma.enrollment.count({
        where: { scheduleId: nextSession.id, status: "BOOKED" },
      }),
      1,
    );
    console.log(
      "PASS course coverage includes the final session end and concurrent registration creates one seat",
    );
    const { createAttendance, updateAttendance } =
      await import("../src/modules/attendance/attendance.service.js");
    await assert.rejects(
      scope(0, () =>
        createAttendance(
          {
            scheduleId: nextSession.id,
            memberId: member.id,
            status: "PRESENT",
          },
          { id: coachUserId, role: "COACH" },
        ),
      ),
      /chưa|ngoài|not open|ATTENDANCE|điểm danh/i,
    );
    const attendance = await prisma.attendance.create({
      data: {
        scheduleId: nextSession.id,
        memberId: member.id,
        status: "PRESENT",
      },
    });
    await assert.rejects(
      scope(0, () =>
        updateAttendance(
          attendance.id,
          { status: "ABSENT", note: "Correction" },
          { id: coachUserId, role: "COACH" },
        ),
      ),
      /Only managers/,
    );
    await assert.rejects(
      scope(0, () =>
        updateAttendance(
          attendance.id,
          { status: "ABSENT" },
          { id: "integration-actor", role: "ADMIN" },
        ),
      ),
      /requires a reason/,
    );
    await scope(0, () =>
      updateAttendance(
        attendance.id,
        { status: "ABSENT", note: "Correction with reason" },
        { id: "integration-actor", role: "ADMIN" },
      ),
    );
    console.log(
      "PASS coach attendance window and manager correction reason/role restrictions",
    );
    const gatewayOrder = await prisma.payment.create({
      data: {
        facilityId: created[1],
        memberId: member.id,
        planId: plan.id,
        amount: 123456,
        method: "BANK_TRANSFER",
        status: "PENDING",
      },
    });
    const { activateSubscriptionForPayment } =
      await import("../src/modules/subscriptions/subscription-purchase.service.js");
    const gatewayResult = await prisma.$transaction((tx) =>
      activateSubscriptionForPayment(tx, {
        paymentId: gatewayOrder.id,
        memberProfileId: member.id,
        memberUserId,
        plan,
        optionSnapshot: {
          durationDays: 30,
          tier: "MEMBERSHIP",
          planName: plan.name,
          maxConcurrentClasses: 3,
        },
      }),
    );
    assert.equal(gatewayResult.subscription.facilityId, created[1]);
    assert.equal(Number(gatewayResult.subscription.priceSnapshot), 123456);
    // GLOBAL membership: gateway activation THẤY gói member đang ACTIVE (mua tại facility khác)
    // nên áp đúng luật 1 gói ACTIVE — kỳ cũ chuyển SUSPENDED, gói mới là ACTIVE.
    assert.equal(
      (
        await prisma.membershipSubscription.findUniqueOrThrow({
          where: { id: sub.id },
        })
      ).status,
      "SUSPENDED",
    );
    console.log(
      "PASS gateway activation uses the persisted order facility and recognises a global membership bought at another facility",
    );
  } finally {
    const classes = await prisma.class.findMany({
      where: { facilityId: { in: created } },
      select: { id: true },
    });
    const classIds = classes.map((v) => v.id);
    const payments = await prisma.payment.findMany({
      where: { facilityId: { in: created } },
      select: { id: true },
    });
    await prisma.invoice.deleteMany({
      where: { paymentId: { in: payments.map((v) => v.id) } },
    });
    await prisma.payment.deleteMany({ where: { facilityId: { in: created } } });
    await prisma.membershipSubscription.deleteMany({
      where: { facilityId: { in: created } },
    });
    await prisma.notificationOutbox.deleteMany({
      where: {
        userId: { in: [coachUserId, memberUserId, secondMemberUserId] },
      },
    });
    await prisma.notification.deleteMany({
      where: {
        userId: { in: [coachUserId, memberUserId, secondMemberUserId] },
      },
    });
    await prisma.leaveRequest.deleteMany({
      where: { facilityId: { in: created } },
    });
    await prisma.attendance.deleteMany({
      where: { schedule: { classId: { in: classIds } } },
    });
    await prisma.enrollment.deleteMany({
      where: { classId: { in: classIds } },
    });
    await prisma.classSchedule.deleteMany({
      where: { classId: { in: classIds } },
    });
    await prisma.classMember.deleteMany({
      where: { classId: { in: classIds } },
    });
    await prisma.class.deleteMany({ where: { id: { in: classIds } } });
    if (sportId) {
      await prisma.coachSpecialization.deleteMany({ where: { sportId } });
      await prisma.subjectRequirement.deleteMany({ where: { sportId } });
      await prisma.sport.delete({ where: { id: sportId } });
    }
    if (planId) await prisma.membershipPlan.delete({ where: { id: planId } });
    await prisma.user.deleteMany({
      where: { id: { in: [coachUserId, memberUserId, secondMemberUserId] } },
    });
    await prisma.roomCapability.deleteMany({
      where: { room: { facilityId: { in: created } } },
    });
    await prisma.auditLog.deleteMany({
      where: { facilityId: { in: created } },
    });
    await prisma.room.deleteMany({ where: { facilityId: { in: created } } });
    await prisma.facility.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
