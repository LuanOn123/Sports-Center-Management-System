import assert from "node:assert/strict";
import { test } from "node:test";

// Regression tests for audit findings AUD-01..AUD-10 (docs/audit/BUSINESS_RULE_REVIEW_2026-10-28.vi.md).
// These started as reproductions of the defects; the assertions now describe the FIXED behavior.
// No database is contacted. Restore each injected dependency after its case.
process.env.DATABASE_URL = "postgresql://audit:audit@127.0.0.1:1/audit";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/audit";
process.env.JWT_ACCESS_SECRET = "audit-access-secret-do-not-deploy";
process.env.JWT_REFRESH_SECRET = "audit-refresh-secret-do-not-deploy";
const { prisma } = require("../src/config/prisma.js");
const { checkFacilityScope } = require("../src/middlewares/facilityScope.js");
const { inspectPlanPurchase } = require("../src/modules/subscriptions/subscription-purchase.service.js");
const { findActiveSubscription } = require("../src/modules/enrollments/enrollment-quota.service.js");
const { updatePaymentStatus } = require("../src/modules/payments/payments.service.js");
const { UpdateTermSchema } = require("../src/modules/terms/terms.schema.js");
const { updateTerm } = require("../src/modules/terms/terms.service.js");
const { createAttendance } = require("../src/modules/attendance/attendance.service.js");
const { createUser, deactivateUser } = require("../src/modules/users/users.service.js");
const { User } = require("../src/models/User.js");
const { MemberProfile } = require("../src/models/MemberProfile.js");
const { CoachProfile } = require("../src/models/CoachProfile.js");
const { ManagerProfile } = require("../src/models/ManagerProfile.js");
const mongoose = require("mongoose");
const { changePassword } = require("../src/modules/auth/auth.service.js");
const { authenticate } = require("../src/middlewares/authenticate.js");
const { signAccessToken } = require("../src/utils/jwt.js");
const { hashPassword } = require("../src/utils/bcrypt.js");
const { RefreshToken } = require("../src/models/RefreshToken.js");
const { validateResources } = require("../src/modules/operations/scheduling.js");

async function fixture(run: (stub: (object: any, key: string, value: any) => void) => Promise<void>) {
  const originals: [any, string, any][] = [];
  const stub = (object: any, key: string, value: any) => {
    originals.push([object, key, object[key]]);
    object[key] = value;
  };
  try { await run(stub); }
  finally { for (const [object, key, value] of originals.reverse()) object[key] = value; }
}

test("AUD-05: admin facility report with matching query and header is not a conflict", async () => {
  await fixture(async stub => {
    stub(prisma.facility, "findUnique", async () => ({ id: "facility-a", isActive: true }));
    let error: any = "not-called";
    await checkFacilityScope({ user: { id: "admin", role: "ADMIN" }, params: {}, query: { facilityId: "facility-a" },
      body: {}, get: () => "facility-a" }, {}, (result: any) => { error = result; });
    // The FE no longer sends the ALL sentinel; a matching facility passes the middleware.
    assert.equal(error, undefined);
  });
});

test("AUD-01: a second purchase is rejected while a paid renewal is already queued", async () => {
  const now = new Date("2026-10-28T00:00:00Z");
  const plan = { id: "monthly", name: "Monthly", tier: "MEMBERSHIP", durationDays: 30 };
  const current = { id: "active", tier: "MEMBERSHIP", endDate: new Date("2026-11-10T00:00:00Z"), plan, payments: [] };
  const queued = { id: "queued", tier: "MEMBERSHIP", startDate: current.endDate, plan };
  let hasQueued = false;
  const db = { membershipSubscription: { findFirst: async (query: any) =>
    query.where.status === "SCHEDULED" ? (hasQueued ? queued : null) : current } };
  const first = await inspectPlanPurchase(db, "member", plan, undefined, now);
  assert.equal(first.targetStatus, "SCHEDULED");
  hasQueued = true;
  await assert.rejects(() => inspectPlanPurchase(db, "member", plan, undefined, now),
    (err: any) => err.statusCode === 409 && err.errors?.code === "PENDING_SUBSCRIPTION_EXISTS");
});

test("AUD-02: lazy activation does not revive a row cancelled after it was read", async () => {
  let queuedStatus = "SCHEDULED";
  let activeStatus = "ACTIVE";
  let locked = false;
  const tx: any = {
    $executeRaw: async () => { locked = true; },
    membershipSubscription: {
      findFirst: async (query: any) => {
        if (query.where.status === "SCHEDULED") { queuedStatus = "CANCELLED"; return { id: "queued", memberId: "member" }; }
        return activeStatus === "ACTIVE" ? { id: "active", status: "ACTIVE" } : null;
      },
      updateMany: async (args: any) => {
        if (args.where.id === "queued") {
          if (queuedStatus !== args.where.status) return { count: 0 };
          queuedStatus = args.data.status;
          return { count: 1 };
        }
        activeStatus = "SUSPENDED";
        return { count: 1 };
      },
      findUnique: async () => null,
    },
  };
  const db = { ...tx, $transaction: async (run: any) => run(tx) };
  const result = await findActiveSubscription(db, "member");
  assert.equal(locked, true);
  assert.equal(queuedStatus, "CANCELLED");
  assert.equal(activeStatus, "ACTIVE");
  assert.equal(result.id, "active");
});

