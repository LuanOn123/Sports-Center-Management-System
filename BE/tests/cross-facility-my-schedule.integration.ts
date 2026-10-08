/**
 * Regression test MF-03 — "Lịch của tôi" (GET /enrollments/my) phải là GLOBAL,
 * nhất quán với Membership/Quota toàn cục, trong khi view vận hành vẫn facility-scoped.
 *
 * Chạy trên DB test cô lập (schema bắt đầu bằng scms_verify_):
 *   npm run test:operations:cross-facility-my-schedule
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
  const { getMyEnrollments, bookClass } = await import(
    "../src/modules/enrollments/enrollments.service.js"
  );
  const { getMyConcurrentClassQuota } = await import(
    "../src/modules/enrollments/enrollment-quota.service.js"
  );

  const run = randomUUID();
  const facilities: string[] = [],
    users: string[] = [],
    profiles: string[] = [],
    plans: string[] = [],
    rooms: string[] = [],
    classes: string[] = [],
    schedules: string[] = [],
    subs: string[] = [];

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
  /** Giả lập FE đổi X-Facility-Id sang cơ sở thứ i. */
  const scope = <T>(i: number, fn: () => Promise<T>) =>
    requestContext.run(
      { facilityId: facilities[i], actorId: "my-schedule-test", role: "MEMBER" },
      fn,
    );

  try {
    // ── Fixture: A(1 class) / B(2 class) / C(1 class) ─────────────
    for (const code of ["A", "B", "C"]) {
      const f = await prisma.facility.create({
        data: { code: `MS-${run}-${code}`, name: `Facility ${code}`, address: "fixture" },
      });
      facilities.push(f.id);
      const room = await prisma.room.create({
        data: { facilityId: f.id, name: `MS-room-${run}-${code}`, capacity: 50, areaType: "INDOOR" },
      });
      rooms.push(room.id);
    }
    const mkClass = (facilityIdx: number, name: string) =>
      prisma.class
        .create({
          data: {
            facilityId: facilities[facilityIdx],
            name: `${name}-${run}`,
            capacity: 50,
            areaType: "INDOOR",
          },
        })
        .then((c) => {
          classes.push(c.id);
          return c.id;
        });
    const classA = await mkClass(0, "MS-classA");
    const classB1 = await mkClass(1, "MS-classB1");
    const classB2 = await mkClass(1, "MS-classB2");
    const classC = await mkClass(2, "MS-classC");

    const base = new Date(Date.now() + 5 * DAY);
    const mkSched = (roomIdx: number, classId: string, offsetMin: number, minutes = 60) =>
      prisma.classSchedule
        .create({
          data: {
            classId,
            roomId: rooms[roomIdx],
            startTime: new Date(+base + offsetMin * 60000),
            endTime: new Date(+base + (offsetMin + minutes) * 60000),
          },
        })
        .then((s) => {
          schedules.push(s.id);
          return s.id;
        });

    const sA1 = await mkSched(0, classA, 0); // A: mốc giờ chính
    const sAcancel = await mkSched(0, classA, 24 * 60); // A: CANCELLED
    const sAdone = await mkSched(0, classA, 25 * 60); // A: COMPLETED
    const sB1 = await mkSched(1, classB1, 180); // B: +3h (không chồng sA1)
    const sB3 = await mkSched(1, classB2, 300); // B: +5h (không chồng sA1)
    const sC1 = await mkSched(2, classC, 60); // C
    const sConflict = await mkSched(1, classB1, 30, 30); // B: chỉ chồng sA1

    const mkMember = async (tag: string, withPlan: boolean) => {
      const user = await prisma.user.create({
        data: { email: `ms-${run}-${tag}@test.invalid`, fullName: `MS ${tag}`, password: "x", role: "MEMBER" },
      });
      users.push(user.id);
      const mp = await prisma.memberProfile.create({ data: { userId: user.id } });
      profiles.push(mp.id);
      let subId = "";
      if (withPlan) {
        const plan = await prisma.membershipPlan.create({
          data: {
            name: `MS-${run}-${tag}`, tier: "MEMBERSHIP", price: 1000000,
            durationDays: 30, maxConcurrentClasses: 3,
          },
        });
        plans.push(plan.id);
        const sub = await prisma.membershipSubscription.create({
          data: {
            facilityId: facilities[0], memberId: mp.id, planId: plan.id, tier: "MEMBERSHIP",
            startDate: new Date(Date.now() - 2 * DAY),
            endDate: new Date(Date.now() + 30 * DAY),
            maxConcurrentClassesSnapshot: 3,
          },
        });
        subs.push(sub.id);
        subId = sub.id;
      }
      return { userId: user.id, profileId: mp.id, subId };
    };

    const mA = await mkMember("a", true); // có gói; đặt chỗ ở A + B
    const mB = await mkMember("b", false); // chỉ 1 chỗ ở C (cách ly member)
    const mEmpty = await mkMember("empty", false); // không có booking nào

    const book = (
      profileId: string,
      classId: string,
      scheduleId: string,
      status: "BOOKED" | "CANCELLED" | "COMPLETED" = "BOOKED",
    ) => prisma.enrollment.create({ data: { memberId: profileId, classId, scheduleId, status } });

    // mA: A=1 booking, B=2 booking (3 class khác nhau) + 1 CANCELLED + 1 COMPLETED
    const eA = await book(mA.profileId, classA, sA1);
    const eB1 = await book(mA.profileId, classB1, sB1);
    const eB2 = await book(mA.profileId, classB2, sB3);
    await book(mA.profileId, classA, sAcancel, "CANCELLED");
    await book(mA.profileId, classA, sAdone, "COMPLETED");
    const eC = await book(mB.profileId, classC, sC1);

    // ── Test 1: hiển thị liên cơ sở khi đang chọn Facility A ───────
    const atA = await scope(0, () => getMyEnrollments(mA.userId, {}));
    const idsAtA = atA.enrollments.map((e) => e.id);
    check(
      "Test1: chọn Facility A → thấy CẢ booking tại A và B (3 future BOOKED + CANCELLED + COMPLETED)",
      atA.enrollments.length === 5 &&
        idsAtA.includes(eA.id) && idsAtA.includes(eB1.id) && idsAtA.includes(eB2.id),
      { total: atA.pagination.total, ids: idsAtA.length },
    );
    check(
      "Test1: KHÔNG thấy booking của hội viên khác (facility C)",
      !idsAtA.includes(eC.id),
      { leaked: idsAtA.includes(eC.id) },
    );

    // ── Test 2: đổi Facility không làm đổi lịch của tôi ───────────
    const atB = await scope(1, () => getMyEnrollments(mA.userId, {}));
    const atC = await scope(2, () => getMyEnrollments(mA.userId, {}));
    const sameSet = (x: { enrollments: { id: string }[] }, y: { enrollments: { id: string }[] }) =>
      [...x.enrollments.map((e) => e.id)].sort().join() ===
      [...y.enrollments.map((e) => e.id)].sort().join();
    check(
      "Test2: Facility A → B → C trả về CÙNG một tập lịch cá nhân",
      sameSet(atA, atB) && sameSet(atA, atC),
      { a: atA.enrollments.length, b: atB.enrollments.length, c: atC.enrollments.length },
    );
    check(
      "Test2: KHÔNG có facility context (gọi ngoài scope) vẫn trả đủ",
      (await getMyEnrollments(mA.userId, {})).enrollments.length === 5,
      {},
    );

    // ── Test 4: cách ly hội viên ──────────────────────────────────
    const onlyB = await scope(0, () => getMyEnrollments(mB.userId, {}));
    check(
      "Test4: hội viên B chỉ thấy chỗ của B (facility C), không thấy chỗ của A",
      onlyB.enrollments.length === 1 && onlyB.enrollments[0].id === eC.id,
      onlyB.enrollments.map((e) => e.id),
    );
    const empty = await scope(0, () => getMyEnrollments(mEmpty.userId, {}));
    check("Test4: hội viên không có booking → rỗng, pagination.total = 0",
      empty.enrollments.length === 0 && empty.pagination.total === 0, empty.pagination);

    // ── Test 3: nhất quán với quota GLOBAL (A=1 booking, B=2 booking) ──
    for (const ctx of [0, 1]) {
      const my = await scope(ctx, () => getMyEnrollments(mA.userId, {}));
      const quota = await scope(ctx, () => getMyConcurrentClassQuota(mA.userId));
      const relevant = my.enrollments.filter(
        (e) => e.status === "BOOKED" && new Date(e.schedule.startTime).getTime() > Date.now(),
      );
      check(
        `Test3 [facility=${ctx === 0 ? "A" : "B"}]: đủ 3 booking tương lai VÀ quota.used=3 / limit=3`,
        relevant.length === 3 && quota.used === 3 && quota.limit === 3,
        { relevant: relevant.length, used: quota.used, limit: quota.limit },
      );
      check(
        `Test3 [facility=${ctx === 0 ? "A" : "B"}]: quota không reset khi đổi facility`,
        quota.hasActiveSubscription === true && quota.classes.length === 3,
        { hasActiveSubscription: quota.hasActiveSubscription, classes: quota.classes.length },
      );
    }

    // ── Phase 4: danh tính cơ sở THẬT trên từng bản ghi ──────────
    const facilityOf = (e: any) => e.schedule?.class?.facility;
    const facIds = atA.enrollments.map((e) => facilityOf(e)?.id);
    check(
      "Phase4: mỗi chỗ đặt kèm facility THẬT của nó (A và B đều xuất hiện)",
      facIds.filter((f) => f === facilities[0]).length >= 1 &&
        facIds.filter((f) => f === facilities[1]).length >= 2 &&
        atA.enrollments.every((e) => Boolean(facilityOf(e)?.id) && Boolean(facilityOf(e)?.code)),
      { facIds },
    );

    // ── Edge: status filter / pagination / sort ──────────────────
    const cancelledOnly = await scope(1, () => getMyEnrollments(mA.userId, { status: "CANCELLED" }));
    check(
      "Edge: filter status=CANCELLED chạy trên toàn bộ cơ sở",
      cancelledOnly.enrollments.length === 1 && cancelledOnly.enrollments[0].status === "CANCELLED",
      cancelledOnly.enrollments.map((e) => e.status),
    );
    const paged = await scope(2, () => getMyEnrollments(mA.userId, { page: 2, limit: 2 }));
    check(
      "Edge: phân trang giữ nguyên (5 bản ghi, page=2/limit=2 → 2 bản ghi, total=5, totalPages=3)",
      paged.enrollments.length === 2 &&
        paged.pagination.total === 5 &&
        paged.pagination.page === 2 &&
        paged.pagination.totalPages === 3,
      paged.pagination,
    );
    const statusSet = atA.enrollments.map((e) => e.status).sort().join();
    check(
      "Edge: BOOKED/CANCELLED/COMPLETED đều hiện theo hành vi hiện tại (không đổi policy)",
      statusSet === "BOOKED,BOOKED,BOOKED,CANCELLED,COMPLETED",
      statusSet,
    );

    // ── Test 5: view vận hành VẪN facility-scoped ────────────────
    const classesA = await scope(0, () =>
      prisma.class.findMany({ select: { id: true, facilityId: true } }),
    );
    const roomsB = await scope(1, () =>
      prisma.room.findMany({ select: { id: true, facilityId: true } }),
    );
    check(
      "Test5: GET /classes (A) chỉ thấy class của A",
      classesA.length === 1 && classesA[0].id === classA &&
        classesA.every((c) => c.facilityId === facilities[0]),
      classesA.map((c) => c.id),
    );
    check(
      "Test5: GET /rooms (B) chỉ thấy room của B",
      roomsB.length === 1 && roomsB[0].facilityId === facilities[1],
      roomsB.map((r) => r.facilityId),
    );
    const rosterA = await scope(0, () =>
      prisma.enrollment.findMany({ where: { scheduleId: sB1 }, select: { id: true } }),
    );
    const ordinaryA = await scope(0, () =>
      prisma.enrollment.findMany({ select: { class: { select: { facilityId: true } } } }),
    );
    check(
      "Test5: danh sách enrollment THƯỜNG (staff/roster) vẫn facility-scoped — A không thấy booking của B",
      rosterA.length === 0 &&
        ordinaryA.every((e) => e.class.facilityId === facilities[0]),
      { rosterA: rosterA.length, ordinaryA: ordinaryA.length },
    );

    // ── Test 6: conflict cross-facility không bị hồi quy ──────────
    let conflict: any = null;
    try {
      await scope(1, () => bookClass(sConflict, mA.profileId, "MEMBER"));
    } catch (e: any) {
      conflict = e;
    }
    check(
      "Test6: ca tại B chồng giờ với chỗ ở A → 409 (schedule conflict vẫn GLOBAL)",
      conflict?.statusCode === 409,
      { statusCode: conflict?.statusCode, message: conflict?.message },
    );
  } finally {
    await prisma.enrollment.deleteMany({ where: { memberId: { in: profiles } } });
    await prisma.membershipSubscription.deleteMany({ where: { id: { in: subs } } });
    await prisma.classSchedule.deleteMany({ where: { id: { in: schedules } } });
    await prisma.class.deleteMany({ where: { id: { in: classes } } });
    await prisma.room.deleteMany({ where: { id: { in: rooms } } });
    await prisma.membershipPlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.notificationOutbox.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.memberProfile.deleteMany({ where: { id: { in: profiles } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { facilityId: { in: facilities } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    console.log("\nĐã dọn sạch fixture cross-facility-my-schedule.");
    await prisma.$disconnect();
  }

  console.log(`\n=== KET QUA MF-03: PASS=${passed} FAIL=${failures.length} ===`);
  if (failures.length) {
    console.log("Cac check that bai:");
    for (const f of failures) console.log("  - " + f);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});



