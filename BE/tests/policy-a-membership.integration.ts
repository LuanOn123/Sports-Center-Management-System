import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

let passed = 0;
const ok = (n: string) => {
  passed += 1;
  console.log(`  [PASS] ${n}`);
};

/** FINAL Policy A — 1 member = 1 ACTIVE; terminal states không resume. Isolated DB only. */
async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { activateSubscriptionForPayment } = await import(
    "../src/modules/subscriptions/subscription-purchase.service.js"
  );
  const { updateSubscriptionStatus, renewSubscription } = await import(
    "../src/modules/subscriptions/subscriptions.service.js"
  );
  const { expireStaleSubscriptions } = await import(
    "../src/modules/subscriptions/subscription-lifecycle.service.js"
  );
  const { findActiveSubscription } = await import(
    "../src/modules/enrollments/enrollment-quota.service.js"
  );
  const run = randomUUID();
  const user = await prisma.user.create({
    data: { email: `${run}@test.invalid`, fullName: "Policy A", password: "x", role: "MEMBER" },
  });
  const member = await prisma.memberProfile.create({ data: { userId: user.id } });
  const plan30 = await prisma.membershipPlan.create({
    data: { name: run, tier: "MEMBERSHIP", price: 300000, durationDays: 30, maxConcurrentClasses: 3 },
  });
  // Payment.facilityId là FK bắt buộc → tạo facility nguồn thu riêng cho lượt test.
  const facility = await prisma.facility.create({
    data: { code: run, name: "Policy A Facility", address: "Test only" },
  });
  // db push không chạy data migration → seed row legacy-main (Payment.facilityId @default).
  await prisma.facility.upsert({
    where: { id: "legacy-main" },
    update: {},
    create: { id: "legacy-main", code: "legacy-main", name: "Legacy Main", address: "Seed" },
  });
  const mkPayment = (planId: string, amount: number) =>
    prisma.payment.create({
      data: {
        memberId: member.id, planId, amount, method: "CASH", status: "PENDING",
        facilityId: facility.id, createdById: user.id,
      },
    });
  try {
    const free = await prisma.membershipSubscription.create({
      data: {
        memberId: member.id, planId: plan30.id, tier: "FREE",
        startDate: new Date(), endDate: new Date(Date.now() + 3650 * 86400000), status: "ACTIVE",
      },
    });
    const p1 = await mkPayment(plan30.id, 300000);
    const now1 = new Date();
    const r1 = await prisma.$transaction((tx) =>
      activateSubscriptionForPayment(tx, {
        memberProfileId: member.id, memberUserId: user.id, plan: plan30, paymentId: p1.id, now: now1,
      }),
    );
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: free.id } })).status, "SUSPENDED");
    assert.equal(r1.subscription.status, "ACTIVE");
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: member.id, status: "ACTIVE" } }), 1);
    assert.ok(r1.subscription.endDate.getTime() - now1.getTime() < 31 * 86400000);
    ok("FREE replaced by PAID, one ACTIVE, no FREE carry-over");
    const p2 = await mkPayment(plan30.id, 300000);
    const now2 = new Date();
    const r2 = await prisma.$transaction((tx) =>
      activateSubscriptionForPayment(tx, {
        memberProfileId: member.id, memberUserId: user.id, plan: plan30, paymentId: p2.id, now: now2,
      }),
    );
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: r1.subscription.id } })).status, "SUSPENDED");
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: member.id, status: "ACTIVE" } }), 1);
    assert.ok(r2.subscription.endDate.getTime() - now2.getTime() < 31 * 86400000);
    ok("paid replaced by paid, one ACTIVE, no carry-over");
    await assert.rejects(updateSubscriptionStatus(r1.subscription.id, "ACTIVE"), (e: any) => e.statusCode === 400);
    ok("SUSPENDED resume rejected");
    await prisma.membershipSubscription.update({ where: { id: r1.subscription.id }, data: { status: "EXPIRED" } });
    await assert.rejects(updateSubscriptionStatus(r1.subscription.id, "ACTIVE"), (e: any) => e.statusCode === 400);
    ok("EXPIRED resume rejected");
    const cancelled = await prisma.membershipSubscription.create({
      data: {
        memberId: member.id, planId: plan30.id, tier: "MEMBERSHIP",
        startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: "CANCELLED",
      },
    });
    await assert.rejects(updateSubscriptionStatus(cancelled.id, "ACTIVE"), (e: any) => e.statusCode === 400);
    ok("CANCELLED resume rejected");
    await prisma.membershipSubscription.update({
      where: { id: r2.subscription.id }, data: { endDate: new Date(Date.now() - 1000) },
    });
    await expireStaleSubscriptions(new Date());
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: r2.subscription.id } })).status, "EXPIRED");
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: member.id, status: "ACTIVE" } }), 0);
    assert.equal(await findActiveSubscription(prisma, member.id), null);
    ok("expiry job expires ACTIVE without reactivating history");
    const p3 = await mkPayment(plan30.id, 300000);
    const r3 = await prisma.$transaction((tx) =>
      activateSubscriptionForPayment(tx, {
        memberProfileId: member.id, memberUserId: user.id, plan: plan30, paymentId: p3.id, now: new Date(),
      }),
    );
    assert.equal(r3.subscription.status, "ACTIVE");
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: r2.subscription.id } })).status, "EXPIRED");
    ok("purchase after expiry creates new ACTIVE");
    // Renew = replacement: lock + CAS, start = NGAY (không stack sau endDate cũ).
    const oldEnd = r3.subscription.endDate.getTime();
    const renewed = await renewSubscription(
      r3.subscription.id,
      { planId: plan30.id, paymentMethod: "CASH" },
      user.id,
    );
    assert.equal(renewed.subscription.status, "ACTIVE");
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: r3.subscription.id } })).status, "SUSPENDED");
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: member.id, status: "ACTIVE" } }), 1);
    // Nếu stack thì endDate mới ≈ oldEnd + 30d (~now+60d); replacement ≈ now+30d (< oldEnd+31d).
    assert.ok(renewed.subscription.endDate.getTime() < oldEnd + 31 * 86400000);
    ok("renew replaces current ACTIVE: one ACTIVE, no stacking");
    const pa = await mkPayment(plan30.id, 300000);
    const pb = await mkPayment(plan30.id, 300000);
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        activateSubscriptionForPayment(tx, {
          memberProfileId: member.id, memberUserId: user.id, plan: plan30, paymentId: pa.id, now: new Date(),
        }),
      ),
      prisma.$transaction((tx) =>
        activateSubscriptionForPayment(tx, {
          memberProfileId: member.id, memberUserId: user.id, plan: plan30, paymentId: pb.id, now: new Date(),
        }),
      ),
    ]);
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: member.id, status: "ACTIVE" } }), 1);
    assert.ok(results.filter((r) => r.status === "fulfilled").length >= 1);
    ok("concurrent purchases end with exactly one ACTIVE");
    const resolved = await findActiveSubscription(prisma, member.id);
    assert.ok(resolved && resolved.status === "ACTIVE");
    ok("resolver returns only current ACTIVE");
    console.log(`POLICY A suite: PASS=${passed} FAIL=0`);
  } finally {
    // Thứ tự FK: Invoice → Payment → Subscription → MemberProfile/User/Plan/Facility.
    await prisma.invoice.deleteMany({ where: { memberId: member.id } });
    await prisma.payment.deleteMany({ where: { memberId: member.id } });
    await prisma.membershipSubscription.deleteMany({ where: { memberId: member.id } });
    await prisma.memberProfile.delete({ where: { id: member.id } });
    // Chờ notification fire-and-forget settle trước khi xóa user (tránh FK noise).
    await new Promise((r) => setTimeout(r, 500));
    await prisma.notificationOutbox.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.membershipPlan.delete({ where: { id: plan30.id } });
    await prisma.auditLog.deleteMany({ where: { facilityId: facility.id } });
    await prisma.facility.delete({ where: { id: facility.id } });
    await prisma.facility.delete({ where: { id: "legacy-main" } });
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