test("AUD-03: refunding a payment also cancels its paid SCHEDULED subscription", async () => {
  await fixture(async stub => {
    const payment: any = { id: "cash", status: "SUCCESS", gateway: null, amount: 300000,
      subscriptionId: "queued", memberId: "member", invoice: null };
    const sub: any = { id: "queued", status: "SCHEDULED", memberId: "member" };
    stub(prisma.payment, "findUnique", async () => payment);
    stub(prisma, "$transaction", async (run: any) => run({
      $executeRaw: async () => {},
      payment: { updateMany: async ({ data }: any) => { Object.assign(payment, data); return { count: 1 }; } },
      membershipSubscription: {
        findUnique: async () => sub,
        updateMany: async ({ where, data }: any) => {
          if (!where.status.in.includes(sub.status)) return { count: 0 };
          Object.assign(sub, data);
          return { count: 1 };
        },
      },
    }));
    await updatePaymentStatus("cash", "REFUNDED");
    assert.equal(payment.status, "REFUNDED");
    assert.equal(sub.status, "CANCELLED");
  });
});

test("AUD-07: partial term update cannot move the end date before the stored start date", async () => {
  await fixture(async stub => {
    const term = { id: "term", startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-12-01T00:00:00Z") };
    const patch = UpdateTermSchema.parse({ endDate: "2026-10-01T00:00:00Z" });
    let written = false;
    stub(prisma.term, "findUnique", async () => term);
    stub(prisma.classSchedule, "count", async () => 0);
    stub(prisma.term, "update", async ({ data }: any) => { written = true; return { ...term, ...data }; });
    await assert.rejects(() => updateTerm("term", patch), /Ngày kết thúc kỳ học phải sau ngày bắt đầu/);
    assert.equal(written, false);
  });
});

test("AUD-06: support coach may take attendance when a substitute primary is set", async () => {
  await fixture(async stub => {
    let passedCoachGuard = false;
    const schedule = { id: "session", coachId: "substitute",
      class: { coaches: [{ coachId: "primary", isPrimary: true }, { coachId: "support", isPrimary: false }] } };
    stub(prisma.classSchedule, "findUnique", async (args: any) => {
      if (!args.include) passedCoachGuard = true;
      return schedule;
    });
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "support" }));
    // The later attendance-window check fails on this minimal fixture; only the coach guard matters.
    await createAttendance({ scheduleId: "session", memberId: "member", status: "PRESENT" },
      { id: "support-user", role: "COACH" }).catch((err: any) => assert.doesNotMatch(String(err.message), /not assigned/));
    assert.equal(passedCoachGuard, true);

    // The replaced primary coach no longer teaches this session.
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "primary" }));
    await assert.rejects(() => createAttendance({ scheduleId: "session", memberId: "member", status: "PRESENT" },
      { id: "primary-user", role: "COACH" }), /not assigned/);
  });
});

test("AUD-04: PostgreSQL failure compensates the committed Mongo account", async () => {
  await fixture(async stub => {
    let committed = false;
    let deletedUser = false;
    stub(User, "findOne", async () => null);
    stub(User.prototype, "save", async function (this: any) { return this; });
    stub(User, "deleteOne", async () => { deletedUser = true; return { deletedCount: 1 }; });
    for (const model of [MemberProfile, CoachProfile, ManagerProfile])
      stub(model, "deleteOne", async () => ({ deletedCount: 0 }));
    stub(mongoose, "startSession", async () => ({
      startTransaction() {}, commitTransaction: async () => { committed = true; },
      inTransaction: () => !committed,
      abortTransaction: async () => {}, endSession() {},
    }));
    stub(prisma, "$transaction", async () => { throw new Error("injected PostgreSQL failure"); });
    stub(console, "error", () => {});
    await assert.rejects(() => createUser({ email: "audit@example.invalid", password: "AuditOnly123!",
      fullName: "Audit", role: "RECEPTIONIST" }), /injected PostgreSQL failure/);
    assert.equal(committed, true);
    assert.equal(deletedUser, true);
  });
});

