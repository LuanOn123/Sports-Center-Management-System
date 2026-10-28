import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTermMembershipGrant,
  remainingMembershipRatio,
  termMembershipCovers,
} from "../src/modules/enrollments/term-membership-policy.js";

process.env.DATABASE_URL =
  "postgresql://test:test@127.0.0.1:1/term_policy_test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "term-policy-test-access-secret";
process.env.JWT_REFRESH_SECRET = "term-policy-test-refresh-secret";
const {
  evaluateCourseEligibility,
  enrollWholeCourse,
} = require("../src/modules/enrollments/course-enrollment.service.js");
const {
  getMembershipCoverageIntervals,
  isCoveredAt,
} = require("../src/modules/attendance/attendance-analytics.service.js");
const { scanQr } = require("../src/modules/attendance/attendance.service.js");
const { checkIn } = require("../src/modules/facility-visits/facility-visits.service.js");
const { requestContext } = require("../src/config/request-context.js");
const prismaConfig = require("../src/config/prisma.js");
const jwt = require("jsonwebtoken");

const DAY = 86400000;
const NOW = new Date("2030-04-01T00:00:00Z");
const sub = {
  id: "sub-1",
  startDate: new Date(NOW.getTime() - 90 * DAY),
  endDate: new Date(NOW.getTime() + 90 * DAY),
  status: "ACTIVE",
  tier: "MEMBERSHIP",
  plan: { name: "180 ngày", maxConcurrentClasses: 3 },
};
const term = {
  id: "term-1",
  name: "Học kỳ 1",
  status: "OPEN_REGISTRATION",
  startDate: NOW,
  endDate: new Date(NOW.getTime() + 150 * DAY),
  registrationStartDate: new Date(NOW.getTime() - DAY),
  registrationEndDate: new Date(NOW.getTime() + DAY),
};
const sessions = [100, 140].map((days, index) => ({
  id: `session-${index}`,
  startTime: new Date(NOW.getTime() + days * DAY),
  endTime: new Date(NOW.getTime() + days * DAY + 3600000),
  roomId: "room-1",
  termId: term.id,
  room: { id: "room-1", name: "Phòng 1" },
}));
const cls = {
  id: "class-1",
  name: "Yoga",
  classType: "REGULAR",
  capacity: 10,
  isActive: true,
  facilityId: "facility-1",
};

function replace(
  t: any,
  object: any,
  key: string,
  implementation: (...args: any[]) => any,
) {
  const previous = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, {
    value: implementation,
    configurable: true,
    writable: true,
  });
  t.after(() => {
    if (previous) Object.defineProperty(object, key, previous);
    else Reflect.deleteProperty(object, key);
  });
}

function fixture() {
  const state = {
    activeSub: { ...sub } as typeof sub | null,
    withTerm: true,
    premium: false,
    full: false,
    closed: false,
    penalty: false,
    quota: 3,
    existing: [] as any[],
    writes: [] as any[],
  };
  const db: any = {
    $executeRaw: async () => [],
    $transaction: async (callback: any) => callback(db),
    membershipSubscription: {
      findFirst: async ({ where }: any) =>
        where.status === "SCHEDULED"
          ? null
          : state.activeSub
            ? { ...state.activeSub, maxConcurrentClassesSnapshot: state.quota }
            : null,
      findMany: async () => [
        { ...sub, memberId: "member-1", status: "EXPIRED" },
      ],
    },
    attendancePenalty: {
      findFirst: async () =>
        state.penalty
          ? {
              id: "penalty",
              attendanceRate: 20,
              sampleSize: 10,
              blockedUntil: new Date(NOW.getTime() + DAY),
            }
          : null,
    },
    enrollment: {
      groupBy: async () =>
        state.full ? [{ scheduleId: "session-0", _count: { _all: 10 } }] : [],
      findMany: async ({ select }: any) =>
        select?.termMembershipGrant ? state.existing : [],
      create: async ({ data }: any) => {
        state.writes.push(data);
        return { id: `enrollment-${state.writes.length}` };
      },
    },
    class: {
      findUnique: async () => ({
        ...cls,
        classType: state.premium ? "PREMIUM" : "REGULAR",
      }),
    },
    memberProfile: {
      findUnique: async () => ({
        id: "member-1",
        user: { id: "user-1", role: "MEMBER", isActive: true },
      }),
    },
    classSchedule: {
      findMany: async ({ select }: any) =>
        select?.term
          ? state.withTerm
            ? sessions.map((s) => ({
                id: s.id,
                term: {
                  ...term,
                  status: state.closed ? "CLOSED" : term.status,
                },
              }))
            : []
          : select?.status
            ? sessions.map((s) => ({ ...s, status: "SCHEDULED" }))
            : sessions,
    },
  };
  const evaluate = () =>
    evaluateCourseEligibility(
      db,
      "member-1",
      { ...cls, classType: state.premium ? "PREMIUM" : "REGULAR" },
      sessions,
      { now: NOW },
    );
  return { state, db, evaluate };
}

