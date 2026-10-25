import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestContext } from "../src/config/request-context.js";

let passed = 0;
const ok = (n: string) => {
  passed += 1;
  console.log(`  [PASS] ${n}`);
};
const DAY = 86400000;

/**
 * Báo cáo nghiệp vụ mục 7 — G2/G3/G5/G9: kích hoạt gói SCHEDULED có lock, hủy gói SCHEDULED
 * hoàn 100%, Room.name unique theo cơ sở, waitlist, check-in, ràng buộc Term.
 * Chỉ chạy trên schema cách ly `scms_verify_*` (ghi dữ liệu thật rồi tự dọn).
 */
async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { activateScheduledSubscriptions } = await import(
    "../src/modules/subscriptions/subscription-lifecycle.service.js"
  );
  const { cancelSubscriptionBySelf, updateSubscriptionStatus } = await import(
    "../src/modules/subscriptions/subscriptions.service.js"
  );
  const { bookClass, cancelEnrollment } = await import(
    "../src/modules/enrollments/enrollments.service.js"
  );
  const { joinWaitlist } = await import("../src/modules/waitlist/waitlist.service.js");
  const { checkIn } = await import("../src/modules/facility-visits/facility-visits.service.js");
  const { createRoom } = await import("../src/modules/rooms/rooms.service.js");
  const termsService = await import("../src/modules/terms/terms.service.js");

  const run = randomUUID().slice(0, 8);
  const users: string[] = [];
  const facilities: string[] = [];
  const classes: string[] = [];
  const terms: string[] = [];
  let planId = "";

  const inFacility = <T>(facilityId: string, fn: () => Promise<T>) =>
    requestContext.run({ facilityId, actorId: users[0], role: "MANAGER" }, fn);
  const expectError = async (fn: () => Promise<unknown>, status: number, label: string) => {
    await assert.rejects(fn, (e: any) => {
      assert.equal(e.statusCode ?? e.status, status, `${label}: ${e.message}`);
      return true;
    });
  };

  try {
    await prisma.facility.upsert({
      where: { id: "legacy-main" },
      update: {},
      create: { id: "legacy-main", code: "legacy-main", name: "Legacy Main", address: "Seed" },
    });
    const facA = await prisma.facility.create({ data: { code: `A-${run}`, name: "Gap A", address: "Test" } });
    const facB = await prisma.facility.create({ data: { code: `B-${run}`, name: "Gap B", address: "Test" } });
    facilities.push(facA.id, facB.id);

    const plan = await prisma.membershipPlan.create({
      data: { name: `gap-${run}`, tier: "MEMBERSHIP", price: 600000, durationDays: 30, maxConcurrentClasses: 3 },
    });
    planId = plan.id;

    const mkMember = async (label: string) => {
      const user = await prisma.user.create({
        data: { email: `${label}-${run}@test.invalid`, fullName: label, password: "x", role: "MEMBER" },
      });
      users.push(user.id);
      const member = await prisma.memberProfile.create({ data: { userId: user.id } });
      return { user, member };
    };
    const mkSub = (memberId: string, status: "ACTIVE" | "SCHEDULED", start: Date, days = 30) =>
      prisma.membershipSubscription.create({
        data: {
          memberId, planId: plan.id, tier: "MEMBERSHIP", status, facilityId: facA.id,
          startDate: start, endDate: new Date(+start + days * DAY), maxConcurrentClassesSnapshot: 3,
        },
      });
    const mkPaid = (memberId: string, subscriptionId: string) =>
      prisma.payment.create({
        data: {
          memberId, planId: plan.id, subscriptionId, amount: 600000, method: "CASH",
          status: "SUCCESS", paidAt: new Date(), facilityId: facA.id, createdById: users[0],
        },
      });

    // ── G2: kích hoạt gói SCHEDULED ─────────────────────────────────────────
    const m1 = await mkMember("g2");
    const current = await mkSub(m1.member.id, "ACTIVE", new Date(Date.now() - 20 * DAY));
    const queued = await mkSub(m1.member.id, "SCHEDULED", new Date(Date.now() - 60000));
    const r1 = await activateScheduledSubscriptions(new Date());
    assert.ok(r1.activated >= 1);
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: queued.id } })).status, "ACTIVE");
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: current.id } })).status, "SUSPENDED");
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: m1.member.id, status: "ACTIVE" } }), 1);
    ok("G2: job kích hoạt SCHEDULED → ACTIVE, gói cũ SUSPENDED, đúng 1 ACTIVE");

    const m2 = await mkMember("g2b");
    const keep = await mkSub(m2.member.id, "ACTIVE", new Date(Date.now() - DAY));
    const gone = await mkSub(m2.member.id, "SCHEDULED", new Date(Date.now() - 60000));
    await prisma.membershipSubscription.update({ where: { id: gone.id }, data: { status: "CANCELLED" } });
    await activateScheduledSubscriptions(new Date());
    assert.equal((await prisma.membershipSubscription.findUniqueOrThrow({ where: { id: keep.id } })).status, "ACTIVE");
    ok("G2: gói SCHEDULED đã hủy không làm SUSPENDED gói ACTIVE hiện tại");

    // ── G3: hủy gói SCHEDULED ──────────────────────────────────────────────
    const m3 = await mkMember("g3");
    await mkSub(m3.member.id, "ACTIVE", new Date(Date.now() - DAY));
    const future = await mkSub(m3.member.id, "SCHEDULED", new Date(Date.now() + 10 * DAY));
    const pay = await mkPaid(m3.member.id, future.id);
    await expectError(
      () => inFacility(facA.id, () => updateSubscriptionStatus(future.id, "ACTIVE")),
      400,
      "SCHEDULED → ACTIVE thủ công",
    );
    ok("G3: Manager không được kích hoạt tay gói SCHEDULED (400)");
    const cancelled = await inFacility(facB.id, () => cancelSubscriptionBySelf(future.id, m3.user.id, "đổi ý"));
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.refundAmount, 600000);
    const payAfter = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert.equal(payAfter.status, "REFUNDED");
    assert.equal(Number(payAfter.refundedAmount), 600000);
    assert.equal(await prisma.membershipSubscription.count({ where: { memberId: m3.member.id, status: "ACTIVE" } }), 1);
    assert.ok(
      (await prisma.notificationOutbox.count({ where: { userId: m3.user.id } })) +
        (await prisma.notification.count({ where: { userId: m3.user.id } })) >= 1,
    );
    ok("G3: hội viên tự hủy gói SCHEDULED → CANCELLED, hoàn 100%, gói ACTIVE giữ nguyên, có thông báo");
    await expectError(
      () => inFacility(facA.id, () => cancelSubscriptionBySelf(future.id, m3.user.id)),
      400,
      "hủy lại gói đã CANCELLED",
    );
    ok("G3: hủy lại gói đã CANCELLED bị chặn (400)");

    // ── G5: tên phòng unique theo cơ sở ─────────────────────────────────────
    const roomA = await inFacility(facA.id, () =>
      createRoom({ name: `Phòng ${run}`, capacity: 1, areaType: "INDOOR", facilityId: facA.id }),
    );
    const roomB = await inFacility(facB.id, () =>
      createRoom({ name: `Phòng ${run}`, capacity: 1, areaType: "INDOOR", facilityId: facB.id }),
    );
    assert.notEqual(roomA.id, roomB.id);
    await expectError(
      () => inFacility(facA.id, () =>
        createRoom({ name: `Phòng ${run}`, capacity: 1, areaType: "INDOOR", facilityId: facA.id }),
      ),
      409,
      "trùng tên phòng cùng cơ sở",
    );
    ok("G5: hai cơ sở cùng tên phòng được; trùng trong một cơ sở → 409");

    // ── Waitlist: chỉ join khi đầy, tự đôn khi có người hủy ─────────────────
    const cls = await prisma.class.create({
      data: { facilityId: facA.id, name: `wl-${run}`, capacity: 1, areaType: "INDOOR" },
    });
    classes.push(cls.id);
    const slot = await prisma.classSchedule.create({
      data: {
        classId: cls.id, roomId: roomA.id,
        startTime: new Date(Date.now() + 3 * DAY), endTime: new Date(Date.now() + 3 * DAY + 3600000),
      },
    });
    const w1 = await mkMember("wl1");
    const w2 = await mkMember("wl2");
    await mkSub(w1.member.id, "ACTIVE", new Date(Date.now() - DAY));
    await mkSub(w2.member.id, "ACTIVE", new Date(Date.now() - DAY));
    await expectError(() => inFacility(facA.id, () => joinWaitlist(slot.id, w2.member.id)), 409, "join khi còn chỗ");
    ok("Waitlist: buổi còn chỗ → 409, phải đặt trực tiếp");
    const booked = await inFacility(facA.id, () => bookClass(slot.id, w1.member.id, "MEMBER"));
    const entry = await inFacility(facA.id, () => joinWaitlist(slot.id, w2.member.id));
    assert.equal(entry.status, "WAITING");
    await expectError(() => inFacility(facA.id, () => joinWaitlist(slot.id, w2.member.id)), 409, "join trùng");
    ok("Waitlist: buổi đầy → WAITING; vào lại lần hai → 409");
    await inFacility(facA.id, () => cancelEnrollment((booked as any).id, w1.user.id, "MANAGER"));
    assert.equal((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status, "PROMOTED");
    assert.equal(
      (await prisma.enrollment.findFirstOrThrow({ where: { memberId: w2.member.id, scheduleId: slot.id } })).status,
      "BOOKED",
    );
    ok("Waitlist: người giữ chỗ hủy → người chờ đầu tiên được PROMOTED + BOOKED");

    // ── Check-in vào cơ sở ─────────────────────────────────────────────────
    const c1 = await mkMember("ci");
    await expectError(() => inFacility(facB.id, () => checkIn(c1.member.id, "QR")), 403, "check-in không gói");
    ok("Check-in: không có gói ACTIVE → 403");
    await mkSub(c1.member.id, "ACTIVE", new Date(Date.now() - DAY));
    const v1 = await inFacility(facB.id, () => checkIn(c1.member.id, "QR"));
    const v2 = await inFacility(facB.id, () => checkIn(c1.member.id, "QR"));
    assert.equal(v1.duplicate, false);
    assert.equal(v2.duplicate, true);
    assert.equal(v2.visit.id, v1.visit.id);
    assert.equal(v1.visit.facilityId, facB.id);
    ok("Check-in: gói mua ở A vào được B; quét lại trong 5 phút trả lượt cũ");

    // ── Term ───────────────────────────────────────────────────────────────
    const now = Date.now();
    const term = await termsService.createTerm({
      code: `T${run}`.toUpperCase().slice(0, 20), name: "Kỳ kiểm thử", facilityId: facA.id,
      startDate: new Date(now + DAY), endDate: new Date(now + 30 * DAY),
      registrationStartDate: new Date(now - DAY), registrationEndDate: new Date(now + DAY),
      status: "PLANNING",
    });
    terms.push(term.id);
    await expectError(
      () => termsService.assertCanScheduleInTerm(term.id, new Date(now + 2 * DAY), new Date(now + 2 * DAY + 3600000), facB.id),
      400,
      "kỳ riêng của A xếp cho B",
    );
    ok("Term: kỳ riêng của cơ sở A không xếp được lịch cho cơ sở B");
    await expectError(() => termsService.updateTerm(term.id, { status: "CLOSED" }, facB.id), 403, "Manager B sửa kỳ A");
    ok("Term: Manager cơ sở khác không sửa được kỳ (403)");
    await prisma.classSchedule.create({
      data: {
        classId: cls.id, roomId: roomA.id, termId: term.id,
        startTime: new Date(now + 5 * DAY), endTime: new Date(now + 5 * DAY + 3600000),
      },
    });
    await expectError(
      () => termsService.updateTerm(term.id, { endDate: new Date(now + 3 * DAY).toISOString() }),
      400,
      "thu hẹp kỳ",
    );
    await expectError(() => termsService.deleteTerm(term.id), 400, "xóa kỳ có lịch");
    ok("Term: không thu hẹp kỳ khi có buổi ngoài khoảng mới; không xóa kỳ đã có lịch");

    console.log(`\nbusiness-gaps: ${passed} PASS`);
  } finally {
    await prisma.waitlistEntry.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.facilityVisit.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.enrollment.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.classSchedule.deleteMany({ where: { classId: { in: classes } } });
    await prisma.class.deleteMany({ where: { id: { in: classes } } });
    await prisma.term.deleteMany({ where: { id: { in: terms } } });
    await prisma.invoice.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.payment.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.membershipSubscription.deleteMany({ where: { member: { userId: { in: users } } } });
    await prisma.notificationOutbox.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.room.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (planId) await prisma.membershipPlan.delete({ where: { id: planId } }).catch(() => {});
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
