import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "test-membership-usage-access-secret";
process.env.JWT_REFRESH_SECRET = "test-membership-usage-refresh-secret";
const { prisma } = require("../src/config/prisma.js");
const { requestContext } = require("../src/config/request-context.js");
const { getMembershipReport } = require("../src/modules/reports/reports.service.js");
const { missingCapabilities } = require("../src/modules/operations/rules.js");

test("indoor equipment is a yes/no requirement, independent of equipment name or quantity", () => {
  assert.deepEqual(missingCapabilities({ treadmill: 5 }, [{ key: "training_equipment", quantity: 1 }], "INDOOR"), []);
  assert.deepEqual(missingCapabilities({ treadmill: 5 }, [], "INDOOR"), ["Dụng cụ tập luyện"]);
  assert.deepEqual(missingCapabilities({ treadmill: 5 }, [], "OUTDOOR"), []);
  assert.deepEqual(missingCapabilities({ treadmill: 5 }, [], "POOL"), []);
});

function booking(memberId: string, planId: string | null, classId = "gym") {
  return { id: `${memberId}-${planId}-${Math.random()}`, memberId, classId, subscriptionId: planId ? `sub-${planId}` : null,
    subscription: planId ? { planId } : null, member: { user: { fullName: memberId } },
    class: { id: classId, name: classId === "gym" ? "Gym sáng" : "Yoga", classType: "REGULAR", sports: [{ name: classId }] } };
}

async function withFixture(run: (f: { queries: any[] }) => Promise<void>) {
  const originals: [any, string, any][] = [];
  const stub = (delegate: any, method: string, value: any) => { originals.push([delegate, method, delegate[method]]); delegate[method] = value; };
  const plans = ["monthly", "premium", "old-plan"].map((id) => ({ id, name: id, tier: "MEMBERSHIP", price: 300000, durationDays: 30, isActive: true }));
  stub(prisma.membershipPlan, "findMany", async () => plans);
  stub(prisma.membershipSubscription, "count", async () => 2);
  stub(prisma.membershipSubscription, "groupBy", async () => []);
  // The same member bought both plans this month; the old plan was bought before the reporting window.
  stub(prisma.membershipSubscription, "findMany", async () => [
    { id: "sub-monthly", planId: "monthly", memberId: "Lan" }, { id: "sub-premium", planId: "premium", memberId: "Lan" },
  ]);
  stub(prisma.payment, "aggregate", async () => ({ _sum: { amount: 600000 } }));
  stub(prisma.payment, "groupBy", async () => []);
  const queries: any[] = [];
  stub(prisma.enrollment, "findMany", async (args: any) => {
    queries.push({ ...args, context: requestContext.getStore() });
    return [booking("Lan", "premium"), booking("Lan", "premium"), booking("Minh", "old-plan", "yoga"), booking("Legacy", null)];
  });
  stub(prisma.term, "findUnique", async () => ({ id: "term-a", facilityId: "facility-a" }));
  try { await run({ queries }); } finally { for (const [delegate, method, original] of originals.reverse()) delegate[method] = original; }
}

test("a booking belongs only to the plan actually recorded, and old purchases still contribute usage", async () => {
  await withFixture(async ({ queries }) => {
    const report = await requestContext.run({ facilityId: "facility-a", role: "MANAGER" }, () => getMembershipReport("2026-10-01", "2026-10-28"));
    const monthly = report.plansBreakdown.find((row: any) => row.planId === "monthly");
    const premium = report.plansBreakdown.find((row: any) => row.planId === "premium");
    const old = report.plansBreakdown.find((row: any) => row.planId === "old-plan");
    assert.equal(monthly.soldCount, 1);
    assert.equal(monthly.enrollmentStats.totalClassEnrollments, 0);
    assert.equal(premium.enrollmentStats.totalClassEnrollments, 2);
    assert.equal(premium.enrollmentStats.enrolledMembersCount, 1);
    assert.equal(premium.enrollmentStats.classRegistrationCount, 1);
    assert.equal(premium.enrollmentStats.memberUsage[0].memberName, "Lan");
    assert.equal(old.soldCount, 0);
    assert.equal(old.enrollmentStats.totalClassEnrollments, 1);
    assert.equal(report.unattributedEnrollments, 1);
    assert.equal(report.attributedEnrollments, 3);
    assert.deepEqual(queries[0].where.class, { facilityId: "facility-a" });
    assert.deepEqual(queries[0].where.status, { in: ["BOOKED", "COMPLETED"] });
  });
});

test("global admin usage clears selected-facility scoping and can filter a particular term", async () => {
  await withFixture(async ({ queries }) => {
    await requestContext.run({ facilityId: "facility-b", role: "ADMIN" }, () => getMembershipReport("2026-10-01", "2026-10-28", "ALL", "term-a"));
    assert.equal(queries[0].context.facilityId, undefined);
    assert.equal(queries[0].where.class, undefined);
    assert.deepEqual(queries[0].where.schedule, { termId: "term-a" });
  });
});