test("AUD-08: disabling another ADMIN counts ADMIN accounts", async () => {
  await fixture(async stub => {
    let predicate: any;
    stub(User, "findById", async () => ({ _id: "admin-2", role: "ADMIN" }));
    stub(User, "countDocuments", async (query: any) => { predicate = query; return 1; });
    await assert.rejects(() => deactivateUser("admin-2", "admin-1"), /last active ADMIN/);
    assert.equal(predicate.role, "ADMIN");
  });
});

test("AUD-09: an existing access token is rejected after a password change", async () => {
  await fixture(async stub => {
    const user: any = { _id: "user", role: "MEMBER", isActive: true, password: await hashPassword("OldPassword123!") };
    const token = signAccessToken({ id: "user", role: "MEMBER" });
    // JWT iat has one-second resolution; change the password in a later second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    stub(User, "findById", () => ({ select: () => {
      const result: any = Promise.resolve(user);
      result.lean = async () => user;
      return result;
    } }));
    stub(User, "updateOne", async (_where: any, data: any) => { Object.assign(user, data); return { modifiedCount: 1 }; });
    stub(RefreshToken, "deleteMany", async () => ({ deletedCount: 1 }));
    await changePassword("user", "OldPassword123!", "NewPassword123!");
    let status = 0;
    let nextCalled = false;
    await authenticate({ headers: { authorization: `Bearer ${token}` } },
      { status(code: number) { status = code; return { json() { return this; } }; } }, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(status, 401);
  });
});

test("AUD-10: resource validation enforces the class requirements snapshot", async () => {
  const db = {
    class: { findUnique: async () => ({ id: "class", isActive: true, facilityId: "facility", capacity: 10,
      areaType: "INDOOR", requirementsSnapshot: { training_equipment: 1 },
      sports: [{ id: "gym", requirements: [] }], coaches: [{ coachId: "coach", isPrimary: true }] }) },
    room: { findUnique: async () => ({ isActive: true, facilityId: "facility", capacity: 10, areaType: "INDOOR", capabilities: [] }) },
    coachProfile: { findUnique: async () => ({ user: { isActive: true }, userId: "coach-user", specializations: [{ sportId: "gym" }] }) },
    facilityStaff: { findFirst: async () => ({ id: "assignment" }) },
    leaveRequest: { findFirst: async () => null },
  };
  await assert.rejects(() => validateResources(db, "room", "class",
    new Date("2026-11-01T01:00:00Z"), new Date("2026-11-01T02:00:00Z")), /ROOM_CAPABILITY_MISSING/);
});

const { assignCoach, removeCoach } = require("../src/modules/classes/classes.service.js");

function classCoachTx(rows: any[], upcoming: number, log: string[]) {
  return {
    $executeRaw: async () => { log.push("lock"); },
    classSchedule: { count: async () => upcoming },
    classMember: {
      findUnique: async ({ where }: any) => rows.find((r) => r.coachId === where.classId_coachId.coachId) ?? null,
      findFirst: async () => rows.find((r) => r.isPrimary) ?? null,
      updateMany: async ({ where, data }: any) => {
        for (const r of rows) if (r.isPrimary && r.coachId !== where.coachId.not) Object.assign(r, data);
        return { count: 1 };
      },
      upsert: async ({ where, update, create }: any) => {
        const row = rows.find((r) => r.coachId === where.classId_coachId.coachId);
        if (row) Object.assign(row, update); else rows.push({ ...create });
      },
      delete: async ({ where }: any) => {
        rows.splice(rows.findIndex((r) => r.coachId === where.classId_coachId.coachId), 1);
      },
    },
  };
}

test("R-04: primary coach cannot be removed while the class has upcoming sessions", async () => {
  await fixture(async stub => {
    const rows = [{ coachId: "primary", isPrimary: true }, { coachId: "support", isPrimary: false }];
    const log: string[] = [];
    stub(prisma.classMember, "findUnique", async () => ({ ...rows[0], class: { name: "Yoga" }, coach: { user: { fullName: "A" } } }));
    stub(prisma, "$transaction", async (run: any) => run(classCoachTx(rows, 3, log)));
    await assert.rejects(() => removeCoach("class", "primary"),
      (err: any) => err.statusCode === 409 && err.errors?.code === "PRIMARY_COACH_REQUIRED");
    assert.equal(rows.length, 2);
    assert.deepEqual(log, ["lock"]);
  });
});

