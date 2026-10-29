import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import mongoose from "mongoose";
import { performance } from "node:perf_hooks";

const target = new URL(process.env.DATABASE_URL!);
assert.equal(target.hostname, "127.0.0.1");
assert.match(
  target.searchParams.get("schema")!,
  /^scms_hardening_[a-f0-9]{12}$/,
);
assert.equal(
  new URL(process.env.MONGO_URI!).pathname.slice(1),
  target.searchParams.get("schema"),
);
const { prisma } = require("../src/config/prisma.js");
const { requestContext } = require("../src/config/request-context.js");
const { User } = require("../src/models/User.js");
const { MemberProfile } = require("../src/models/MemberProfile.js");
const { CoachProfile } = require("../src/models/CoachProfile.js");
const { ManagerProfile } = require("../src/models/ManagerProfile.js");
const { createUser } = require("../src/modules/users/users.service.js");
const {
  activateSubscriptionForPayment,
} = require("../src/modules/subscriptions/subscription-purchase.service.js");
const {
  activateDueSubscription,
  readEffectiveSubscription,
} = require("../src/modules/subscriptions/entitlement.service.js");
const { requestRefund } = require("../src/modules/payments/refunds.service.js");
const {
  updatePaymentStatus,
} = require("../src/modules/payments/payments.service.js");
const {
  createScheduleBatch,
} = require("../src/modules/class-schedules/class-schedules.service.js");
const {
  bookClass,
} = require("../src/modules/enrollments/enrollments.service.js");
const { updateTerm } = require("../src/modules/terms/terms.service.js");
const {
  validateResources,
} = require("../src/modules/operations/scheduling.js");
const DAY = 86400000,
  now = new Date();
let facility: any,
  plan: any,
  sport: any,
  coach: any,
  manager: any,
  room: any,
  term: any;
let sequence = 0;
let queryCount = 0;
prisma.$on("query", () => queryCount++);
const benchmark: { sessions: number; milliseconds: number; queries: number }[] =
  [];
async function account(role = "MEMBER") {
  return createUser(
    {
      email: `${role.toLowerCase()}-${++sequence}@test.invalid`,
      password: "TestOnlyPassword123!",
      fullName: `Test ${role}`,
      role,
      sportIds: role === "COACH" ? [sport.id] : undefined,
    },
    role === "COACH" ? facility.id : undefined,
  );
}
async function member() {
  const user = await account();
  return prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
}
async function order(memberId: string) {
  return prisma.payment.create({
    data: {
      facilityId: facility.id,
      memberId,
      planId: plan.id,
      amount: 300000,
      method: "CASH",
      status: "PENDING",
    },
  });
}
async function purchase(profile: any, payment: any) {
  return prisma.$transaction((tx: any) =>
    activateSubscriptionForPayment(tx, {
      memberProfileId: profile.id,
      memberUserId: profile.userId,
      plan,
      paymentId: payment.id,
    }),
  );
}
async function paidMember() {
  const profile = await member();
  const paid = await purchase(profile, await order(profile.id));
  return { profile, ...paid };
}
async function cls(name: string, capacity = 10) {
  return prisma.class.create({
    data: {
      facilityId: facility.id,
      name,
      capacity,
      areaType: "INDOOR",
      sports: { connect: { id: sport.id } },
      coaches: { create: { coachId: coach.coachProfile.id, isPrimary: true } },
      requirementsSnapshot: {},
    },
  });
}
const managed = (run: () => any) =>
  requestContext.run(
    {
      facilityId: facility.id,
      actorId: manager.id,
      role: "MANAGER",
      reason: "Isolated hardening verification",
    },
    run,
  );

