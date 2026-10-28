import assert from "node:assert/strict";
import { test } from "node:test";

// Audit evidence only: these tests deliberately assert the CURRENT defective
// behavior. Passing proves a reproduction, not a correct business rule.
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

test("REPRO A: admin ALL query conflicts with the selected facility header", async () => {
  let error: any;
  await checkFacilityScope({ user: { id: "admin", role: "ADMIN" }, params: {}, query: { facilityId: "ALL" },
    body: {}, get: () => "facility-a" }, {}, (result: any) => { error = result; });
  assert.equal(error.message, "CONFLICTING_FACILITY_CONTEXT");
  assert.equal(error.statusCode, 400);
});

test("REPRO B: repeated same-tier renewals ignore a previously queued renewal", async () => {
  const now = new Date("2026-10-28T00:00:00Z");
  const plan = { id: "monthly", name: "Monthly", tier: "MEMBERSHIP", durationDays: 30 };
  const current = { id: "active", tier: "MEMBERSHIP", endDate: new Date("2026-11-10T00:00:00Z"), plan, payments: [] };
  const reads: any[] = [];
  const db = { membershipSubscription: { findFirst: async (query: any) => { reads.push(query); return current; } } };
  const first = await inspectPlanPurchase(db, "member", plan, undefined, now);
  // Even if the first purchase has created a SCHEDULED row, the next lookup
  // only selects ACTIVE. This fixture models that exact selection predicate.
  const second = await inspectPlanPurchase(db, "member", plan, undefined, now);
  assert.equal(first.targetStatus, "SCHEDULED");
  assert.equal(second.calculatedStartDate.getTime(), first.calculatedStartDate.getTime());
  assert.ok(reads.every(query => query.where.status === "ACTIVE"));
});

test("REPRO C: lazy activation revives a cancelled row after an interleaved cancellation", async () => {
  let queuedStatus = "SCHEDULED";
  let activeStatus = "ACTIVE";
  let reads = 0;
  const db = { membershipSubscription: {
    findFirst: async () => {
      if (reads++ === 0) { queuedStatus = "CANCELLED"; return { id: "queued" }; }
      return { id: "queued", status: queuedStatus };
    },
    updateMany: async () => { activeStatus = "SUSPENDED"; return { count: 1 }; },
    update: async (args: any) => { assert.deepEqual(args.where, { id: "queued" }); queuedStatus = args.data.status; },
  } };
  const result = await findActiveSubscription(db, "member");
  assert.equal(result.status, "ACTIVE");
  assert.equal(activeStatus, "SUSPENDED");
});

test("REPRO D: refund succeeds but leaves a paid scheduled subscription intact", async () => {
  await fixture(async stub => {
    const payment: any = { id: "cash", status: "SUCCESS", gateway: null, amount: 300000,
      subscriptionId: "queued", memberId: "member", invoice: null };
    const sub: any = { id: "queued", status: "SCHEDULED", memberId: "member" };
    let subscriptionWrites = 0;
    stub(prisma.payment, "findUnique", async () => payment);
    stub(prisma, "$transaction", async (run: any) => run({
      payment: { updateMany: async ({ data }: any) => { Object.assign(payment, data); return { count: 1 }; } },
      membershipSubscription: { findUnique: async () => sub, update: async () => { subscriptionWrites++; } },
    }));
    await updatePaymentStatus("cash", "REFUNDED");
    assert.equal(payment.status, "REFUNDED");
    assert.equal(sub.status, "SCHEDULED");
    assert.equal(subscriptionWrites, 0);
  });
});

