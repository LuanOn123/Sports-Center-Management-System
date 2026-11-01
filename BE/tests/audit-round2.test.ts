import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
process.env.DOTENV_CONFIG_PATH = "tests/nonexistent-audit-test.env";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "audit-regression-access";
process.env.JWT_REFRESH_SECRET = "audit-regression-refresh";
const { prisma } = require("../src/config/prisma.js");
const { Prisma } = require("@prisma/client");
const { User } = require("../src/models/User.js");
const { RefreshToken } = require("../src/models/RefreshToken.js");
const {
  resetPassword,
  forgotPassword,
} = require("../src/modules/auth/auth.service.js");
const {
  revokeSubscriptionBookings,
} = require("../src/modules/subscriptions/entitlement.service.js");
const {
  createPayment,
} = require("../src/modules/payments/payments.service.js");
const {
  inspectPlanPurchase,
} = require("../src/modules/subscriptions/subscription-purchase.service.js");
const {
  assertMemberFacilityAccess,
} = require("../src/modules/members/members.service.js");
const {
  getMemberReport,
} = require("../src/modules/reports/reports.service.js");
const {
  createScheduleBatch,
} = require("../src/modules/class-schedules/class-schedules.service.js");
const {
  RegisterSchema,
  UpdateProfileSchema,
} = require("../src/modules/auth/auth.schema.js");
const {
  passwordResetLimit,
} = require("../src/middlewares/passwordResetLimit.js");

async function fixture(
  run: (stub: (object: any, key: string, value: any) => void) => Promise<void>,
) {
  const restore: (() => void)[] = [];
  const stub = (object: any, key: string, value: any) => {
    const original = object[key];
    restore.push(() => {
      object[key] = original;
    });
    object[key] = value;
  };
  try {
    await run(stub);
  } finally {
    for (const fn of restore.reverse()) fn();
  }
}

for (const hasOtherPeriod of [false, true])
  test(`N1: legacy seats are released only without another paid period (${hasOtherPeriod})`, async () => {
    let filter: any;
    const tx = {
      membershipSubscription: {
        findFirst: async ({ where }: any) => {
          assert.deepEqual(where.status.in, ["ACTIVE", "SCHEDULED"]);
          assert.equal(where.tier.not, "FREE");
          return hasOtherPeriod ? { id: "other" } : null;
        },
      },
      enrollment: {
        updateMany: async ({ where, data }: any) => {
          filter = where;
          assert.equal(data.status, "CANCELLED");
          return { count: 1 };
        },
      },
    };
    await revokeSubscriptionBookings(tx, {
      id: "cancelled",
      memberId: "member",
    });
    assert.equal(filter.memberId, "member");
    assert.equal(filter.status, "BOOKED");
    assert.ok(filter.schedule.endTime.gt instanceof Date);
    assert.ok(filter.OR.some((v: any) => v.subscriptionId === "cancelled"));
    const legacy = filter.OR.find((v: any) => v.subscriptionId === null);
    assert.equal(Boolean(legacy), !hasOtherPeriod);
    if (legacy) assert.equal(legacy.termMembershipGrant.equals, Prisma.AnyNull);
  });

