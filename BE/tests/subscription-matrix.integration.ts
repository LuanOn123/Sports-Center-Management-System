import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/config/prisma.js";
import { activateSubscriptionForPayment } from "../src/modules/subscriptions/subscription-purchase.service.js";
import { activateScheduledSubscriptions } from "../src/modules/subscriptions/subscription-lifecycle.service.js";
import { findActiveSubscription } from "../src/modules/enrollments/enrollment-quota.service.js";

let passed = 0;
const ok = (n: string) => {
  passed += 1;
  console.log(`  [PASS] ${n}`);
};

async function runTests() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^scms_verify_/);
  console.log("\n=== TESTING MEMBERSHIP MATRIX (RENEW / UPGRADE / DOWNGRADE) ===\n");

  const run = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      email: `member-${run}@test.com`,
      fullName: `User Matrix ${run}`,
      password: "password123",
      role: "MEMBER",
    },
  });

  const member = await prisma.memberProfile.create({
    data: { userId: user.id },
  });

  const facility = await prisma.facility.upsert({
    where: { id: "legacy-main" },
    update: {},
    create: { id: "legacy-main", code: "legacy-main", name: "Legacy Main", address: "Seed" },
  });

  // Plans: Standard (MEMBERSHIP) and Premium (PREMIUM)
  const planStandard = await prisma.membershipPlan.create({
    data: {
      name: `Standard ${run}`,
      tier: "MEMBERSHIP",
      price: 300000,
      durationDays: 30,
      maxConcurrentClasses: 3,
    },
  });

  const planPremium = await prisma.membershipPlan.create({
    data: {
      name: `Premium ${run}`,
      tier: "PREMIUM",
      price: 600000,
      durationDays: 60,
      maxConcurrentClasses: 10,
    },
  });

  const mkPayment = (planId: string, amount: number) =>
    prisma.payment.create({
      data: {
        memberId: member.id,
        planId,
        amount,
        method: "CASH",
        status: "PENDING",
        facilityId: facility.id,
        createdById: user.id,
      },
    });

  const activate = (paymentId: string, plan: any, startDate?: string) =>
    prisma.$transaction((tx) =>
      activateSubscriptionForPayment(tx, {
        paymentId,
        memberProfileId: member.id,
        plan,
        startDate,
      })
    );

  try {
    // 1. Initial purchase: Standard Plan (ACTIVE today -> +30 days)
    const p1 = await mkPayment(planStandard.id, 300000);
    const res1 = await activate(p1.id, planStandard);
    const sub1 = res1.subscription;

    assert.equal(sub1.status, "ACTIVE");
    assert.equal(sub1.tier, "MEMBERSHIP");
    ok("1. Initial standard subscription created as ACTIVE");

    const activeSub1 = await findActiveSubscription(prisma, member.id);
    assert.equal(activeSub1?.id, sub1.id);
    ok("1.1 Active subscription matches initial subscription");

    // 2. Renew (Same Tier): Should automatically chain to sub1.endDate, status SCHEDULED, sub1 stays ACTIVE
    const p2 = await mkPayment(planStandard.id, 300000);
    const res2 = await activate(p2.id, planStandard);
    const sub2 = res2.subscription;

    assert.equal(sub2.status, "SCHEDULED");
    assert.equal(sub2.startDate.toISOString(), sub1.endDate.toISOString());
    ok("2. Same tier renewal automatically scheduled at current subscription endDate");

    const sub1Refreshed = await prisma.membershipSubscription.findUniqueOrThrow({
      where: { id: sub1.id },
    });
    assert.equal(sub1Refreshed.status, "ACTIVE", "Old subscription remains ACTIVE");
    ok("2.1 Old subscription remains ACTIVE during scheduled renewal period");

    // Clean up sub2 so we can test Upgrade
    await prisma.membershipSubscription.delete({ where: { id: sub2.id } });

    // 3. Upgrade to PREMIUM with scheduled date in future
    const futureDate = new Date(Date.now() + 10 * 86400000); // 10 days later
    const p3 = await mkPayment(planPremium.id, 600000);
    const res3 = await activate(p3.id, planPremium, futureDate.toISOString());
    const sub3 = res3.subscription;

    assert.equal(sub3.status, "SCHEDULED");
    assert.equal(sub3.tier, "PREMIUM");
    assert.equal(sub3.startDate.toISOString().slice(0, 10), futureDate.toISOString().slice(0, 10));
    ok("3. Upgrade with future start date created as SCHEDULED");

    const sub1StillActive = await prisma.membershipSubscription.findUniqueOrThrow({
      where: { id: sub1.id },
    });
    assert.equal(sub1StillActive.status, "ACTIVE");
    ok("3.1 Old subscription remains ACTIVE when upgrade is SCHEDULED for future");

    // Clean up sub3
    await prisma.membershipSubscription.delete({ where: { id: sub3.id } });

    // 4. Upgrade to PREMIUM immediately (no startDate passed or now)
    const p4 = await mkPayment(planPremium.id, 600000);
    const res4 = await activate(p4.id, planPremium);
    const sub4 = res4.subscription;

    assert.equal(sub4.status, "ACTIVE");
    assert.equal(sub4.tier, "PREMIUM");
    ok("4. Immediate upgrade created as ACTIVE");

    const sub1Suspended = await prisma.membershipSubscription.findUniqueOrThrow({
      where: { id: sub1.id },
    });
    assert.equal(sub1Suspended.status, "SUSPENDED", "Old subscription suspended on immediate upgrade");
    ok("4.1 Old subscription suspended on immediate upgrade");

    // 5. Downgrade from PREMIUM back to Standard
    // 5a. Attempting to downgrade before PREMIUM expires should fail
    const p5Bad = await mkPayment(planStandard.id, 300000);
    const earlyDate = new Date(Date.now() + 5 * 86400000); // 5 days from now, but PREMIUM lasts 60 days
    await assert.rejects(
      async () => {
        await activate(p5Bad.id, planStandard, earlyDate.toISOString());
      },
      /Gói hạ cấp chỉ có thể được kích hoạt sau khi gói hiện tại hết hạn/,
      "Should reject downgrade date earlier than current PREMIUM endDate"
    );
    ok("5a. Downgrade earlier than PREMIUM expiration successfully rejected");

    // 5b. Downgrade on or after PREMIUM endDate should succeed as SCHEDULED
    const p5Good = await mkPayment(planStandard.id, 300000);
    const res5 = await activate(p5Good.id, planStandard, sub4.endDate.toISOString());
    const sub5 = res5.subscription;

    assert.equal(sub5.status, "SCHEDULED");
    assert.equal(sub5.tier, "MEMBERSHIP");
    assert.equal(sub5.startDate.toISOString(), sub4.endDate.toISOString());
    ok("5b. Downgrade starting at/after PREMIUM endDate successfully scheduled");

    // 6. Test lazy-activation / scheduled activation worker
    // Simulate time passing to sub5.startDate
    const res = await activateScheduledSubscriptions(new Date(sub4.endDate.getTime() + 1000));
    assert(res.activated >= 1, "Scheduled subscription was activated");

    const sub5Activated = await prisma.membershipSubscription.findUniqueOrThrow({
      where: { id: sub5.id },
    });
    assert.equal(sub5Activated.status, "ACTIVE");
    ok("6. Scheduled subscription automatically transitions to ACTIVE when startDate arrives");

    console.log(`\nAll ${passed} tests passed successfully!`);
  } finally {
    // Cleanup
    await prisma.notificationOutbox.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.membershipSubscription.deleteMany({ where: { memberId: member.id } });
    await prisma.invoice.deleteMany({ where: { memberId: member.id } });
    await prisma.payment.deleteMany({ where: { memberId: member.id } });
    await prisma.memberProfile.delete({ where: { id: member.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.membershipPlan.deleteMany({ where: { id: { in: [planStandard.id, planPremium.id] } } });
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