before(async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  await Promise.all([
    User.init(),
    MemberProfile.init(),
    CoachProfile.init(),
    ManagerProfile.init(),
  ]);
  facility = await prisma.facility.create({
    data: {
      code: "isolation",
      name: "Isolated facility",
      address: "Test only",
      timezone: "Asia/Ho_Chi_Minh",
    },
  });
  sport = await prisma.sport.create({
    data: { name: "Test fitness", areaTypes: ["INDOOR"] },
  });
  plan = await prisma.membershipPlan.create({
    data: {
      name: "Paid 180",
      tier: "MEMBERSHIP",
      price: 300000,
      durationDays: 180,
      maxConcurrentClasses: 3,
    },
  });
  coach = await account("COACH");
  manager = await account("MANAGER");
  await prisma.facilityStaff.create({
    data: { facilityId: facility.id, userId: manager.id, role: "MANAGER" },
  });
  room = await prisma.room.create({
    data: {
      facilityId: facility.id,
      name: "Isolated room",
      capacity: 30,
      areaType: "INDOOR",
    },
  });
  term = await prisma.term.create({
    data: {
      facilityId: facility.id,
      code: "ISO",
      name: "Isolation term",
      status: "OPEN_REGISTRATION",
      startDate: new Date(now.getTime() - DAY),
      endDate: new Date(now.getTime() + 150 * DAY),
      registrationStartDate: new Date(now.getTime() - DAY),
      registrationEndDate: new Date(now.getTime() + 149 * DAY),
    },
  });
});
after(async () => {
  console.log(
    "Scheduling measurements (isolated local DB):",
    JSON.stringify(benchmark),
  );
  await prisma.$disconnect();
  await mongoose.disconnect();
});