test("R-03/R-04: replacing the primary coach locks the class, demotes the old primary and notifies members", async () => {
  await fixture(async stub => {
    const rows: any[] = [{ coachId: "old", isPrimary: true, coach: { user: { fullName: "Old Coach" } } }];
    const log: string[] = [];
    let notified: any;
    stub(prisma.class, "findUnique", async () => ({ id: "class", name: "Yoga", isActive: true, facilityId: "f", sports: [{ id: "yoga" }] }));
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "new", userId: "u",
      user: { isActive: true, role: "COACH", fullName: "New Coach" }, specializations: [{ sportId: "yoga" }] }));
    stub(prisma.facilityStaff, "findFirst", async () => ({ id: "staff" }));
    stub(prisma.classSchedule, "findMany", async (args: any) => {
      if (args?.include?.enrollments) {
        notified = args.where;
        return [];
      }
      return [];
    });
    stub(prisma.classSchedule, "findFirst", async () => null);
    stub(prisma, "$transaction", async (run: any) => run(classCoachTx(rows, 5, log)));
    await assignCoach("class", "new", true).catch(() => {}); // getClassById afterwards hits the DB
    assert.deepEqual(log, ["lock"]);
    assert.deepEqual(rows.map((r) => [r.coachId, r.isPrimary]), [["old", false], ["new", true]]);
    assert.equal(notified?.coachId, null); // only sessions taught by the class primary
  });
});

const { promoteNextEligible } = require("../src/modules/waitlist/waitlist.promotion.js");

test("R-05: waitlist promotion never waits for a busy member's locks and moves to the next member", async () => {
  const blockingLocks: unknown[] = [];
  const tryLockFor: string[] = [];
  const claims: string[] = [];
  const busy = new Set(["member-b"]);
  const tx: any = {
    $executeRaw: async (...args: unknown[]) => { blockingLocks.push(args); },
    $queryRaw: async (_sql: unknown, memberId: string) => {
      tryLockFor.push(memberId);
      return [{ acquired: !busy.has(memberId) }];
    },
    waitlistEntry: {
      findMany: async () => [{ id: "w1", memberId: "member-b" }, { id: "w2", memberId: "member-c" }],
      updateMany: async ({ where }: any) => { claims.push(where.id); return { count: 0 }; },
    },
  };
  // assertCanBook for member-c runs against this minimal fixture and fails, which is fine:
  // the point is that member-b (busy) was skipped without a blocking lock.
  const result = await promoteNextEligible(tx, "session", {
    id: "session", startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000),
    class: { id: "class", classType: "MEMBERSHIP", capacity: 10 },
  });
  assert.equal(result, null);
  assert.deepEqual(tryLockFor, ["member-b", "member-c"]);
  assert.equal(blockingLocks.length, 0);
  assert.equal(claims.includes("w1"), false);
});

const { createFeedback } = require("../src/modules/feedbacks/feedbacks.service.js");
const { resolveScheduleTerm } = require("../src/modules/terms/terms.service.js");

function feedbackFixture(stub: any, eligible: boolean) {
  const filters: any[] = [];
  stub(prisma.memberProfile, "findUnique", async () => ({ id: "member" }));
  stub(prisma.coachProfile, "findUnique", async () => ({ id: "coach", user: { isActive: true } }));
  stub(prisma.attendance, "findFirst", async (args: any) => { filters.push(args.where); return eligible ? { id: "a" } : null; });
  stub(prisma.enrollment, "findFirst", async (args: any) => { filters.push(args.where); return null; });
  return filters;
}

test("R-06: feedback for a class requires an attended past session of THAT class taught by the coach", async () => {
  await fixture(async stub => {
    const filters = feedbackFixture(stub, false);
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

test("R-06: resubmitting a general (no-class) feedback updates the existing one instead of adding another", async () => {
  await fixture(async stub => {
    feedbackFixture(stub, true);
    let created = 0;
    let updated = "";
    stub(prisma.coachFeedback, "findFirst", async (args: any) => {
      assert.equal(args.where.classId, null);
      return { id: "existing" };
    });
    stub(prisma.coachFeedback, "update", async (args: any) => { updated = args.where.id; return { id: args.where.id }; });
    stub(prisma.coachFeedback, "create", async () => { created++; return { id: "new" }; });
    await createFeedback({ coachId: "coach", rating: 5 }, "user");
    assert.equal(updated, "existing");
    assert.equal(created, 0);
  });
});

test("R-07: a schedule outside every open term is rejected with TERM_REQUIRED", async () => {
  const db = { term: { findFirst: async () => null } };
  await assert.rejects(() => resolveScheduleTerm(db, "facility", new Date("2026-12-01T01:00:00Z"), new Date("2026-12-01T02:00:00Z")),
    (err: any) => err.statusCode === 400 && err.errors?.code === "TERM_REQUIRED");
});

test("R-07: without termId the facility's own covering term is preferred over a system-wide term", async () => {
  const queries: any[] = [];
  const db = { term: { findFirst: async (args: any) => {
    queries.push(args.where);
    return args.where.facilityId === "facility" ? { id: "facility-term" } : { id: "global-term" };
  } } };
  const termId = await resolveScheduleTerm(db, "facility", new Date("2026-11-01T01:00:00Z"), new Date("2026-11-01T02:00:00Z"));
  assert.equal(termId, "facility-term");
  assert.deepEqual(queries[0].status, { not: "CLOSED" });
});
