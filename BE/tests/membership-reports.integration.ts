/**
 * Regression test MF-04 / MF-06 / MF-07 / MF-08 — báo cáo membership & phục hồi FREE.
 *
 * MF-04: /reports/members phải dùng MỘT cohort (global people) — không trộn origin-scoped.
 * MF-06: activeSubscriptions phải dùng cùng định nghĩa "đang hiệu lực" với subscriptionsByTier.
 * MF-07: báo cáo ORIGIN phải fail-fast khi thiếu facility context (không âm thầm thành GLOBAL).
 * MF-08: login tự phục hồi gói FREE khi đăng ký từng thất bại giữa chừng (idempotent).
 *
 * Chạy trên DB test cô lập (schema bắt đầu bằng scms_verify_):
 *   npm run test:operations:membership-reports
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { requestContext } from "../src/config/request-context.js";

const DAY = 86400000;

async function main() {
  assert.match(
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "",
    /^scms_verify_/,
  );
  const { prisma } = await import("../src/config/prisma.js");
  const { getMemberReport, getMembershipReport, getSubscriptionLogs } = await import(
    "../src/modules/reports/reports.service.js"
  );
  const { login } = await import("../src/modules/auth/auth.service.js");
  // Only this isolated regression fixture mocks Cloudflare; production login still verifies.
  const { env } = await import("../src/config/env.js");
  const fixtureLogin = async (email: string, password: string) => {
    const originalFetch = globalThis.fetch;
    const originalSecret = env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    const token = randomUUID();
    env.CLOUDFLARE_TURNSTILE_SECRET_KEY = randomUUID();
    const upstream = mock.method(globalThis, "fetch", async (
      url: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1],
    ) => {
      if (String(url) !== "https://challenges.cloudflare.com/turnstile/v0/siteverify")
        return originalFetch(url, options);
      assert.equal(new URLSearchParams(String(options?.body)).get("response"), token);
      return Response.json({ success: true, action: "login" });
    });
    try { return await login(email, password, token); }
    finally {
      upstream.mock.restore();
      env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalSecret;
    }
  };

  const run = randomUUID();
  const START = "2020-01-01";
  const END = "2030-12-31";
  const facilities: string[] = [],
    users: string[] = [],
    profiles: string[] = [],
    plans: string[] = [],
    subs: string[] = [];
  let mongoUsers: string[] = [];

  let passed = 0,
    skipped = 0;
  const fails: string[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) => {
    if (ok) {
      passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      const msg = `${name} — ${JSON.stringify(detail)}`;
      fails.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  };
  const scope = <T>(i: number, fn: () => Promise<T>) =>
    requestContext.run(
      { facilityId: facilities[i], actorId: "report-test", role: "MANAGER" },
      fn,
    );

  try {
    // ── Fixture ───────────────────────────────────────────────────
    for (const code of ["F1", "F2"]) {
      const f = await prisma.facility.create({
        data: { code: `MR-${run}-${code}`, name: code, address: "fixture" },
      });
      facilities.push(f.id);
    }
    const plan = await prisma.membershipPlan.create({
      data: {
        name: `MR-${run}`, tier: "MEMBERSHIP", price: 1000000,
        durationDays: 30, maxConcurrentClasses: 3,
      },
    });
    plans.push(plan.id);

    const mkMember = async (tag: string) => {
      const user = await prisma.user.create({
        data: { email: `mr-${run}-${tag}@test.invalid`, fullName: `MR ${tag}`, password: "x", role: "MEMBER" },
      });
      users.push(user.id);
      const mp = await prisma.memberProfile.create({ data: { userId: user.id } });
      profiles.push(mp.id);
      return mp.id;
    };
    const mkSub = async (
      memberId: string,
      originIdx: number,
      tier: "MEMBERSHIP" | "PREMIUM",
      startDate: Date,
      endDate: Date,
      status: "ACTIVE" | "EXPIRED" = "ACTIVE",
    ) => {
      const s = await prisma.membershipSubscription.create({
        data: {
          facilityId: facilities[originIdx], memberId, planId: plan.id, tier,
          startDate, endDate, status, maxConcurrentClassesSnapshot: 3,
        },
      });
      subs.push(s.id);
      return s;
    };
    const now = Date.now();

    // 5 hội viên ACTIVE: 2 có gói hiệu lực (F1, F2), 1 không gói,
    // 1 gói ACTIVE nhưng startDate tương lai (stacking), 1 gói ACTIVE nhưng endDate đã qua.
    const m1 = await mkMember("m1");
    const m2 = await mkMember("m2");
    const m3 = await mkMember("m3");
    const m4 = await mkMember("m4");
    const m5 = await mkMember("m5");
    await mkSub(m1, 0, "MEMBERSHIP", new Date(now - 2 * DAY), new Date(now + 28 * DAY));
    await mkSub(m2, 1, "PREMIUM", new Date(now - 2 * DAY), new Date(now + 28 * DAY));
    await mkSub(m4, 0, "MEMBERSHIP", new Date(now + 10 * DAY), new Date(now + 40 * DAY)); // chưa hiệu lực
    await mkSub(m5, 0, "MEMBERSHIP", new Date(now - 40 * DAY), new Date(now - 5 * DAY)); // đã quá hạn nhưng còn status ACTIVE

    // ── MF-04: /reports/members phải dùng MỘT cohort global ─────
    const rF1 = await scope(0, () => getMemberReport(START, END));
    const rF2 = await scope(1, () => getMemberReport(START, END));
    const rNoCtx = await getMemberReport(START, END);
    check(
      "MF-04: cohort nhất quán (total=5, active=2, expired=3) và KHÔNG đổi theo facility",
      rF1.totalMembers === 5 && rF1.activeMembers === 2 && rF1.expiredMembers === 3 &&
        JSON.stringify(rF1) === JSON.stringify(rF2) &&
        JSON.stringify(rF1) === JSON.stringify(rNoCtx),
      { f1: rF1, f2: rF2, noCtx: rNoCtx },
    );
    check(
      "MF-04: membersByTier cộng lại = totalMembers (FREE=3, MEMBERSHIP=1, PREMIUM=1)",
      (rF1.membersByTier.FREE ?? 0) + (rF1.membersByTier.MEMBERSHIP ?? 0) +
        (rF1.membersByTier.PREMIUM ?? 0) === rF1.totalMembers &&
        rF1.membersByTier.FREE === 3 &&
        rF1.membersByTier.MEMBERSHIP === 1 &&
        rF1.membersByTier.PREMIUM === 1,
      rF1.membersByTier,
    );

    // ── MF-06: activeSubscriptions = sum(subscriptionsByTier) ────
    const mrF1 = await scope(0, () => getMembershipReport(START, END));
    const sumF1 = Object.values(mrF1.subscriptionsByTier).reduce((a, b) => a + b, 0);
    check(
      "MF-06 [F1]: activeSubscriptions = tổng subscriptionsByTier = 1 (loại gói stacking + quá hạn)",
      mrF1.activeSubscriptions === 1 && sumF1 === 1,
      { active: mrF1.activeSubscriptions, sum: sumF1, byTier: mrF1.subscriptionsByTier },
    );
    const mrF2 = await scope(1, () => getMembershipReport(START, END));
    const sumF2 = Object.values(mrF2.subscriptionsByTier).reduce((a, b) => a + b, 0);
    check(
      "MF-06 [F2]: chỉ đếm gói phát hành tại F2 (1 PREMIUM), vẫn đồng bộ nội bộ",
      mrF2.activeSubscriptions === 1 && sumF2 === 1 && mrF2.subscriptionsByTier.PREMIUM === 1,
      { active: mrF2.activeSubscriptions, byTier: mrF2.subscriptionsByTier },
    );
    check(
      "MF-07: có facility context → báo cáo ORIGIN chạy bình thường",
      typeof mrF1.totalSubscriptions === "number" && typeof mrF1.totalRevenue === "number",
      { total: mrF1.totalSubscriptions, revenue: mrF1.totalRevenue },
    );

    // ── MF-07: fail-fast khi thiếu facility context ──────────────
    let e1: any = null;
    let e2: any = null;
    try {
      await getMembershipReport(START, END);
    } catch (e) {
      e1 = e;
    }
    try {
      await getSubscriptionLogs();
    } catch (e) {
      e2 = e;
    }
    check(
      "MF-07: /reports/memberships thiếu facility context → 400 FACILITY_CONTEXT_REQUIRED",
      e1?.statusCode === 400 && e1?.message === "FACILITY_CONTEXT_REQUIRED",
      { message: e1?.message, statusCode: e1?.statusCode },
    );
    check(
      "MF-07: /reports/subscription-logs thiếu facility context → 400 FACILITY_CONTEXT_REQUIRED",
      e2?.statusCode === 400 && e2?.message === "FACILITY_CONTEXT_REQUIRED",
      { message: e2?.message, statusCode: e2?.statusCode },
    );

    // ── MF-08: login tự phục hồi FREE (cần MongoDB test) ─────────
    try {
      const { connectTestMongo, createIdentity, deleteIdentities } = await import(
        "./helpers/identity.js"
      );
      const { hashPassword } = await import("../src/utils/bcrypt.js");
      await connectTestMongo();
      const plain = "Mf08!repair-2026";
      const email = `mf08-${run}@test.invalid`;
      const identity = await createIdentity({
        email,
        password: await hashPassword(plain),
        fullName: "MF-08 member",
        role: "MEMBER",
      });
      mongoUsers.push(identity.id);
      users.push(identity.id);
      const memberId = identity.memberProfile!.id;
      profiles.push(memberId);

      const before = await prisma.membershipSubscription.count({ where: { memberId } });
      check(
        "MF-08: fixture thực sự KHÔNG có subscription (mô phỏng đăng ký đứt giữa chừng)",
        before === 0,
        before,
      );

      await fixtureLogin(email, plain);
      const after = await prisma.membershipSubscription.findMany({ where: { memberId } });
      check(
        "MF-08: sau login → đúng 1 gói FREE ACTIVE, facilityId NULL",
        after.length === 1 && after[0].tier === "FREE" && after[0].status === "ACTIVE" &&
          after[0].facilityId === null,
        after.map((s) => `${s.tier}/${s.status}/${String(s.facilityId)}`),
      );

      await fixtureLogin(email, plain);
      const again = await prisma.membershipSubscription.count({ where: { memberId } });
      check("MF-08: login lần 2 vẫn idempotent (không tạo trùng)", again === 1, again);

      await deleteIdentities(mongoUsers);
      mongoUsers = [];
    } catch (e) {
      skipped++;
      console.log(`  [SKIP] MF-08 (cần MongoDB test): ${(e as Error).message}`);
    }
  } finally {
    await prisma.notificationOutbox.deleteMany({ where: { userId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: users } } });
    await prisma.membershipSubscription.deleteMany({ where: { memberId: { in: profiles } } });
    await prisma.memberProfile.deleteMany({ where: { id: { in: profiles } } });
    await prisma.membershipPlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.facility.deleteMany({ where: { id: { in: facilities } } });
    if (mongoUsers.length) {
      const { deleteIdentities } = await import("./helpers/identity.js");
      await deleteIdentities(mongoUsers).catch(() => {});
    }
    console.log("\nĐã dọn sạch fixture membership-reports.");
    await prisma.$disconnect();
    // Đóng Mongoose (MF-08 đã connect): nếu không, event loop giữ process sống mãi
    // → suite PASS nhưng không bao giờ exit (treo terminal/CI).
    const { disconnectTestMongo } = await import("./helpers/identity.js");
    await disconnectTestMongo().catch(() => {});
  }

  console.log(
    `\n=== KET QUA MF-04/06/07/08: PASS=${passed} FAIL=${fails.length} SKIP=${skipped} ===`,
  );
  if (fails.length) {
    console.log("Cac check that bai:");
    for (const f of fails) console.log("  - " + f);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});


