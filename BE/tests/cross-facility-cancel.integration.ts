/**
 * Regression test MF-01 / MF-02 — Hủy gói liên facility (read-only với business DB).
 *
 * MF-01: hủy gói tại facility B phải hủy booking tương lai ở MỌI cơ sở.
 * MF-02: hủy gói có hoàn tiền từ facility khác không được vấp FORBIDDEN_SCOPE.
 *
 * Chạy trên DB test cô lập (schema phải bắt đầu bằng scms_verify_):
 *   npm run test:operations:cross-facility-cancel
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestContext } from "../src/config/request-context.js";

const DAY = 86400000;

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { cancelSubscriptionBySelf, updateSubscriptionStatus } = await import(
    "../src/modules/subscriptions/subscriptions.service.js"
  );

  const run = randomUUID();
  const facilities: string[] = [],
    users: string[] = [],
    profiles: string[] = [],
    plans: string[] = [],
    rooms: string[] = [],
    classes: string[] = [],
    schedules: string[] = [],
    subs: string[] = [],
    payments: string[] = [];

  let passed = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) => {
    if (ok) {
      passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      const msg = `${name} — ${JSON.stringify(detail)}`;
      failures.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  };
  /** Đổi facility context sang cơ sở thứ i (giống FE đổi X-Facility-Id). */
  const scope = <T>(i: number, fn: () => Promise<T>) =>
    requestContext.run(
      { facilityId: facilities[i], actorId: "cancel-regression", role: "MEMBER" },
      fn,
    );

  try {
    // ── Fixture: 3 cơ sở, mỗi cơ sở room + class; A có thêm lịch quá khứ/đặt riêng ──
    for (let i = 0; i < 3; i++) {
      const f = await prisma.facility.create({
        data: { code: `XC-${run}-${i}`, name: `XC ${i}`, address: "fixture" },
      });
      facilities.push(f.id);
      const room = await prisma.room.create({
        data: { facilityId: f.id, name: `XC-room-${run}-${i}`, capacity: 50, areaType: "INDOOR" },
      });
      rooms.push(room.id);
      const cls = await prisma.class.create({
        data: { facilityId: f.id, name: `XC-class-${run}-${i}`, capacity: 50, areaType: "INDOOR" },
      });
      classes.push(cls.id);
    }
    const future = new Date(Date.now() + 5 * DAY);
    const past = new Date(Date.now() - 5 * DAY);
    const mkSched = (classIdx: number, start: Date) =>
      prisma.classSchedule
        .create({
          data: {
            classId: classes[classIdx],
            roomId: rooms[classIdx],
            startTime: start,
            endTime: new Date(+start + 3600000),
          },
        })
        .then((s) => {
          schedules.push(s.id);
          return s.id;
        });

    const sFutureA = await mkSched(0, future); // A – tương lai (Case 1/2)
    const sFutureB = await mkSched(1, future); // B – tương lai (Case 2)
    const sFutureC = await mkSched(2, future); // C – tương lai (Case 2)
    const sCancelled = await mkSched(0, new Date(+future + 3600000)); // A – đã CANCELLED (Case 4)
    const sPastBooked = await mkSched(0, past); // A – quá khứ (Case 3)
    const sPastDone = await mkSched(0, new Date(+past - 3600000)); // A – quá khứ COMPLETED (Case 3)

    const mkMember = async (tag: string, daysLeft: number) => {
      const user = await prisma.user.create({
        data: { email: `xc-${run}-${tag}@test.invalid`, fullName: `XC ${tag}`, password: "x", role: "MEMBER" },
      });
      users.push(user.id);
      const mp = await prisma.memberProfile.create({ data: { userId: user.id } });
      profiles.push(mp.id);
      const plan = await prisma.membershipPlan.create({
        data: {
          name: `XC-${run}-${tag}`,
          tier: "MEMBERSHIP",
          price: 1000000,
          durationDays: daysLeft,
          maxConcurrentClasses: 3,
        },
      });
      plans.push(plan.id);
      // Gói phát hành tại facility A (index 0).
      const sub = await prisma.membershipSubscription.create({
        data: {
          facilityId: facilities[0],
          memberId: mp.id,
          planId: plan.id,
          tier: "MEMBERSHIP",
          startDate: new Date(Date.now() - 2 * DAY),
          endDate: new Date(Date.now() + daysLeft * DAY),
          maxConcurrentClassesSnapshot: 3,
        },
      });
      subs.push(sub.id);
      const payment = await prisma.payment.create({
        data: {
          facilityId: facilities[0],
          memberId: mp.id,
          subscriptionId: sub.id,
          planId: plan.id,
          amount: 1000000,
          method: "CASH",
          status: "SUCCESS",
          paidAt: new Date(),
        },
      });
      payments.push(payment.id);
      return { userId: user.id, profileId: mp.id, planId: plan.id, subId: sub.id, paymentId: payment.id };
    };
    const book = (
      profileId: string,
      classIdx: number,
      scheduleId: string,
      status: "BOOKED" | "CANCELLED" | "COMPLETED" = "BOOKED",
    ) =>
      prisma.enrollment.create({
        data: { memberId: profileId, classId: classes[classIdx], scheduleId, status },
      });

    // ── Hội viên + booking fixture ────────────────────────────────
    const m1 = await mkMember("m1", 10); // ≤15 ngày → KHÔNG hoàn tiền
    const m2 = await mkMember("m2", 30); // >15 ngày → hoàn 30%
    const m3 = await mkMember("m3", 10); // dùng cho kiểm tra bảo mật
    const m4 = await mkMember("m4", 30); // luồng Manager (updateSubscriptionStatus)

    // Case 1 + 2: booking tương lai tại A, B, C
    const e1a = await book(m1.profileId, 0, sFutureA);
    const e1b = await book(m1.profileId, 1, sFutureB);
    const e1c = await book(m1.profileId, 2, sFutureC);
    // Case 3: booking quá khứ (giữ nguyên semantics)
    const e1past = await book(m1.profileId, 0, sPastBooked, "BOOKED");
    const e1done = await book(m1.profileId, 0, sPastDone, "COMPLETED");
    // Case 4: booking đã CANCELLED từ trước
    const e1wasCancelled = await book(m1.profileId, 0, sCancelled, "CANCELLED");
    // Case 5/7
    await book(m2.profileId, 0, sFutureA);
    await book(m2.profileId, 1, sFutureB);
    const payUnrelated = await prisma.payment.create({
      data: {
        facilityId: facilities[0], memberId: m2.profileId, amount: 500000,
        method: "CASH", status: "SUCCESS", paidAt: new Date(),
      },
    });
    payments.push(payUnrelated.id);
    const payAtB = await prisma.payment.create({
      data: { facilityId: facilities[1], memberId: m2.profileId, amount: 100000, method: "CASH", status: "FAILED" },
    });
    payments.push(payAtB.id);
    // Case 6 + 5b
    const e3 = await book(m3.profileId, 0, sFutureA);
    await book(m4.profileId, 0, sFutureA);

    // ── Case 1 + 2: hủy gói tại facility B (origin = A) ───────────
    const c1 = await scope(1, () => cancelSubscriptionBySelf(m1.subId, m1.userId, "regression"));
    const sub1 = await prisma.membershipSubscription.findUnique({ where: { id: m1.subId } });
    check("Case1: hủy gói tại B thành công → membership CANCELLED", c1.status === "CANCELLED" && sub1?.status === "CANCELLED", { res: c1?.status, db: sub1?.status });

    const afterA_B_C = await prisma.enrollment.findMany({
      where: { id: { in: [e1a.id, e1b.id, e1c.id] } },
      select: { id: true, status: true },
    });
    check(
      "Case1+Case2: booking TƯƠNG LAI tại A, B và C đều CANCELLED",
      afterA_B_C.length === 3 && afterA_B_C.every((e) => e.status === "CANCELLED"),
      afterA_B_C,
    );

    // ── Case 3: booking quá khứ giữ nguyên ────────────────────────
    const pastAfter = await prisma.enrollment.findMany({
      where: { id: { in: [e1past.id, e1done.id] } },
      select: { status: true },
      orderBy: { id: "asc" },
    });
    check(
      "Case3: booking quá khứ giữ nguyên (BOOKED / COMPLETED)",
      pastAfter[0]?.status === "BOOKED" && pastAfter[1]?.status === "COMPLETED",
      pastAfter,
    );

    // ── Case 4: booking đã CANCELLED không bị đụng ────────────────
    const wasCancelled = await prisma.enrollment.findUnique({ where: { id: e1wasCancelled.id } });
    check("Case4: booking đã CANCELLED trước đó vẫn CANCELLED (idempotent)", wasCancelled?.status === "CANCELLED", wasCancelled?.status);

    // ── Case 5: hủy gói + hoàn tiền từ facility B ─────────────────
    let c5err: any = null;
    try {
      await scope(1, () => cancelSubscriptionBySelf(m2.subId, m2.userId, "refund"));
    } catch (e: any) {
      c5err = e;
    }
    const sub2 = await prisma.membershipSubscription.findUnique({ where: { id: m2.subId } });
    const pay2 = await prisma.payment.findUnique({ where: { id: m2.paymentId } });
    const m2book = await prisma.enrollment.findMany({ where: { memberId: m2.profileId }, select: { status: true } });
    check("Case5: KHÔNG còn FORBIDDEN_SCOPE — hủy + hoàn tiền tại B thành công", !c5err, { message: c5err?.message, statusCode: c5err?.statusCode });
    check("Case5: membership CANCELLED", sub2?.status === "CANCELLED", sub2?.status);
    check(
      "Case5: payment REFUNDED đúng 30% (300.000đ) và có refundedAt",
      pay2?.status === "REFUNDED" && Number(pay2.refundedAmount) === 300000 && pay2.refundedAt !== null,
      { status: pay2?.status, refundedAmount: pay2?.refundedAmount },
    );
    check(
      "Case5: booking tương lai tại A và B của cùng hội viên đều CANCELLED",
      m2book.length === 2 && m2book.every((e) => e.status === "CANCELLED"),
      m2book,
    );

    // ── Case 5b: Manager hủy qua updateSubscriptionStatus (cùng pattern) ──
    let c5berr: any = null;
    try {
      await scope(1, () => updateSubscriptionStatus(m4.subId, "CANCELLED"));
    } catch (e: any) {
      c5berr = e;
    }
    const sub4 = await prisma.membershipSubscription.findUnique({ where: { id: m4.subId } });
    const pay4 = await prisma.payment.findUnique({ where: { id: m4.paymentId } });
    const m4book = await prisma.enrollment.findMany({ where: { memberId: m4.profileId }, select: { status: true } });
    check("Case5b: Manager hủy từ facility B KHÔNG lỗi", !c5berr, { message: c5berr?.message, statusCode: c5berr?.statusCode });
    check(
      "Case5b: membership CANCELLED + payment REFUNDED + booking tại A CANCELLED",
      sub4?.status === "CANCELLED" && pay4?.status === "REFUNDED" && m4book.every((e) => e.status === "CANCELLED"),
      { sub: sub4?.status, pay: pay4?.status, enroll: m4book },
    );

    // ── Case 6: member khác không hủy được gói của m3 ─────────────
    await assert.rejects(
      scope(1, () => cancelSubscriptionBySelf(m3.subId, m1.userId, "hack")),
      (e: any) => e.statusCode === 403,
    );
    const sub3 = await prisma.membershipSubscription.findUnique({ where: { id: m3.subId } });
    const e3after = await prisma.enrollment.findUnique({ where: { id: e3.id } });
    check(
      "Case6: member khác → 403; gói m3 vẫn ACTIVE và booking m3 vẫn BOOKED",
      sub3?.status === "ACTIVE" && e3after?.status === "BOOKED",
      { sub: sub3?.status, enroll: e3after?.status },
    );

    // ── Case 7: payment không thuộc membership không bị sửa ───────
    const unrelated = await prisma.payment.findUnique({ where: { id: payUnrelated.id } });
    check(
      "Case7: payment không gắn với membership vẫn SUCCESS (không bị hoàn)",
      unrelated?.status === "SUCCESS" && Number(unrelated?.refundedAmount ?? 0) === 0,
      { status: unrelated?.status },
    );
    const m1pay = await prisma.payment.findUnique({ where: { id: m1.paymentId } });
    check("Case7: gói không đủ điều kiện hoàn tiền → payment m1 vẫn SUCCESS", m1pay?.status === "SUCCESS", m1pay?.status);
    const m3pay = await prisma.payment.findUnique({ where: { id: m3.paymentId } });
    check("Case7: payment của member bị từ chối hủy vẫn SUCCESS", m3pay?.status === "SUCCESS", m3pay?.status);

    // ── Case 8: facility isolation còn nguyên vẹn ─────────────────
    const payA = await scope(0, () => prisma.payment.findMany({ select: { id: true, facilityId: true } }));
    const payB = await scope(1, () => prisma.payment.findMany({ select: { id: true, facilityId: true } }));
    check(
      "Case8: GET /payments tại A chỉ thấy payment phát hành ở A",
      payA.length > 0 && payA.every((p) => p.facilityId === facilities[0]),
      { count: payA.length },
    );
    check(
      "Case8: GET /payments tại B chỉ thấy payment phát hành ở B",
      payB.length === 1 && payB[0].id === payAtB.id,
      payB,
    );
    const clsA = await scope(0, () => prisma.class.findMany({ select: { facilityId: true } }));
    const roomB = await scope(1, () => prisma.room.findMany({ select: { facilityId: true } }));
    check(
      "Case8: GET /classes (A) và GET /rooms (B) vẫn cách ly facility",
      clsA.length === 1 && clsA.every((c) => c.facilityId === facilities[0]) &&
        roomB.length === 1 && roomB.every((r) => r.facilityId === facilities[1]),
      { classesA: clsA.length, roomsB: roomB.length },
    );
    const enrA = await scope(0, () =>
      prisma.enrollment.findMany({ select: { id: true, class: { select: { facilityId: true } } } }),
    );
    const enrB = await scope(1, () =>
      prisma.enrollment.findMany({ select: { id: true, class: { select: { facilityId: true } } } }),
    );
    check(
      "Case8: GET /enrollments vẫn scope theo facility của class (A không thấy booking B)",
      enrA.every((e) => e.class.facilityId === facilities[0]) &&
        enrB.every((e) => e.class.facilityId === facilities[1]) &&
        enrB.some((e) => e.id === e1b.id) &&
        !enrA.some((e) => e.id === e1b.id),
      { a: enrA.length, b: enrB.length },
    );
  } finally {
    await prisma.notificationOutbox.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.enrollment.deleteMany({ where: { memberId: { in: profiles } } });
    await prisma.payment.deleteMany({ where: { id: { in: payments } } });
    await prisma.membershipSubscription.deleteMany({ where: { id: { in: subs } } });
    await prisma.classSchedule.deleteMany({ where: { classId: { in: classes } } });
    await prisma.class.deleteMany({ where: { id: { in: classes } } });
    await prisma.room.deleteMany({ where: { id: { in: rooms } } });
    await prisma.membershipPlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.auditLog.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.memberProfile.deleteMany({ where: { id: { in: profiles } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    console.log("\nĐã dọn sạch fixture cross-facility-cancel.");
    await prisma.$disconnect();
  }

  console.log(`\n=== KET QUA: PASS=${passed} FAIL=${failures.length} ===`);
  if (failures.length) {
    for (const f of failures) console.log("  - " + f);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