test("provisioning recovers from PostgreSQL failure against a real Mongo replica set", async () => {
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION scms_inject_provision_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.email = 'recover@test.invalid' THEN RAISE EXCEPTION 'INJECTED_FAILURE'; END IF; RETURN NEW; END $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER provision_failure BEFORE INSERT OR UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION scms_inject_provision_failure()`,
  );
  try {
    await assert.rejects(
      () =>
        createUser({
          email: "recover@test.invalid",
          password: "TestOnlyPassword123!",
          fullName: "Recover",
          role: "RECEPTIONIST",
        }),
      /Chưa hoàn tất/,
    );
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER provision_failure ON "User"`);
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION scms_inject_provision_failure()`,
    );
  }
  const blocked = await User.findOne({ email: "recover@test.invalid" });
  assert.equal(blocked.isActive, false);
  assert.equal(blocked.provisioningStatus, "FAILED");
  assert.equal(
    await prisma.user.count({ where: { email: "recover@test.invalid" } }),
    0,
  );
  const recovered = await createUser({
    email: "recover@test.invalid",
    password: "TestOnlyPassword123!",
    fullName: "Recover",
    role: "RECEPTIONIST",
  });
  assert.equal(recovered.id, blocked._id.toString());
  assert.equal((await User.findById(recovered.id)).provisioningStatus, "READY");
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: recovered.id } }))
      .isActive,
    true,
  );
});

test("concurrent renewals create only one paid scheduled period", async () => {
  const current = await paidMember();
  const orders = await Promise.all([
    order(current.profile.id),
    order(current.profile.id),
  ]);
  const results = await Promise.allSettled(
    orders.map((payment) => purchase(current.profile, payment)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await prisma.membershipSubscription.count({
      where: { memberId: current.profile.id, status: "SCHEDULED" },
    }),
    1,
  );
  assert.equal(
    await prisma.membershipSubscription.count({
      where: { memberId: current.profile.id, status: "ACTIVE" },
    }),
    1,
  );
  assert.equal(
    await prisma.payment.count({
      where: { memberId: current.profile.id, status: "SUCCESS" },
    }),
    2,
  );
});

test("activation uses the partial unique index safely and cancelled candidates cannot suspend rights", async () => {
  const current = await paidMember();
  const queued = await purchase(
    current.profile,
    await order(current.profile.id),
  );
  await prisma.membershipSubscription.update({
    where: { id: queued.subscription.id },
    data: { startDate: new Date(now.getTime() - 1000) },
  });
  assert.equal(
    (await readEffectiveSubscription(prisma, current.profile.id)).id,
    queued.subscription.id,
  );
  await prisma.$transaction((tx: any) =>
    activateDueSubscription(tx, queued.subscription.id, current.profile.id),
  );
  assert.equal(
    await prisma.membershipSubscription.count({
      where: { memberId: current.profile.id, status: "ACTIVE" },
    }),
    1,
  );
  assert.equal(
    (
      await prisma.membershipSubscription.findUniqueOrThrow({
        where: { id: queued.subscription.id },
      })
    ).status,
    "ACTIVE",
  );
  const next = await purchase(current.profile, await order(current.profile.id));
  await prisma.membershipSubscription.update({
    where: { id: next.subscription.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  assert.equal(
    await prisma.$transaction((tx: any) =>
      activateDueSubscription(tx, next.subscription.id, current.profile.id),
    ),
    false,
  );
  assert.equal(
    (
      await prisma.membershipSubscription.findUniqueOrThrow({
        where: { id: queued.subscription.id },
      })
    ).status,
    "ACTIVE",
  );
});

test("database guards reject duplicate active periods and multiple primaries", async () => {
  const current = await paidMember();
  await assert.rejects(() =>
    prisma.membershipSubscription.create({
      data: {
        memberId: current.profile.id,
        planId: plan.id,
        tier: "MEMBERSHIP",
        priceSnapshot: 300000,
        startDate: now,
        endDate: new Date(now.getTime() + DAY),
        status: "ACTIVE",
      },
    }),
  );
  const c = await cls("Primary invariant");
  const other = await account("COACH");
  await assert.rejects(() =>
    prisma.classMember.create({
      data: { classId: c.id, coachId: other.coachProfile.id, isPrimary: true },
    }),
  );
});

test("batch scheduling rolls back conflicts and cannot commit a class with no primary", async () => {
  const c = await cls("Batch correctness");
  const first = new Date(now.getTime() + DAY);
  await managed(() =>
    createScheduleBatch({
      classId: c.id,
      roomId: room.id,
      termId: term.id,
      schedules: [
        {
          startTime: first.toISOString(),
          endTime: new Date(first.getTime() + 3600000).toISOString(),
        },
      ],
    }),
  );
  const start = new Date(now.getTime() + 2 * DAY);
  await assert.rejects(
    () =>
      managed(() =>
        createScheduleBatch({
          classId: c.id,
          roomId: room.id,
          termId: term.id,
          schedules: [
            {
              startTime: start.toISOString(),
              endTime: new Date(start.getTime() + 3600000).toISOString(),
            },
            {
              startTime: first.toISOString(),
              endTime: new Date(first.getTime() + 3600000).toISOString(),
            },
          ],
        }),
      ),
    /trùng/,
  );
  assert.equal(
    await prisma.classSchedule.count({ where: { classId: c.id } }),
    1,
  );
  await assert.rejects(() =>
    prisma.classMember.updateMany({
      where: { classId: c.id },
      data: { isPrimary: false },
    }),
  );
  assert.equal(
    await prisma.classMember.count({
      where: { classId: c.id, isPrimary: true },
    }),
    1,
  );
});

test("two members racing the last seat cannot overbook", async () => {
  const c = await cls("Last seat", 1);
  const start = new Date(now.getTime() + 3 * DAY);
  await managed(() =>
    createScheduleBatch({
      classId: c.id,
      roomId: room.id,
      termId: term.id,
      schedules: [
        {
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 3600000).toISOString(),
        },
      ],
    }),
  );
  const session = await prisma.classSchedule.findFirstOrThrow({
    where: { classId: c.id },
  });
  const a = await paidMember(),
    b = await paidMember();
  const result = await Promise.allSettled(
    [a, b].map((member) =>
      requestContext.run(
        {
          facilityId: facility.id,
          actorId: member.profile.userId,
          role: "MEMBER",
        },
        () => bookClass(session.id, member.profile.id, "MEMBER"),
      ),
    ),
  );
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await prisma.enrollment.count({
      where: { scheduleId: session.id, status: "BOOKED" },
    }),
    1,
  );
});

test("refund remains pending until receipt confirmation and preserves unrelated bookings", async () => {
  const member = await paidMember();
  const c = await cls("Refund source");
  const starts = [4, 5].map((day) => new Date(now.getTime() + day * DAY));
  await managed(() =>
    createScheduleBatch({
      classId: c.id,
      roomId: room.id,
      termId: term.id,
      schedules: starts.map((start) => ({
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 3600000).toISOString(),
      })),
    }),
  );
  const sessions = await prisma.classSchedule.findMany({
    where: { classId: c.id },
    orderBy: { startTime: "asc" },
  });
  await prisma.membershipSubscription.update({
    where: { id: member.subscription.id },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });
  const second = await purchase(member.profile, await order(member.profile.id));
  const firstBooking = await prisma.enrollment.create({
    data: {
      memberId: member.profile.id,
      classId: c.id,
      scheduleId: sessions[0].id,
      subscriptionId: member.subscription.id,
    },
  });
  const otherBooking = await prisma.enrollment.create({
    data: {
      memberId: member.profile.id,
      classId: c.id,
      scheduleId: sessions[1].id,
      subscriptionId: second.subscription.id,
    },
  });
  await managed(() =>
    prisma.$transaction((tx: any) =>
      requestRefund(tx, member.payment, 90000, "Test refund policy"),
    ),
  );
  const pending = await prisma.payment.findUniqueOrThrow({
    where: { id: member.payment.id },
  });
  assert.equal(pending.status, "SUCCESS");
  assert.equal(pending.refundedAt, null);
  await managed(() =>
    updatePaymentStatus(member.payment.id, "REFUNDED", {
      reason: "Cash returned",
      reference: "receipt-isolated-1",
    }),
  );
  assert.equal(
    (
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: firstBooking.id },
      })
    ).status,
    "CANCELLED",
  );
  assert.equal(
    (
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: otherBooking.id },
      })
    ).status,
    "BOOKED",
  );
  assert.equal(
    Number(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { id: member.payment.id },
        })
      ).refundedAmount,
    ),
    90000,
  );
});

test("term PATCH and stored equipment requirements remain enforceable on real rows", async () => {
  await assert.rejects(
    () =>
      updateTerm(term.id, {
        endDate: new Date(now.getTime() - 10 * DAY).toISOString(),
      }),
    /không hợp lệ/,
  );
  const c = await cls("Snapshot");
  await prisma.class.update({
    where: { id: c.id },
    data: { requirementsSnapshot: { training_equipment: 1 } },
  });
  await assert.rejects(
    () =>
      validateResources(
        prisma,
        room.id,
        c.id,
        now,
        new Date(now.getTime() + 3600000),
      ),
    /ROOM_CAPABILITY_MISSING/,
  );
});

test("editing a class preserves its snapshot; refreshing it is explicit and validates rooms", async () => {
  const { updateClass } = require("../src/modules/classes/classes.service.js");
  const c = await cls("Retain snapshot");
  await prisma.class.update({
    where: { id: c.id },
    data: { defaultRoomId: room.id },
  });
  await prisma.subjectRequirement.create({
    data: { sportId: sport.id, key: "training_equipment", minimum: 1 },
  });
  try {
    await managed(() =>
      updateClass(c.id, { name: "Renamed", sportIds: [sport.id] }),
    );
    assert.deepEqual(
      (await prisma.class.findUniqueOrThrow({ where: { id: c.id } }))
        .requirementsSnapshot,
      {},
    );
    await assert.rejects(
      () =>
        managed(() =>
          updateClass(c.id, {
            refreshRequirements: true,
            reason: "Adopt new requirements",
          }),
        ),
      /không đủ dụng cụ/,
    );
    await prisma.roomCapability.create({
      data: { roomId: room.id, key: "training_equipment", quantity: 1 },
    });
    await managed(() =>
      updateClass(c.id, {
        refreshRequirements: true,
        reason: "Adopt new requirements",
      }),
    );
    assert.deepEqual(
      (await prisma.class.findUniqueOrThrow({ where: { id: c.id } }))
        .requirementsSnapshot,
      { training_equipment: 1 },
    );
  } finally {
    await prisma.subjectRequirement.deleteMany({
      where: { sportId: sport.id },
    });
  }
});

test("support, substitute and old primary have consistent roster and leave permissions", async () => {
  const {
    assignSupportCoach,
  } = require("../src/modules/classes/classes.service.js");
  const {
    updateSchedule,
  } = require("../src/modules/class-schedules/class-schedules.service.js");
  const {
    getAttendancesBySchedule,
  } = require("../src/modules/attendance/attendance.service.js");
  const { deactivateUser } = require("../src/modules/users/users.service.js");
  const {
    operationHandlers,
  } = require("../src/modules/operations/operations.routes.js");
  const c = await cls("Effective coaching");
  const start = new Date(now.getTime() + 7 * DAY),
    end = new Date(start.getTime() + 3600000);
  await managed(() =>
    createScheduleBatch({
      classId: c.id,
      roomId: room.id,
      termId: term.id,
      schedules: [
        { startTime: start.toISOString(), endTime: end.toISOString() },
      ],
    }),
  );
  const session = await prisma.classSchedule.findFirstOrThrow({
    where: { classId: c.id },
  });
  const support = await account("COACH"),
    substitute = await account("COACH");
  await managed(() => assignSupportCoach(c.id, support.coachProfile.id));
  await managed(() =>
    updateSchedule(session.id, {
      coachId: substitute.coachProfile.id,
      reason: "Test substitute",
    }),
  );
  await managed(() =>
    getAttendancesBySchedule(session.id, { id: support.id, role: "COACH" }),
  );
  await managed(() =>
    getAttendancesBySchedule(session.id, { id: substitute.id, role: "COACH" }),
  );
  await assert.rejects(
    () =>
      managed(() =>
        getAttendancesBySchedule(session.id, { id: coach.id, role: "COACH" }),
      ),
    /not assigned/,
  );
  await assert.rejects(
    () => managed(() => deactivateUser(support.id, manager.id)),
    /còn lịch/,
  );
  const leave = await prisma.leaveRequest.create({
    data: {
      facilityId: facility.id,
      coachId: support.coachProfile.id,
      requesterId: support.id,
      requesterRole: "COACH",
      startTime: start,
      endTime: end,
      reason: "Test support leave",
    },
  });
  const affected = await managed(() =>
    operationHandlers["GET /leave-requests/:id/affected"]({
      params: { id: leave.id },
      user: { id: manager.id, role: "MANAGER" },
    }),
  );
  assert.ok(affected.some((row: any) => row.id === session.id));
});

test("generic feedback uniqueness is protected by PostgreSQL, not just request sequencing", async () => {
  const profile = await member();
  await prisma.coachFeedback.create({
    data: { coachId: coach.coachProfile.id, memberId: profile.id, rating: 5 },
  });
  await assert.rejects(() =>
    prisma.coachFeedback.create({
      data: { coachId: coach.coachProfile.id, memberId: profile.id, rating: 4 },
    }),
  );
});

test("cancellation avoids a busy waitlist lock and the worker retries that candidate", async () => {
  const {
    cancelEnrollment,
  } = require("../src/modules/enrollments/enrollments.service.js");
  const { lockMemberQuota } = require("../src/utils/dbLocks.js");
  const {
    runWaitlistPromotions,
  } = require("../src/modules/waitlist/waitlist.worker.js");
  const c = await cls("Busy waitlist", 1),
    start = new Date(now.getTime() + 6 * DAY);
  await managed(() =>
    createScheduleBatch({
      classId: c.id,
      roomId: room.id,
      termId: term.id,
      schedules: [
        {
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 3600000).toISOString(),
        },
      ],
    }),
  );
  const session = await prisma.classSchedule.findFirstOrThrow({
    where: { classId: c.id },
  });
  const a = await paidMember(),
    b = await paidMember();
  const booked = await requestContext.run(
    { facilityId: facility.id, actorId: a.profile.userId, role: "MEMBER" },
    () => bookClass(session.id, a.profile.id, "MEMBER"),
  );
  const waiting = await prisma.waitlistEntry.create({
    data: { memberId: b.profile.id, scheduleId: session.id, position: 1 },
  });
  let release!: () => void, ready!: () => void;
  const acquired = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const held = prisma.$transaction(
    async (tx: any) => {
      await lockMemberQuota(tx, b.profile.id);
      ready();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    { timeout: 15000 },
  );
  await acquired;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      requestContext.run(
        { facilityId: facility.id, actorId: a.profile.userId, role: "MEMBER" },
        () => cancelEnrollment(booked.id, a.profile.userId, "MEMBER"),
      ),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Cancellation blocked on waitlist member")),
          5000,
        );
      }),
    ]);
    assert.equal(
      (
        await prisma.waitlistEntry.findUniqueOrThrow({
          where: { id: waiting.id },
        })
      ).status,
      "WAITING",
    );
  } finally {
    if (timer) clearTimeout(timer);
    release();
    await held;
  }
  assert.equal((await runWaitlistPromotions()).promoted, 1);
  assert.equal(
    (
      await prisma.waitlistEntry.findUniqueOrThrow({
        where: { id: waiting.id },
      })
    ).status,
    "PROMOTED",
  );
  assert.equal(
    await prisma.enrollment.count({
      where: { scheduleId: session.id, status: "BOOKED" },
    }),
    1,
  );
});

test("record batch timing on isolated PostgreSQL without claiming production latency", async () => {
  const c = await cls("Timing");
  for (let repeat = 0; repeat < 5; repeat++)
    for (const [offset, count] of [
      [20, 1],
      [30, 10],
      [60, 25],
    ]) {
      const schedules = Array.from({ length: count }, (_, i) => {
        const start = new Date(
          now.getTime() + (offset + i) * DAY + repeat * 7200000,
        );
        return {
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 3600000).toISOString(),
        };
      });
      const beforeQueries = queryCount;
      const began = performance.now();
      await managed(() =>
        createScheduleBatch({
          classId: c.id,
          roomId: room.id,
          termId: term.id,
          schedules,
        }),
      );
      benchmark.push({
        sessions: count,
        milliseconds: Math.round(performance.now() - began),
        queries: queryCount - beforeQueries,
      });
    }
  assert.equal(
    await prisma.classSchedule.count({ where: { classId: c.id } }),
    180,
  );
});

test("a due scheduled cancellation uses active refund policy and cannot resume the replaced plan", async () => {
  const {
    cancelSubscriptionBySelf,
  } = require("../src/modules/subscriptions/subscriptions.service.js");
  const current = await paidMember();
  const queued = await purchase(
    current.profile,
    await order(current.profile.id),
  );
  await prisma.membershipSubscription.update({
    where: { id: queued.subscription.id },
    data: { startDate: new Date(now.getTime() - 600000) },
  });
  await requestContext.run(
    {
      facilityId: facility.id,
      actorId: current.profile.userId,
      role: "MEMBER",
      reason: "Cancel due period",
    },
    () =>
      cancelSubscriptionBySelf(
        queued.subscription.id,
        current.profile.userId,
        "Cancel due period",
      ),
  );
  assert.equal(
    (
      await prisma.membershipSubscription.findUniqueOrThrow({
        where: { id: current.subscription.id },
      })
    ).status,
    "SUSPENDED",
  );
  assert.equal(
    await readEffectiveSubscription(prisma, current.profile.id),
    null,
  );
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: queued.payment.id },
  });
  assert.equal(payment.status, "SUCCESS");
  assert.equal(Number(payment.refundRequestedAmount), 90000);
});

test("term date changes racing schedule creation cannot leave a session outside its term", async () => {
  const c = await cls("Term race");
  const raceTerm = await prisma.term.create({
    data: {
      facilityId: facility.id,
      code: "TERM-RACE",
      name: "Term race",
      status: "OPEN_REGISTRATION",
      startDate: new Date(now.getTime() + 99 * DAY),
      endDate: new Date(now.getTime() + 110 * DAY),
      registrationStartDate: now,
      registrationEndDate: new Date(now.getTime() + 110 * DAY),
    },
  });
  const start = new Date(now.getTime() + 105 * DAY);
  const results = await Promise.allSettled([
    managed(() =>
      createScheduleBatch({
        classId: c.id,
        roomId: room.id,
        termId: raceTerm.id,
        schedules: [
          {
            startTime: start.toISOString(),
            endTime: new Date(start.getTime() + 3600000).toISOString(),
          },
        ],
      }),
    ),
    updateTerm(raceTerm.id, {
      endDate: new Date(now.getTime() + 100 * DAY).toISOString(),
      registrationEndDate: new Date(now.getTime() + 100 * DAY).toISOString(),
    }),
  ]);
  assert.ok(results.some((result) => result.status === "rejected"));
  const finalTerm = await prisma.term.findUniqueOrThrow({
    where: { id: raceTerm.id },
  });
  const sessions = await prisma.classSchedule.findMany({
    where: { classId: c.id },
  });
  assert.ok(
    sessions.every(
      (session: any) =>
        session.startTime >= finalTerm.startDate &&
        session.endTime <= finalTerm.endDate,
    ),
  );
  await assert.rejects(() =>
    prisma.classSchedule.create({
      data: {
        classId: c.id,
        roomId: room.id,
        startTime: start,
        endTime: new Date(start.getTime() + 3600000),
      },
    }),
  );
});

test("concurrent Admin deactivation preserves the last active Admin across both databases", async () => {
  const { deactivateUser } = require("../src/modules/users/users.service.js");
  const a = await account("ADMIN"),
    b = await account("ADMIN");
  const results = await Promise.allSettled([
    deactivateUser(a.id, b.id),
    deactivateUser(b.id, a.id),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(await User.countDocuments({ role: "ADMIN", isActive: true }), 1);
  assert.equal(
    await prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    1,
  );
});

test("actual HTTP app allows global Admin insights without a selected facility and keeps room scope mandatory", async () => {
  const { createServer } = require("node:http");
  const app = require("../src/app.js").default;
  const { signAccessToken } = require("../src/utils/jwt.js");
  const admin = await User.findOne({ role: "ADMIN", isActive: true });
  const token = signAccessToken({
    id: String(admin._id),
    role: "ADMIN",
    tokenVersion: admin.tokenVersion ?? 0,
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const date = new Date().toISOString().slice(0, 10);
  try {
    const report = await fetch(
      `${base}/reports/memberships?startDate=${date}&endDate=${date}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(report.status, 200);
    assert.equal((await report.json()).success, true);
    const roomResponse = await fetch(`${base}/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(roomResponse.status, 400);
    assert.ok((await roomResponse.json()).requestId);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