test("H1: a manual receipt without a source subscription cannot write anything", async () => {
  await assert.rejects(
    () =>
      createPayment(
        { memberId: "m", amount: 999999999, method: "CASH" },
        "staff",
      ),
    (e: any) =>
      e.statusCode === 400 && e.errors.code === "PAYMENT_SUBSCRIPTION_REQUIRED",
  );
});
for (const scenario of ["wrong-amount", "already-paid", "free", "valid"])
  test(`H1: manual source validation — ${scenario}`, async () =>
    fixture(async (stub) => {
      let writes = 0;
      const source = {
        id: "sub",
        memberId: "m",
        tier: scenario === "free" ? "FREE" : "MEMBERSHIP",
        status: "ACTIVE",
        priceSnapshot: 300000,
        plan: { price: 300000 },
      };
      stub(prisma.memberProfile, "findFirst", async () => ({ id: "m" }));
      stub(prisma.membershipSubscription, "findUnique", async () => source);
      stub(prisma, "$transaction", async (run: any) =>
        run({
          $executeRaw: async () => 0,
          membershipSubscription: { findUnique: async () => source },
          payment: {
            findFirst: async () =>
              scenario === "already-paid" ? { id: "receipt" } : null,
            create: async ({ data }: any) => {
              writes++;
              return { ...data, id: "new-receipt" };
            },
          },
          invoice: { create: async () => ({ id: "invoice" }) },
        }),
      );
      const action = () =>
        createPayment(
          {
            memberId: "m",
            subscriptionId: "sub",
            amount: scenario === "wrong-amount" ? 999999999 : 300000,
            method: "CASH",
          },
          "staff",
        );
      if (scenario === "valid") {
        assert.equal((await action()).id, "new-receipt");
        assert.equal(writes, 1);
      } else {
        await assert.rejects(
          action,
          (e: any) =>
            e.statusCode === (scenario === "wrong-amount" ? 400 : 409),
        );
        assert.equal(writes, 0);
      }
    }));

test("H2: five wrong OTPs lock the code, including the correct sixth attempt", async () =>
  fixture(async (stub) => {
    const otp = "123456";
    const user: any = {
      _id: "user",
      isActive: true,
      resetPasswordOtp: createHash("sha256").update(otp).digest("hex"),
      resetPasswordOtpExpiresAt: new Date(Date.now() + 60000),
    };
    let attempts = 0,
      passwordWrites = 0;
    stub(User, "findOne", async () => user);
    stub(User, "updateOne", async (filter: any, update: any) => {
      if (update.$inc?.resetPasswordOtpAttempts) {
        assert.equal(filter.$or[0].resetPasswordOtpAttempts.$lt, 5);
        if (attempts >= 5) return { modifiedCount: 0 };
        attempts++;
        return { modifiedCount: 1 };
      }
      passwordWrites++;
      return { modifiedCount: 1 };
    });
    for (let i = 0; i < 40; i++)
      await assert.rejects(() =>
        resetPassword({
          email: "demo@test.invalid",
          otp: "000000",
          newPassword: "New@123456",
        }),
      );
    await assert.rejects(() =>
      resetPassword({
        email: "demo@test.invalid",
        otp,
        newPassword: "New@123456",
      }),
    );
    assert.equal(attempts, 5);
    assert.equal(passwordWrites, 0);
  }));

test("H2: an unused correct OTP resets once; compare-and-set blocks replay", async () =>
  fixture(async (stub) => {
    const digest = createHash("sha256").update("123456").digest("hex");
    const user: any = {
      _id: "user",
      isActive: true,
      resetPasswordOtp: digest,
      resetPasswordOtpExpiresAt: new Date(Date.now() + 60000),
    };
    let consumed = false,
      revoked = 0;
    stub(User, "findOne", async () => user);
    stub(User, "updateOne", async (filter: any, update: any) => {
      if (update.$inc?.resetPasswordOtpAttempts)
        return { modifiedCount: consumed ? 0 : 1 };
      assert.equal(filter.resetPasswordOtp, digest);
      assert.equal(update.$inc.tokenVersion, 1);
      assert.equal(update.$set.resetPasswordOtp, null);
      if (consumed) return { modifiedCount: 0 };
      consumed = true;
      return { modifiedCount: 1 };
    });
    stub(RefreshToken, "deleteMany", async () => {
      revoked++;
    });
    await resetPassword({
      email: "demo@test.invalid",
      otp: "123456",
      newPassword: "New@123456",
    });
    await assert.rejects(() =>
      resetPassword({
        email: "demo@test.invalid",
        otp: "123456",
        newPassword: "Again@123456",
      }),
    );
    assert.equal(revoked, 1);
  }));