test("exactly half of a purchased 180-day subscription permits the full term", async () => {
  const f = fixture(),
    result = await f.evaluate();
  assert.equal(remainingMembershipRatio(sub, NOW), 0.5);
  assert.deepEqual(result.blockers, []);
  assert.equal(
    result.termMembershipGrant.validUntil,
    term.endDate.toISOString(),
  );
  assert.equal(sub.endDate.toISOString(), "2030-06-30T00:00:00.000Z");
});

test("one millisecond below 50% cannot use the extension", async () => {
  const f = fixture();
  f.state.activeSub!.endDate = new Date(sub.endDate.getTime() - 1);
  const result = await f.evaluate();
  assert.equal(result.termMembershipGrant, null);
  assert.ok(
    result.blockers.some(
      (b: any) => b.code === "SUBSCRIPTION_ENDS_BEFORE_COURSE_END",
    ),
  );
});

test("a short course already covered by the plan still works below 50%", async () => {
  const f = fixture();
  f.state.activeSub!.startDate = new Date(NOW.getTime() - 500 * DAY);
  f.state.activeSub!.endDate = new Date(term.endDate);
  assert.deepEqual((await f.evaluate()).blockers, []);
});

for (const invalid of ["EXPIRED", "CANCELLED", "SUSPENDED", "SCHEDULED"]) {
  test(`${invalid} plans cannot issue a term grant`, () => {
    assert.equal(
      createTermMembershipGrant(
        { ...sub, status: invalid },
        term,
        "member-1",
        cls.id,
        NOW,
      ),
      null,
    );
  });
}

test("a course without a term cannot use the 50% exception", async () => {
  const f = fixture();
  f.state.withTerm = false;
  assert.ok(
    (await f.evaluate()).blockers.some(
      (b: any) => b.code === "SUBSCRIPTION_ENDS_BEFORE_COURSE_END",
    ),
  );
});

for (const [condition, code] of [
  ["premium", "PREMIUM_REQUIRED"],
  ["full", "SESSION_FULL"],
  ["closed", "TERM_CLOSED"],
  ["penalty", "ATTENDANCE_PENALTY_ACTIVE"],
] as const) {
  test(`the term extension keeps the ${condition} guard`, async () => {
    const f = fixture();
    f.state[condition] = true;
    assert.ok((await f.evaluate()).blockers.some((b: any) => b.code === code));
  });
}

test("the extension does not bypass concurrent-class quota", async () => {
  const f = fixture();
  f.state.quota = 0;
  assert.ok(
    (await f.evaluate()).blockers.some(
      (b: any) => b.code === "CONCURRENT_CLASS_LIMIT_REACHED",
    ),
  );
});

test("expired membership cannot create fresh enrollments", async () => {
  const f = fixture();
  f.state.activeSub = null;
  assert.ok(
    (await f.evaluate()).blockers.some(
      (b: any) => b.code === "NO_ACTIVE_SUBSCRIPTION",
    ),
  );
});