test("a manager cannot select a term belonging to another facility", async () => {
  await withFixture(async () => {
    await assert.rejects(requestContext.run({ facilityId: "facility-b", role: "MANAGER" }, () => getMembershipReport("2026-10-01", "2026-10-28", undefined, "term-a")), /phạm vi báo cáo/);
  });
});

for (const currentActive of [false, true]) {
  test(`term-grant transfers retain their original subscription with ${currentActive ? "another active plan" : "no active plan"}`, async () => {
    const { assertCanBook } = require("../src/modules/enrollments/enrollments.service.js");
    const { createTermMembershipGrant } = require("../src/modules/enrollments/term-membership-policy.js");
    const grant = createTermMembershipGrant({ id: "original-paid-sub", status: "ACTIVE",
      startDate: new Date("2020-01-01"), endDate: new Date("2040-01-01") },
      { id: "term", endDate: new Date("2099-01-01") }, "member", "gym", new Date("2026-01-01"));
    assert.ok(grant);
    const schedule = { id: "target", termId: "term", startTime: new Date("2080-01-01T01:00:00Z"),
      endTime: new Date("2080-01-01T02:00:00Z"),
      class: { id: "gym", capacity: 20, classType: "REGULAR", facilityId: null } };
    const tx = {
      membershipSubscription: { findFirst: async ({ where }: any) => where.id ? { id: "original-paid-sub" } : where.status === "SCHEDULED" || !currentActive ? null :
        { id: "unrelated-new-sub", tier: "PREMIUM", endDate: new Date("2099-01-01"), plan: { maxConcurrentClasses: 6 } } },
      classSchedule: { findFirst: async () => schedule },
      term: { findUnique: async () => ({ id: "term", status: "IN_PROGRESS", registrationStartDate: new Date("2000-01-01"), registrationEndDate: new Date("2099-01-01") }) },
      class: { findUnique: async () => ({ facilityId: null }) },
      issue: { findMany: async () => [] }, attendancePenalty: { findFirst: async () => null },
      enrollment: { findMany: async () => [], count: async () => 0, findUnique: async () => null, findFirst: async () => null },
    };
    let sourceId: string | undefined;
    await assertCanBook(tx, "member", schedule, { termMembershipGrant: grant, quotaExemptClassId: "gym",
      onSubscriptionSelected: (id: string) => { sourceId = id; } });
    assert.equal(sourceId, "original-paid-sub");
  });
}

for (const reactivate of [false, true]) {
  test(`${reactivate ? "reactivating" : "creating"} a booking records the exact active subscription`, async () => {
    const { bookClass } = require("../src/modules/enrollments/enrollments.service.js");
    const schedule = { id: "session-a", classId: "gym", status: "SCHEDULED", termId: null,
      startTime: new Date("2080-01-01T01:00:00Z"), endTime: new Date("2080-01-01T03:00:00Z"),
      class: { id: "gym", name: "Gym", classType: "REGULAR", capacity: 20, facilityId: null } };
    const subscription = { id: "actual-premium-sub", tier: "PREMIUM", endDate: new Date("2099-01-01"), plan: { maxConcurrentClasses: 6 } };
    const existing = reactivate ? { id: "old-booking", status: "CANCELLED", subscriptionId: "old-subscription" } : null;
    const writes: any[] = [];
    const save = async ({ data }: any) => { writes.push(data); return { ...data, id: "booking", member: { userId: "user-a" }, schedule }; };
    const tx = {
      $executeRaw: async () => 0,
      membershipSubscription: { findFirst: async ({ where }: any) => where.status === "SCHEDULED" ? null : subscription },
      classSchedule: { findUnique: async () => schedule, findFirst: async () => schedule },
      class: { findUnique: async () => ({ facilityId: null }) },
      issue: { findMany: async () => [] }, attendancePenalty: { findFirst: async () => null },
      enrollment: { count: async () => 0, findUnique: async () => existing, findFirst: async () => null, findMany: async () => [], create: save, update: save },
      notificationOutbox: { create: async () => ({ id: "notification" }) },
    };
    const originalTransaction = prisma.$transaction;
    const originalMember = prisma.memberProfile.findUnique;
    const originalSchedule = prisma.classSchedule.findUnique;
    const originalOutbox = prisma.notificationOutbox.findMany;
    prisma.$transaction = async (callback: any) => callback(tx);
    prisma.memberProfile.findUnique = async () => ({ id: "member-a", user: { id: "user-a", isActive: true, role: "MEMBER" } });
    prisma.classSchedule.findUnique = async () => schedule;
    prisma.notificationOutbox.findMany = async () => [];
    try {
      await bookClass("session-a", "member-a", "MEMBER");
      assert.equal(writes.length, 1);
      assert.equal(writes[0].subscriptionId, subscription.id);
    } finally {
      prisma.$transaction = originalTransaction;
      prisma.memberProfile.findUnique = originalMember;
      prisma.classSchedule.findUnique = originalSchedule;
      prisma.notificationOutbox.findMany = originalOutbox;
    }
  });
}