test("H2: a resend inside the persisted cooldown does not issue or send another code", async () =>
  fixture(async (stub) => {
    stub(User, "findOne", async () => ({ _id: "user", isActive: true }));
    stub(User, "updateOne", async (where: any, update: any) => {
      assert.ok(where.$or[0].resetPasswordRequestedAt.$lte instanceof Date);
      assert.equal(update.$set.resetPasswordOtpAttempts, 0);
      return { modifiedCount: 0 };
    });
    await forgotPassword({ email: "demo@test.invalid" });
  }));

test("H2: IP burst budget returns 429 without entering the auth handler", () => {
  const limit = passwordResetLimit(2);
  let next = 0,
    status = 0,
    retry = 0;
  const res: any = {
    setHeader: (_: string, v: number) => {
      retry = v;
    },
    status: (v: number) => {
      status = v;
      return res;
    },
    json: () => res,
  };
  for (let i = 0; i < 3; i++)
    limit({ ip: "127.0.0.1" } as any, res, () => {
      next++;
    });
  assert.equal(next, 2);
  assert.equal(status, 429);
  assert.ok(retry > 0);
});

test("H3: active people use the same cohort as the total, and are deduplicated", async () =>
  fixture(async (stub) => {
    stub(prisma.memberProfile, "count", async ({ where }: any) => {
      assert.deepEqual(where.user, { role: "MEMBER", isActive: true });
      return 2;
    });
    stub(prisma.membershipSubscription, "findMany", async ({ where }: any) => {
      assert.deepEqual(where.member.user, { role: "MEMBER", isActive: true });
      return [
        { memberId: "a", tier: "MEMBERSHIP" },
        { memberId: "a", tier: "PREMIUM" },
      ];
    });
    const result = await getMemberReport("2030-01-01", "2030-01-31");
    assert.equal(result.totalMembers, 2);
    assert.equal(result.activeMembers, 1);
    assert.equal(result.expiredMembers, 1);
  }));

test("M1: FREE plans cannot enter the shared purchase flow", async () => {
  await assert.rejects(
    () => inspectPlanPurchase({}, "member", { tier: "FREE", price: 0 }),
    (e: any) => e.statusCode === 400,
  );
});
test("M2: schedule creation rejects past sessions before writing or locking resources", async () =>
  fixture(async (stub) => {
    stub(prisma, "$transaction", async (run: any) => run({}));
    await assert.rejects(
      () =>
        createScheduleBatch({
          classId: "class",
          roomId: "room",
          schedules: [
            {
              startTime: "2000-01-01T00:00:00Z",
              endTime: "2000-01-01T01:00:00Z",
            },
          ],
        }),
      (e: any) => e.statusCode === 400,
    );
  }));
for (const related of [true, false])
  test(`M3: coach profile access requires a taught enrollment (${related})`, async () =>
    fixture(async (stub) => {
      stub(prisma.coachProfile, "findUnique", async () => ({ id: "coach" }));
      stub(prisma.enrollment, "findFirst", async ({ where }: any) => {
        assert.equal(where.memberId, "member");
        assert.ok(where.schedule);
        return related ? { id: "enrollment" } : null;
      });
      const action = () =>
        assertMemberFacilityAccess("member", {
          id: "coach-user",
          role: "COACH",
        });
      if (related) await action();
      else await assert.rejects(action, (e: any) => e.statusCode === 404);
    }));

test("L4: registration and profile update reject implausible dates of birth", () => {
  assert.equal(
    RegisterSchema.safeParse({
      email: "demo@test.invalid",
      password: "Pass@123",
      fullName: "Demo User",
      dateOfBirth: "1800-01-01",
    }).success,
    false,
  );
  assert.equal(
    UpdateProfileSchema.safeParse({ dateOfBirth: "1800-01-01" }).success,
    false,
  );
  assert.equal(
    UpdateProfileSchema.safeParse({ dateOfBirth: "2000-01-01" }).success,
    true,
  );
});

