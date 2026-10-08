import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestContext } from "../src/config/request-context.js";

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { bookClass, transferEnrollment } =
    await import("../src/modules/enrollments/enrollments.service.js");
  const { enrollWholeCourse } =
    await import("../src/modules/enrollments/course-enrollment.service.js");
  const { updateSchedule } =
    await import("../src/modules/class-schedules/class-schedules.service.js");
  const { findActiveSubscription, getMemberConcurrentClassQuota, assertConcurrentClassQuota } =
    await import("../src/modules/enrollments/enrollment-quota.service.js");
  const { inspectPlanPurchase } =
    await import("../src/modules/subscriptions/subscription-purchase.service.js");
  const { ensureActiveFreeSubscription } =
    await import("../src/modules/subscriptions/free-subscription.service.js");
  const { getSubscriptionById, updateSubscriptionStatus } =
    await import("../src/modules/subscriptions/subscriptions.service.js");
  const run = randomUUID();
  const facilities: string[] = [],
    users: string[] = [],
    classes: string[] = [];
  let memberId = "",
    planId = "",
    freeMemberId = "";
  const scope = <T>(i: number, fn: () => Promise<T>) =>
    requestContext.run(
      {
        facilityId: facilities[i],
        actorId: "cross-facility-test",
        role: "ADMIN",
      },
      fn,
    );
  const reject409 = (error: any) => error.statusCode === 409;
  try {
    const user = await prisma.user.create({
      data: {
        email: run + "@test.invalid",
        fullName: "Cross facility member",
        password: "fixture-only",
        role: "MEMBER",
      },
    });
    users.push(user.id);
    const member = await prisma.memberProfile.create({
      data: { userId: user.id },
    });
    memberId = member.id;
    const plan = await prisma.membershipPlan.create({
      data: {
        name: run,
        tier: "MEMBERSHIP",
        price: 300000,
        durationDays: 30,
        maxConcurrentClasses: 3,
      },
    });
    planId = plan.id;
    const start = new Date(Date.now() + 3 * 86400000),
      end = new Date(+start + 3600000);
    const sessions: { id: string; classId: string }[] = [];
    for (let i = 0; i < 2; i++) {
      const facility = await prisma.facility.create({
        data: { code: run + i, name: "Test " + i, address: "Fixture" },
      });
      facilities.push(facility.id);
      const room = await prisma.room.create({
        data: {
          facilityId: facility.id,
          name: run + "room" + i,
          capacity: 10,
          areaType: "INDOOR",
        },
      });
      const coachUser = await prisma.user.create({
        data: {
          email: run + "coach" + i + "@test.invalid",
          fullName: "Coach " + i,
          password: "fixture-only",
          role: "COACH",
        },
      });
      users.push(coachUser.id);
      const coach = await prisma.coachProfile.create({
        data: { userId: coachUser.id },
      });
      await prisma.facilityStaff.create({
        data: { facilityId: facility.id, userId: coachUser.id, role: "COACH" },
      });
      const cls = await prisma.class.create({
        data: {
          facilityId: facility.id,
          name: run + "class" + i,
          capacity: 10,
          areaType: "INDOOR",
        },
      });
      classes.push(cls.id);
      await prisma.classMember.create({
        data: { classId: cls.id, coachId: coach.id, isPrimary: true },
      });
      sessions.push(
        await prisma.classSchedule.create({
          data: {
            classId: cls.id,
            roomId: room.id,
            startTime: new Date(+start + i * 1800000),
            endTime: new Date(+end + i * 1800000),
          },
        }),
      );
    }
    // ── Membership là GLOBAL: chỉ MỘT subscription, dùng ở MỌI facility ─────
    // Case 8: resource facility-scoped vẫn cách ly sau khi bỏ scope của Membership.
    const classesAtA = await scope(0, () =>
      prisma.class.findMany({ select: { id: true } }),
    );
    const classesAtB = await scope(1, () =>
      prisma.class.findMany({ select: { id: true } }),
    );
    assert.deepEqual(classesAtA.map((c) => c.id), [classes[0]]);
    assert.deepEqual(classesAtB.map((c) => c.id), [classes[1]]);
    console.log("PASS facility-scoped class listings remain isolated");

    const subA = await prisma.membershipSubscription.create({
      data: {
        facilityId: facilities[0],
        memberId,
        planId,
        tier: "MEMBERSHIP",
        // startDate = now để đúng khoảng 30 ngày của plan (luồng mua gói chặn cùng hạng
        // mua gói ít ngày hơn — Case 3 phải rơi vào nhánh "thấy membership", không ném 400).
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        maxConcurrentClassesSnapshot: 3,
      },
    });

    // Case 2: gói mua tại A vẫn là ACTIVE khi chọn facility B (không cần mua lại ở B).
    assert.equal((await scope(0, () => findActiveSubscription(prisma, memberId)))?.id, subA.id);
    assert.equal((await scope(1, () => findActiveSubscription(prisma, memberId)))?.id, subA.id);
    console.log("PASS one subscription purchased at facility A stays ACTIVE at facility B");

    // Case 3: validation mua gói khi đang chọn facility B vẫn THẤY membership hiện có
    // (luồng upgrade/downgrade/không-mua-trùng không coi member là chưa có gói).
    const purchaseCtx = await scope(1, () => inspectPlanPurchase(prisma, memberId, plan));
    assert.equal(purchaseCtx.currentActive?.id, subA.id);
    console.log("PASS purchase validation sees the existing global membership after switching facility");

    // Case 1: FREE cấp lúc đăng ký là GLOBAL (facilityId NULL, không phụ thuộc 'legacy-main')
    // và nhìn thấy ở cả hai facility.
    const freeUser = await prisma.user.create({
      data: {
        email: run + "+free@test.invalid",
        fullName: "Global free member",
        password: "fixture-only",
        role: "MEMBER",
      },
    });
    users.push(freeUser.id);
    const freeMember = await prisma.memberProfile.create({ data: { userId: freeUser.id } });
    freeMemberId = freeMember.id;
    const provisioned = await prisma.$transaction((tx) =>
      ensureActiveFreeSubscription(tx, freeMember.id),
    );
    assert.equal(provisioned.subscription.facilityId, null);
    assert.equal(
      (await scope(0, () => findActiveSubscription(prisma, freeMember.id)))?.id,
      provisioned.subscription.id,
    );
    assert.equal(
      (await scope(1, () => findActiveSubscription(prisma, freeMember.id)))?.id,
      provisioned.subscription.id,
    );
    const freeQuotaA = await scope(0, () => getMemberConcurrentClassQuota(prisma, freeMember.id));
    const freeQuotaB = await scope(1, () => getMemberConcurrentClassQuota(prisma, freeMember.id));
    assert.equal(freeQuotaA.hasActiveSubscription, true);
    assert.equal(freeQuotaA.tier, "FREE");
    assert.equal(freeQuotaB.tier, "FREE");
    console.log("PASS FREE membership provisioned at registration is global (no legacy-main dependency)");

    // Case 5: trùng giờ vẫn bị chặn TOÀN HỆ THỐNG (khác facility không miễn trừ).
    await scope(0, () => bookClass(sessions[0].id, memberId, "MEMBER"));
    await assert.rejects(
      scope(1, () => bookClass(sessions[1].id, memberId, "MEMBER")),
      reject409,
    );
    await assert.rejects(
      scope(1, () => enrollWholeCourse(sessions[1].classId, memberId)),
      reject409,
    );
    console.log(
      "PASS single-session and whole-course bookings reject overlap across facilities",
    );
    const other = await prisma.classSchedule.create({
      data: {
        classId: sessions[1].classId,
        roomId: (
          await prisma.classSchedule.findUniqueOrThrow({
            where: { id: sessions[1].id },
          })
        ).roomId,
        startTime: end,
        endTime: new Date(+end + 3600000),
      },
    });
    // FINAL Travel Buffer: A 08:00–09:00 → B 09:00–10:00 khác facility, gap = 0 < 30
    // → 409 TIME_CONFLICT (không còn cho phép back-to-back khác facility).
    await assert.rejects(
      scope(1, () =>
        bookClass(other.id, memberId, "MEMBER"),
      ),
      reject409,
    );
    console.log(
      "PASS cross-facility back-to-back is rejected by travel buffer (gap 0 < 30)",
    );
    // Transfer SANG facility/class khác BỊ CHẶN theo FINAL rules: BR-08 chỉ cho đổi
    // buổi TRONG cùng Class, DAL facility-scope không cho đọc Enrollment thuộc facility A
    // khi đang chọn B (403 FORBIDDEN_SCOPE). Dù bị từ chối bằng mã nào (400/403/409),
    // chỗ cũ phải GIỮ NGUYÊN BOOKED.
    const bookedA = await prisma.enrollment.findFirstOrThrow({
      where: { memberId, scheduleId: sessions[0].id },
    });
    await assert.rejects(
      scope(1, () =>
        transferEnrollment(bookedA.id, sessions[1].id, user.id, "MEMBER"),
      ),
      (e: any) =>
        e.statusCode === 400 || e.statusCode === 403 || e.statusCode === 409,
    );
    assert.equal(
      (await prisma.enrollment.findUniqueOrThrow({ where: { id: bookedA.id } }))
        .status,
      "BOOKED",
    );
    console.log(
      "PASS cross-class/cross-facility transfer is rejected and preserves the original seat",
    );

    // Case 4: quota là GLOBAL — A giữ 1 Class, B giữ 1 Class ⇒ used = 2 ở CẢ hai facility.
    // Buổi B2 ở facility B (10:00–11:00) cách booking A (08:00–09:00) 60 phút >= travel
    // buffer nên book được (không dùng buổi overlap — Case 5 đã chặn).
    const laterB = await prisma.classSchedule.create({
      data: {
        classId: sessions[1].classId,
        roomId: (
          await prisma.classSchedule.findUniqueOrThrow({
            where: { id: sessions[1].id },
          })
        ).roomId,
        startTime: new Date(+start + 2 * 3600000),
        endTime: new Date(+start + 3 * 3600000),
      },
    });
    await scope(1, () => bookClass(laterB.id, memberId, "MEMBER"));
    const quotaAtA = await scope(0, () => getMemberConcurrentClassQuota(prisma, memberId));
    const quotaAtB = await scope(1, () => getMemberConcurrentClassQuota(prisma, memberId));
    assert.equal(quotaAtA.used, 2);
    assert.equal(quotaAtB.used, 2);
    assert.equal(quotaAtA.limit, 3);
    assert.equal(quotaAtB.limit, 3);
    // Hạ limit xuống dưới số class đang giữ ⇒ chặn thêm class mới, kể cả khi đổi facility.
    await prisma.membershipSubscription.update({
      where: { id: subA.id },
      data: { maxConcurrentClassesSnapshot: 1 },
    });
    let quotaError: any = null;
    await scope(1, () => assertConcurrentClassQuota(prisma, memberId, "class-not-held")).catch(
      (e) => {
        quotaError = e;
      },
    );
    await prisma.membershipSubscription.update({
      where: { id: subA.id },
      data: { maxConcurrentClassesSnapshot: 3 },
    });
    assert.equal(quotaError?.statusCode, 403);
    assert.equal(quotaError?.errors?.code, "CONCURRENT_CLASS_LIMIT_REACHED");
    console.log(
      "PASS concurrent-class quota aggregates enrollments across facilities and blocks new ones",
    );

    // Case 6: đọc/đổi trạng thái membership hoạt động dù đang chọn facility KHÁC facility phát hành.
    assert.equal((await scope(1, () => getSubscriptionById(subA.id))).id, subA.id);
    const suspended = await scope(1, () => updateSubscriptionStatus(subA.id, "SUSPENDED"));
    assert.equal(suspended.status, "SUSPENDED");
    // FINAL Policy A: SUSPENDED là terminal — resume qua API luôn bị 400 SUBSCRIPTION_RESUME_FORBIDDEN.
    await assert.rejects(
      scope(1, () => updateSubscriptionStatus(subA.id, "ACTIVE")),
      (e: any) =>
        e.statusCode === 400 && (e.errors as any)?.code === "SUBSCRIPTION_RESUME_FORBIDDEN",
    );
    // Fixture: khôi phục ACTIVE trực tiếp qua Prisma (KHÔNG qua API resume — API đã bị chặn)
    // để các case booking phía sau chạy với entitlement thật.
    await prisma.membershipSubscription.update({
      where: { id: subA.id },
      data: { status: "ACTIVE", suspendedAt: null, remainingDays: null },
    });
    console.log(
      "PASS membership status operations work while another facility is selected; resume is forbidden",
    );

    // Z — buổi 09:30–10:00 ở facility B: book được khi đang giữ A (gap 30' = buffer,
    // gap == buffer cho qua) và laterB (same-facility, chỉ chạm biên 10:00).
    // Dời Z về 08:00–09:00 sẽ đụng booking tại A (cross-facility) ⇒ A11 chặn bằng 409
    // và GIỮ NGUYÊN thời gian Z.
    const zSession = await prisma.classSchedule.create({
      data: {
        classId: sessions[1].classId,
        roomId: (
          await prisma.classSchedule.findUniqueOrThrow({
            where: { id: sessions[1].id },
          })
        ).roomId,
        startTime: new Date(+start + 5400000),
        endTime: new Date(+start + 7200000),
      },
    });
    await scope(1, () => bookClass(zSession.id, memberId, "MEMBER"));
    // Cancel sessions[1] để dời Z không vấp room/coach collision tại B —
    // đúng lý do phải kiểm chứng là member conflict với booking tại A.
    await prisma.classSchedule.update({
      where: { id: sessions[1].id },
      data: { status: "CANCELLED" },
    });
    // Dời Z về 08:00–09:00 (trùng booking tại A của chính member) → 409, Z giữ nguyên.
    await assert.rejects(
      scope(1, () =>
        updateSchedule(zSession.id, { startTime: start, endTime: end }),
      ),
      reject409,
    );
    assert.equal(
      +(
        await prisma.classSchedule.findUniqueOrThrow({
          where: { id: zSession.id },
        })
      ).startTime,
      +start + 5400000,
    );
    console.log(
      "PASS moving a booked session cannot create a member conflict at another facility",
    );
    await prisma.enrollment.deleteMany({ where: { memberId } });
    await prisma.classSchedule.update({
      where: { id: sessions[1].id },
      data: { status: "SCHEDULED" },
    });
    const race = await Promise.allSettled(
      sessions.map((s, i) =>
        scope(i, () => bookClass(s.id, memberId, "MEMBER")),
      ),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(race.filter((r) => r.status === "rejected").length, 1);
    assert.equal(
      await prisma.enrollment.count({ where: { memberId, status: "BOOKED" } }),
      1,
    );
    console.log(
      "PASS simultaneous cross-facility requests create exactly one overlapping booking",
    );
  } finally {
    const memberIds = [memberId, freeMemberId].filter(Boolean);
    if (memberIds.length) {
      await prisma.enrollment.deleteMany({ where: { memberId: { in: memberIds } } });
      await prisma.membershipSubscription.deleteMany({ where: { memberId: { in: memberIds } } });
    }
    await prisma.notificationOutbox.deleteMany({
      where: { userId: { in: users } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.classSchedule.deleteMany({
      where: { classId: { in: classes } },
    });
    await prisma.classMember.deleteMany({
      where: { classId: { in: classes } },
    });
    await prisma.class.deleteMany({ where: { id: { in: classes } } });
    await prisma.auditLog.deleteMany({
      where: { facilityId: { in: facilities } },
    });
    await prisma.room.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (planId) await prisma.membershipPlan.delete({ where: { id: planId } });
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