test("an approved term grant remains scoped to its member, class, term and deadline", () => {
  const grant = createTermMembershipGrant(sub, term, "member-1", cls.id, NOW)!;
  const target = {
    memberId: "member-1",
    classId: cls.id,
    termId: term.id,
    startTime: sessions[1].startTime,
    endTime: sessions[1].endTime,
  };
  assert.equal(termMembershipCovers(grant, target), true);
  for (const overrides of [
    { memberId: "other" },
    { classId: "other" },
    { termId: "other" },
    { termId: null },
    { endTime: new Date(term.endDate.getTime() + 1) },
  ])
    assert.equal(
      termMembershipCovers(grant, { ...target, ...overrides }),
      false,
    );
  assert.equal(termMembershipCovers(null, target), false);
  assert.equal(
    termMembershipCovers(
      { ...grant, approvedAt: new Date(NOW.getTime() + DAY).toISOString() },
      target,
    ),
    false,
  );
});

test("persisted grants cover only their enrolled schedule in attendance and rescheduling", async () => {
  const f = fixture();
  const grant = createTermMembershipGrant(sub, term, "member-1", cls.id, NOW)!;
  f.state.existing = [
    {
      memberId: "member-1",
      classId: cls.id,
      scheduleId: sessions[1].id,
      termMembershipGrant: grant,
      schedule: { termId: term.id },
    },
  ];
  const coverage = (
    await getMembershipCoverageIntervals(f.db, ["member-1"])
  ).get("member-1");
  const scope = {
    scheduleId: sessions[1].id,
    classId: cls.id,
    termId: term.id,
    endTime: sessions[1].endTime,
  };
  assert.equal(isCoveredAt(coverage, sessions[1].startTime, scope), true);
  assert.equal(isCoveredAt(coverage, sessions[1].startTime), false);
  assert.equal(
    isCoveredAt(coverage, sessions[1].startTime, {
      ...scope,
      scheduleId: "other",
    }),
    false,
  );
  assert.equal(
    isCoveredAt(coverage, sessions[1].startTime, {
      ...scope,
      endTime: new Date(term.endDate.getTime() + 1),
    }),
    false,
  );
});

test("already-approved registrations remain valid after expiry without permitting a new session", async () => {
  const f = fixture();
  f.state.activeSub = null;
  const grant = createTermMembershipGrant(sub, term, "member-1", cls.id, NOW)!;
  f.state.existing = sessions.map((session) => ({
    id: `e-${session.id}`,
    scheduleId: session.id,
    status: "BOOKED",
    termMembershipGrant: grant,
  }));
  assert.deepEqual((await f.evaluate()).blockers, []);
  f.state.existing.pop();
  assert.ok(
    (await f.evaluate()).blockers.some(
      (b: any) => b.code === "NO_ACTIVE_SUBSCRIPTION",
    ),
  );
});

test("bulk registration stores the grant on every created enrollment", async (t) => {
  const f = fixture();
  // Keep all fixture dates in the future while evaluating the exact same clock.
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  for (const [delegate, methods] of Object.entries(f.db)) {
    if (delegate.startsWith("$")) continue;
    for (const [method, implementation] of Object.entries(
      methods as Record<string, (...args: any[]) => any>,
    ))
      replace(t, prismaConfig.prisma[delegate], method, implementation);
  }
  replace(t, prismaConfig.prisma, "$transaction", f.db.$transaction);
  replace(t, prismaConfig.prisma.notification, "create", async () => ({}));
  await enrollWholeCourse(cls.id, "member-1");
  assert.equal(f.state.writes.length, 2);
  for (const write of f.state.writes)
    assert.equal(write.termMembershipGrant.policy, "HALF_REMAINING_TERM_V1");
});