test("REPRO E: partial term update accepts an end date before the stored start date", async () => {
  await fixture(async stub => {
    const term = { id: "term", startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-12-01T00:00:00Z") };
    const patch = UpdateTermSchema.parse({ endDate: "2026-10-01T00:00:00Z" });
    stub(prisma.term, "findUnique", async () => term);
    stub(prisma.classSchedule, "count", async () => 0);
    stub(prisma.term, "update", async ({ data }: any) => ({ ...term, ...data }));
    const result = await updateTerm("term", patch);
    assert.ok(result.endDate < result.startDate);
  });
});

test("REPRO F: support coach is denied attendance when a substitute primary is set", async () => {
  await fixture(async stub => {
    stub(prisma.classSchedule, "findUnique", async () => ({ id: "session", coachId: "substitute",
      class: { coaches: [{ coachId: "primary", isPrimary: true }, { coachId: "support", isPrimary: false }] } }));
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "support" }));
    await assert.rejects(() => createAttendance({ scheduleId: "session", memberId: "member", status: "PRESENT" },
      { id: "support-user", role: "COACH" }), /not assigned/);
  });
});

test("REPRO G: PostgreSQL failure occurs after Mongo account has already committed", async () => {
  await fixture(async stub => {
    let saved = false;
    let committed = false;
    let aborted = false;
    stub(User, "findOne", async () => null);
    stub(User.prototype, "save", async function (this: any) { saved = true; return this; });
    stub(mongoose, "startSession", async () => ({
      startTransaction() {}, commitTransaction: async () => { committed = true; },
      inTransaction: () => !committed,
      abortTransaction: async () => { aborted = true; }, endSession() {},
    }));
    stub(prisma.user, "create", async () => { throw new Error("injected PostgreSQL failure"); });
    await assert.rejects(() => createUser({ email: "audit@example.invalid", password: "AuditOnly123!",
      fullName: "Audit", role: "RECEPTIONIST" }), /injected PostgreSQL failure/);
    assert.equal(saved && committed, true);
    assert.equal(aborted, false);
  });
});

test("REPRO H: disabling another ADMIN incorrectly counts MANAGER accounts", async () => {
  await fixture(async stub => {
    let predicate: any;
    stub(User, "findById", async () => ({ _id: "admin-2", role: "ADMIN" }));
    stub(User, "countDocuments", async (query: any) => { predicate = query; return 1; });
    await assert.rejects(() => deactivateUser("admin-2", "admin-1"), /last active MANAGER/);
    assert.equal(predicate.role, "MANAGER");
  });
});

test("REPRO I: an existing access token remains valid after a password change", async () => {
  await fixture(async stub => {
    const user = { _id: "user", role: "MEMBER", isActive: true, password: await hashPassword("OldPassword123!") };
    const token = signAccessToken({ id: "user", role: "MEMBER" });
    stub(User, "findById", () => ({ select: () => {
      const result: any = Promise.resolve(user);
      result.lean = async () => user;
      return result;
    } }));
    stub(User, "updateOne", async (_where: any, data: any) => { user.password = data.password; return { modifiedCount: 1 }; });
    stub(RefreshToken, "deleteMany", async () => ({ deletedCount: 1 }));
    await changePassword("user", "OldPassword123!", "NewPassword123!");
    let nextCalled = false;
    await authenticate({ headers: { authorization: `Bearer ${token}` } },
      { status() { throw new Error("Unexpected authentication rejection"); } }, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});

test("REPRO J: resource validation reads live sport requirements instead of the class snapshot", async () => {
  const db = {
    class: { findUnique: async () => ({ id: "class", isActive: true, facilityId: "facility", capacity: 10,
      areaType: "INDOOR", requirementsSnapshot: { training_equipment: 1 },
      sports: [{ id: "gym", requirements: [] }], coaches: [{ coachId: "coach", isPrimary: true }] }) },
    room: { findUnique: async () => ({ isActive: true, facilityId: "facility", capacity: 10, areaType: "INDOOR", capabilities: [] }) },
    coachProfile: { findUnique: async () => ({ user: { isActive: true }, userId: "coach-user", specializations: [{ sportId: "gym" }] }) },
    facilityStaff: { findFirst: async () => ({ id: "assignment" }) },
    leaveRequest: { findFirst: async () => null },
  };
  await assert.doesNotReject(() => validateResources(db, "room", "class",
    new Date("2026-11-01T01:00:00Z"), new Date("2026-11-01T02:00:00Z")));
});
