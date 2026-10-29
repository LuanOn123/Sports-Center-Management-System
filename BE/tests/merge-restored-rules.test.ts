import assert from "node:assert/strict";
import { test } from "node:test";

// Regression tests for rules re-applied after merging origin/develop (business rule hardening):
// R-06 feedback eligibility, member role change vs FREE, coach-change notifications, detailed
// schedule conflicts. No database is contacted. Restore each injected dependency after its case.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "test-only-restored-rules-access-secret";
process.env.JWT_REFRESH_SECRET = "test-only-restored-rules-refresh-secret";
const { prisma } = require("../src/config/prisma.js");
const { createFeedback } = require("../src/modules/feedbacks/feedbacks.service.js");
const { updateUser } = require("../src/modules/users/users.service.js");
const { assignCoach } = require("../src/modules/classes/classes.service.js");
const { createScheduleBatch } = require("../src/modules/class-schedules/class-schedules.service.js");
const { User } = require("../src/models/User.js");
const { MemberProfile } = require("../src/models/MemberProfile.js");

async function fixture(run: (stub: (object: any, key: string, value: any) => void) => Promise<void>) {
  const originals: [any, string, any][] = [];
  const stub = (object: any, key: string, value: any) => {
    originals.push([object, key, object[key]]);
    object[key] = value;
  };
  try { await run(stub); }
  finally { for (const [object, key, value] of originals.reverse()) object[key] = value; }
}

test("R-06: feedback requires an attended past session of that class taught by the coach", async () => {
  await fixture(async stub => {
    const filters: any[] = [];
    stub(prisma.memberProfile, "findUnique", async () => ({ id: "member" }));
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "coach", user: { isActive: true } }));
    stub(prisma.attendance, "findFirst", async (args: any) => { filters.push(args.where); return null; });
    stub(prisma.enrollment, "findFirst", async (args: any) => { filters.push(args.where); return null; });
    await assert.rejects(() => createFeedback({ coachId: "coach", classId: "advanced", rating: 1 }, "user"),
      (err: any) => err.statusCode === 403 && err.errors?.code === "FEEDBACK_NOT_ELIGIBLE");
    const [attendance, enrollment] = filters;
    assert.deepEqual(attendance.status, { in: ["PRESENT", "LATE"] });
    assert.equal(enrollment.status, "COMPLETED"); // a future BOOKED seat is not enough
    assert.equal(attendance.schedule.classId, "advanced");
    assert.ok(attendance.schedule.startTime.lte instanceof Date);
    // substitute coach and support coach both count as teaching the session
    assert.ok(attendance.schedule.OR.some((row: any) => row.coachId === "coach"));
    assert.ok(attendance.schedule.OR.some((row: any) => row.class?.coaches?.some?.isPrimary === false));
  });
});

test("member role change is not blocked by the system FREE subscription", async () => {
  await fixture(async stub => {
    let predicate: any;
    stub(prisma, "$transaction", async (run: any) => run({ $executeRaw: async () => 0 }));
    stub(prisma.coachProfile, "findUnique", async () => null);
    stub(User, "findById", async () => ({ _id: "member-user", role: "MEMBER" }));
    stub(MemberProfile, "findOne", async () => ({ _id: "member" }));
    stub(prisma.membershipSubscription, "count", async (args: any) => { predicate = args.where; return 1; });
    await assert.rejects(() => updateUser("member-user", { role: "RECEPTIONIST" }, "admin"), /active subscriptions/);
    assert.deepEqual(predicate.tier, { not: "FREE" });
    assert.deepEqual(predicate.status, { in: ["ACTIVE", "SCHEDULED"] });
  });
});

test("replacing the primary coach notifies booked members who is replacing whom", async () => {
  await fixture(async stub => {
    const bodies: string[] = [];
    let notifiedWhere: any;
    stub(prisma.class, "findUnique", async () => ({ id: "class", name: "Yoga", isActive: true, facilityId: "f", sports: [{ id: "yoga" }] }));
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "new", userId: "u",
      user: { isActive: true, role: "COACH", fullName: "New Coach" }, specializations: [{ sportId: "yoga" }] }));
    stub(prisma.facilityStaff, "findFirst", async () => ({ id: "staff" }));
    stub(prisma.classMember, "findUnique", async () => null);
    stub(prisma.classSchedule, "findFirst", async () => null);
    stub(prisma.classSchedule, "findMany", async (args: any) => {
      if (!args?.include?.enrollments) return [];
      notifiedWhere = args.where;
      return [{ enrollments: [{ member: { userId: "member-user" } }] }];
    });
    stub(prisma.notification, "createMany", async ({ data }: any) => { bodies.push(...data.map((row: any) => row.body)); });
    stub(prisma, "$transaction", async (run: any) => run({
      $executeRaw: async () => 0,
      classSchedule: { count: async () => 0 },
      classMember: {
        findFirst: async () => ({ coachId: "old", isPrimary: true, coach: { user: { fullName: "Old Coach" } } }),
        findUnique: async () => null,
        updateMany: async () => ({ count: 1 }),
        upsert: async () => ({}),
      },
    }));
    await assignCoach("class", "new", true).catch(() => {}); // getClassById afterwards hits the DB
    await new Promise((resolve) => setImmediate(resolve)); // broadcast is fire-and-forget
    assert.equal(notifiedWhere?.coachId, null); // sessions with a per-session substitute keep their teacher
    assert.equal(bodies.length, 1);
    assert.match(bodies[0], /New Coach sẽ thay HLV Old Coach/);
  });
});

test("schedule conflict error names exactly the clashing sessions", async () => {
  await fixture(async stub => {
    const session = (day: number) => ({ startTime: `2099-01-0${day}T01:00:00Z`, endTime: `2099-01-0${day}T03:00:00Z` });
    const tx = {
      $executeRaw: async () => 0,
      class: { findUnique: async () => ({ id: "class", facilityId: "f", isActive: true, areaType: "INDOOR", capacity: 10,
        sports: [{ id: "gym", requirements: [] }], coaches: [{ coachId: "coach", isPrimary: true }] }) },
      room: { findUnique: async () => ({ id: "room", facilityId: "f", isActive: true, areaType: "INDOOR", capacity: 10, capabilities: [] }) },
      classMember: { findMany: async () => [{ coachId: "coach", isPrimary: true }] },
      coachProfile: { findUnique: async () => ({ userId: "coach", user: { isActive: true }, specializations: [{ sportId: "gym" }] }) },
      facilityStaff: { findFirst: async () => ({ isActive: true }) },
      leaveRequest: { findFirst: async () => null },
      classSchedule: {
        findMany: async () => [{ startTime: new Date(session(2).startTime), endTime: new Date(session(2).endTime) }],
        createMany: async () => { throw new Error("must not insert"); },
      },
      term: { findMany: async () => [] },
    };
    stub(prisma, "$transaction", async (run: any) => run(tx));
    await assert.rejects(() => createScheduleBatch({ classId: "class", roomId: "room", schedules: [session(1), session(2), session(3)] }),
      (err: any) => err.statusCode === 409 && err.errors?.code === "SCHEDULE_CONFLICT"
        && /ở 1 buổi: 08:00 02\/01\/2099\. /.test(err.message) && err.errors.conflictingSessions.length === 1);
  });
});