test("QR check-in accepts an enrolled term grant after plan expiry", async (t) => {
  const now = new Date();
  const oldSub = {
    ...sub,
    startDate: new Date(now.getTime() - 180 * DAY),
    endDate: new Date(now.getTime() - 30 * DAY),
  };
  const approvedAt = new Date(oldSub.startDate.getTime() + 70 * DAY);
  const grant = createTermMembershipGrant(
    oldSub,
    { ...term, endDate: new Date(now.getTime() + DAY) },
    "member-1",
    cls.id,
    approvedAt,
  )!;
  const schedule = {
    id: "today",
    classId: cls.id,
    termId: term.id,
    status: "SCHEDULED",
    startTime: new Date(now.getTime() - 60000),
    endTime: new Date(now.getTime() + 3600000),
  };
  let enrollmentStatus = "BOOKED";
  const db = {
    memberProfile: { findUnique: async () => ({ id: "member-1" }) },
    enrollment: {
      findUnique: async () => ({
        status: enrollmentStatus,
        termMembershipGrant: grant,
      }),
    },
    membershipSubscription: { findFirst: async () => null },
    classSchedule: { findUnique: async () => schedule },
    attendance: {
      findUnique: async () => null,
      create: async ({ data }: any) => data,
    },
  };
  for (const [delegate, methods] of Object.entries(db)) {
    for (const [method, implementation] of Object.entries(methods))
      replace(t, prismaConfig.prisma[delegate], method, implementation);
  }
  const qrToken = jwt.sign(
    { scheduleId: schedule.id, type: "ATTENDANCE_QR" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: 60 },
  );
  assert.equal(
    (await scanQr({ qrToken }, { id: "user-1", role: "MEMBER" })).status,
    "PRESENT",
  );
  enrollmentStatus = "CANCELLED";
  await assert.rejects(
    () => scanQr({ qrToken }, { id: "user-1", role: "MEMBER" }),
    /chưa đặt chỗ/,
  );
});

test("facility entry after expiry is limited to an approved session at the correct facility", async (t) => {
  const now = new Date();
  const oldSub = { ...sub, startDate: new Date(now.getTime() - 180 * DAY), endDate: new Date(now.getTime() - 30 * DAY) };
  const grant = createTermMembershipGrant(oldSub, { ...term, endDate: new Date(now.getTime() + DAY) }, "member-1", cls.id, new Date(now.getTime() - 110 * DAY))!;
  const row = { classId: cls.id, termMembershipGrant: grant, schedule: { termId: term.id, startTime: new Date(now.getTime() + 10 * 60000), endTime: new Date(now.getTime() + 70 * 60000) } };
  const visits: unknown[] = [];
  const db: any = {
    $executeRaw: async () => [],
    facility: { findUnique: async () => ({ isActive: true }) },
    membershipSubscription: { findFirst: async () => null },
    enrollment: { findMany: async ({ where }: any) => {
      assert.equal(where.memberId, "member-1");
      assert.equal(where.status, "BOOKED");
      assert.ok(where.schedule.startTime.lte >= row.schedule.startTime);
      return where.schedule.class.facilityId === "facility-1" ? [row] : [];
    } },
    facilityVisit: { findFirst: async () => null, create: async ({ data }: any) => { visits.push(data); return data; } },
  };
  replace(t, prismaConfig.prisma, "$transaction", async (callback: any) => callback(db));
  const visit = await requestContext.run({ facilityId: "facility-1" }, () => checkIn("member-1", "QR", now));
  assert.equal(visit.visit.facilityId, "facility-1");
  await assert.rejects(() => requestContext.run({ facilityId: "facility-other" }, () => checkIn("member-1", "QR", now)), /không có gói tập/);
  row.schedule.termId = "other-term";
  await assert.rejects(() => requestContext.run({ facilityId: "facility-1" }, () => checkIn("member-1", "QR", now)), /không có gói tập/);
  assert.equal(visits.length, 1);
});

test("a failing course guard prevents every enrollment write", async (t) => {
  const f = fixture(); f.state.full = true;
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  for (const [delegate, methods] of Object.entries(f.db)) {
    if (delegate.startsWith("$")) continue;
    for (const [method, implementation] of Object.entries(methods as Record<string, (...args: any[]) => any>)) replace(t, prismaConfig.prisma[delegate], method, implementation);
  }
  replace(t, prismaConfig.prisma, "$transaction", f.db.$transaction);
  await assert.rejects(() => enrollWholeCourse(cls.id, "member-1"), /Không thể đăng ký trọn khóa/);
  assert.deepEqual(f.state.writes, []);
});
