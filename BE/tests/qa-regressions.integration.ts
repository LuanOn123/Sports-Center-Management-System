import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createFixtureSchedule } from "./fixture-schedule.js";

test("QA regressions use real disposable PostgreSQL, MongoDB and HTTP", async t => {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^scms_verify_/);
  assert.match(process.env.MONGO_URI!, /127\.0\.0\.1/);
  const { prisma } = await import("../src/config/prisma.js");
  const { User } = await import("../src/models/User.js");
  const { resetPassword } = await import("../src/modules/auth/auth.service.js");
  const { createPayment } = await import("../src/modules/payments/payments.service.js");
  const { revokeSubscriptionBookings } = await import("../src/modules/subscriptions/entitlement.service.js");
  const { getMemberReport } = await import("../src/modules/reports/reports.service.js");
  const { inspectPlanPurchase } = await import("../src/modules/subscriptions/subscription-purchase.service.js");
  const { createScheduleBatch } = await import("../src/modules/class-schedules/class-schedules.service.js");
  const { assertMemberFacilityAccess } = await import("../src/modules/members/members.service.js");
  const { joinWaitlist } = await import("../src/modules/waitlist/waitlist.service.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const { requestContext } = await import("../src/config/request-context.js");
  const { lockMemberSubscription } = await import("../src/utils/dbLocks.js");
  const { dateOfBirth } = await import("../src/utils/dateOfBirth.js");
  const { default: app } = await import("../src/app.js");
  await mongoose.connect(process.env.MONGO_URI!);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/v1`;
  try {
    const facility = await prisma.facility.create({ data: { code: "qa", name: "QA", address: "Test" } });
    const room = await prisma.room.create({ data: { facilityId: facility.id, name: "QA", capacity: 10, areaType: "INDOOR" } });
    const cls = await prisma.class.create({ data: { facilityId: facility.id, name: "QA", capacity: 1, areaType: "INDOOR" } });
    const start = new Date(Date.now() + 3 * 86_400_000), end = new Date(+start + 3_600_000);
    const schedule = await createFixtureSchedule(prisma, { data: { classId: cls.id, roomId: room.id, startTime: start, endTime: end } });
    const plan = await prisma.membershipPlan.create({ data: { name: "QA paid", tier: "MEMBERSHIP", price: 300000, durationDays: 30, maxConcurrentClasses: 3 } });
    async function member(email: string, active = true) {
      const user = await prisma.user.create({ data: { email, fullName: email, password: "fixture", role: "MEMBER", isActive: active } });
      const profile = await prisma.memberProfile.create({ data: { userId: user.id } });
      return profile;
    }
    const m1 = await member("legacy@test.invalid"), m2 = await member("waiting@test.invalid");
    async function subscription(memberId: string, tier: "FREE" | "MEMBERSHIP" = "MEMBERSHIP") {
      return prisma.membershipSubscription.create({ data: { memberId, planId: plan.id, tier, status: "ACTIVE",
        startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 30 * 86_400_000) } });
    }
    const source = await subscription(m1.id), waiter = await subscription(m2.id);
    await prisma.payment.createMany({ data: [source, waiter].map(sub => ({ memberId: sub.memberId, subscriptionId: sub.id,
      amount: 300000, status: "SUCCESS" as const, method: "CASH" as const, facilityId: facility.id })) });
    const booking = await prisma.enrollment.create({ data: { memberId: m1.id, classId: cls.id, scheduleId: schedule.id, status: "BOOKED" } });
    const context = <T>(run: () => Promise<T>) => requestContext.run({ facilityId: facility.id }, run);

    await t.test("N1: legacy booking is revoked and waitlist promoted in the same transaction", async () => {
      const entry = await context(() => joinWaitlist(schedule.id, m2.id));
      await prisma.$transaction(async tx => {
        await lockMemberSubscription(tx, m1.id);
        await tx.membershipSubscription.update({ where: { id: source.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        await revokeSubscriptionBookings(tx, source);
      });
      assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: booking.id } })).status, "CANCELLED");
      assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status, "PROMOTED");
      const promoted = await prisma.enrollment.findUniqueOrThrow({ where: { memberId_scheduleId: { memberId: m2.id, scheduleId: schedule.id } } });
      assert.equal(promoted.subscriptionId, waiter.id);
    });
    await t.test("N1: FREE does not preserve legacy bookings after cancellation", async () => {
      const member3 = await member("free@test.invalid");
      const free = await subscription(member3.id, "FREE");
      const old = await prisma.membershipSubscription.create({ data: { memberId: member3.id, planId: plan.id, tier: "MEMBERSHIP", status: "CANCELLED", startDate: new Date(), endDate: end } });
      const b = await prisma.enrollment.create({ data: { memberId: member3.id, classId: cls.id, scheduleId: schedule.id } });
      await prisma.$transaction(tx => revokeSubscriptionBookings(tx, old));
      assert.equal((await prisma.enrollment.findUniqueOrThrow({ where: { id: b.id } })).status, "CANCELLED");
      assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: free.id } })).status, "ACTIVE");
      const { checkIn } = await import("../src/modules/facility-visits/facility-visits.service.js");
      const visit = await context(() => checkIn(member3.id, "RECEPTION"));
      assert.equal(visit.visit.memberId, member3.id);
      await assert.rejects(context(() => joinWaitlist(schedule.id, member3.id)), (e: any) => e.statusCode === 403);
    });
    await t.test("H1: arbitrary manual receipts cannot enter the ledger", async () => {
      const before = await prisma.payment.count();
      await assert.rejects(createPayment({ memberId: m1.id, amount: 999999999, method: "CASH" }, "staff"), (e: any) => e.statusCode === 409);
      assert.equal(await prisma.payment.count(), before);
    });
    await t.test("H3: disabled users with ACTIVE subscriptions do not inflate active members", async () => {
      const disabled = await member("disabled@test.invalid", false); await subscription(disabled.id);
      const report = await getMemberReport("2026-01-01", "2099-01-01");
      assert.equal(report.totalMembers, 3); assert.equal(report.activeMembers, 2); assert.equal(report.expiredMembers, 1);
    });
    await t.test("M1/M2/L4: FREE sale, past schedules and impossible birth dates rejected", async () => {
      await assert.rejects(inspectPlanPurchase(prisma, m1.id, { ...plan, tier: "FREE" }), /FREE/);
      await assert.rejects(createScheduleBatch({ classId: cls.id, roomId: room.id,
        schedules: [{ startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 3600000).toISOString() }] }), /quá khứ/);
      assert.equal(dateOfBirth.safeParse("1800-01-01").success, false);
    });
    await t.test("M3/L1: unrelated coach and members without paid entitlement rejected", async () => {
      const assigned = await prisma.classMember.findFirstOrThrow({ where: { classId: cls.id }, include: { coach: true } });
      await assertMemberFacilityAccess(m2.id, { id: assigned.coach.userId, role: "COACH" });
      await assert.rejects(assertMemberFacilityAccess(m1.id, { id: "unrelated", role: "COACH" }), (e: any) => e.statusCode === 404);
      await assert.rejects(context(() => joinWaitlist(schedule.id, m1.id)), (e: any) => e.statusCode === 403);
    });
    const hash = (otp: string) => createHash("sha256").update(otp).digest("hex");
    await t.test("H2: concurrent wrong attempts exhaust OTP; correct code cannot bypass lock", async () => {
      await User.create({ email: "otp@test.invalid", fullName: "OTP", password: "old", resetPasswordOtp: hash("123456"), resetPasswordOtpExpiresAt: new Date(Date.now() + 300000) });
      await Promise.allSettled(Array.from({ length: 20 }, () => resetPassword({ email: "otp@test.invalid", otp: "000000", newPassword: "Changed@123" })));
      const user = await User.findOne({ email: "otp@test.invalid" });
      assert.equal(user!.resetPasswordOtpAttempts, 5);
      await assert.rejects(resetPassword({ email: "otp@test.invalid", otp: "123456", newPassword: "Changed@123" }));
    });
    await t.test("H2: one OTP can change the password only once under concurrent requests", async () => {
      await User.create({ email: "once@test.invalid", fullName: "Once", password: "old", resetPasswordOtp: hash("123456"), resetPasswordOtpExpiresAt: new Date(Date.now() + 300000) });
      const outcomes = await Promise.allSettled([1, 2].map(() => resetPassword({ email: "once@test.invalid", otp: "123456", newPassword: "Changed@123" })));
      assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
    });
    await t.test("H2: HTTP reset attempts are rate limited even for nonexistent accounts", async () => {
      const statuses = [];
      for (let i = 0; i < 16; i++) statuses.push((await fetch(`${base}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "absent@test.invalid", otp: "000000", newPassword: "Changed@123" }) })).status);
      assert.equal(statuses[15], 429);
    });
    await t.test("L3/H4: public cannot query inactive plans; roles reach only their authorized mutation", async () => {
      const inactive = await prisma.membershipPlan.create({ data: { name: "Hidden", tier: "MEMBERSHIP", price: 1, durationDays: 1, maxConcurrentClasses: 1, isActive: false } });
      assert.equal((await fetch(`${base}/membership-plans/${inactive.id}`)).status, 404);
      const publicPlans = await (await fetch(`${base}/membership-plans?isActive=false`)).json() as any;
      assert.ok(publicPlans.data.every((p: any) => p.isActive));
      for (const role of ["ADMIN", "MANAGER", "RECEPTIONIST"] as const) {
        const user = await User.create({ email: `${role}@test.invalid`, fullName: role, password: "fixture", role });
        await prisma.user.create({ data: { id: user.id, email: user.email, fullName: role, password: "fixture", role } });
        if (role !== "ADMIN") await prisma.facilityStaff.create({ data: { facilityId: facility.id, userId: user.id, role } });
        const headers = { Authorization: `Bearer ${signAccessToken({ id: user.id, role })}`, "X-Facility-Id": facility.id, "Content-Type": "application/json" };
        const retry = await fetch(`${base}/payments/missing/retry-activation`, { method: "POST", headers });
        assert.equal(retry.status, role === "ADMIN" ? 404 : 403);
        const change = await fetch(`${base}/subscriptions/missing/status`, { method: "PATCH", headers, body: JSON.stringify({ status: "CANCELLED" }) });
        assert.equal(change.status, role === "MANAGER" ? 403 : 404);
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect(); await mongoose.disconnect();
  }
});