test("L1: an expired member cannot join a full session's waitlist", async () =>
  fixture(async (stub) => {
    const {
      joinWaitlist,
    } = require("../src/modules/waitlist/waitlist.service.js");
    let writes = 0;
    const schedule = {
      id: "session",
      classId: "class",
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 90000000),
      status: "SCHEDULED",
      class: { id: "class", capacity: 1, classType: "REGULAR" },
    };
    stub(prisma.classSchedule, "findUnique", async () => schedule);
    stub(prisma.memberProfile, "findUnique", async () => ({
      user: { isActive: true, role: "MEMBER" },
    }));
    stub(prisma, "$transaction", async (run: any) =>
      run({
        $executeRaw: async () => 0,
        classSchedule: { findUnique: async () => ({ termId: null }) },
        membershipSubscription: { findFirst: async () => null },
        enrollment: { findUnique: async () => null, count: async () => 1 },
        waitlistEntry: {
          findFirst: async () => null,
          create: async () => {
            writes++;
          },
        },
      }),
    );
    await assert.rejects(
      () => joinWaitlist("session", "member"),
      (e: any) => e.statusCode === 403,
    );
    assert.equal(writes, 0);
  }));

test("L3: public inactive-plan filters cannot expose hidden plans; authenticated Admin can manage them", async () =>
  fixture(async (stub) => {
    const express = require("express");
    const {
      default: routes,
    } = require("../src/modules/membership-plans/membership-plans.routes.js");
    const { signAccessToken } = require("../src/utils/jwt.js");
    const queries: any[] = [];
    stub(prisma.membershipPlan, "count", async () => 0);
    stub(prisma.membershipPlan, "findMany", async ({ where }: any) => {
      queries.push(where);
      return [];
    });
    stub(prisma.membershipPlan, "findUnique", async () => ({
      id: "hidden",
      isActive: false,
    }));
    stub(User, "findById", () => ({
      select: () => ({
        lean: async () => ({ _id: "admin", role: "ADMIN", isActive: true }),
      }),
    }));
    stub(prisma.user, "findUnique", async () => ({
      role: "ADMIN",
      isActive: true,
    }));
    const app = express();
    app.use("/plans", routes);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      assert.equal((await fetch(`${url}/plans?isActive=false`)).status, 200);
      assert.equal(queries[0].isActive, true);
      assert.equal((await fetch(`${url}/plans/hidden`)).status, 404);
      const headers = {
        Authorization: `Bearer ${signAccessToken({ id: "admin", role: "ADMIN" })}`,
      };
      assert.equal(
        (await fetch(`${url}/plans?isActive=false`, { headers })).status,
        200,
      );
      assert.equal(queries[1].isActive, false);
      assert.equal(
        (await fetch(`${url}/plans/hidden`, { headers })).status,
        200,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }));

test("M5: business E2E CAPTCHA fixtures are local-only and single-use", async () => {
  const {
    installTurnstileFixture,
    withFixtureTurnstile,
  } = require("./helpers/turnstile-fixture.js");
  const {
    verifyTurnstile,
  } = require("../src/modules/auth/turnstile.service.js");
  const original = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL =
      "postgresql://test:test@example.com/test?schema=scms_verify_fixture";
    assert.throws(() => installTurnstileFixture(), /disposable local/);
    process.env.DATABASE_URL =
      "postgresql://test:test@127.0.0.1:1/test?schema=scms_verify_fixture";
    const restore = installTurnstileFixture();
    try {
      const { turnstileToken } = withFixtureTurnstile({
        email: "test@test.invalid",
      });
      await verifyTurnstile(turnstileToken);
      await assert.rejects(
        () => verifyTurnstile(turnstileToken),
        (e: any) => e.statusCode === 400,
      );
      await assert.rejects(
        () => verifyTurnstile(""),
        (e: any) => e.statusCode === 400,
      );
    } finally {
      restore();
    }
  } finally {
    process.env.DATABASE_URL = original;
  }
});
