import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL = "postgresql://audit:audit@127.0.0.1:1/audit";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/audit";
process.env.JWT_ACCESS_SECRET = "audit-access-secret-do-not-deploy";
process.env.JWT_REFRESH_SECRET = "audit-refresh-secret-do-not-deploy";
const { prisma } = require("../src/config/prisma.js");
const { User } = require("../src/models/User.js");
const mongoose = require("mongoose");
const {
  inspectPlanPurchase,
} = require("../src/modules/subscriptions/subscription-purchase.service.js");
const {
  findActiveSubscription,
} = require("../src/modules/enrollments/enrollment-quota.service.js");
const {
  activateDueSubscription,
  isGrantSourceValid,
} = require("../src/modules/subscriptions/entitlement.service.js");
const {
  updatePaymentStatus,
} = require("../src/modules/payments/payments.service.js");
const { requestRefund } = require("../src/modules/payments/refunds.service.js");
const { UpdateTermSchema } = require("../src/modules/terms/terms.schema.js");
const { updateTerm } = require("../src/modules/terms/terms.service.js");
const {
  createAttendance,
} = require("../src/modules/attendance/attendance.service.js");
const {
  createUser,
  deactivateUser,
} = require("../src/modules/users/users.service.js");
const { changePassword } = require("../src/modules/auth/auth.service.js");
const { authenticate } = require("../src/middlewares/authenticate.js");
const { signAccessToken } = require("../src/utils/jwt.js");
const { hashPassword } = require("../src/utils/bcrypt.js");
const { RefreshToken } = require("../src/models/RefreshToken.js");
const {
  validateResources,
} = require("../src/modules/operations/scheduling.js");
const { checkFacilityScope } = require("../src/middlewares/facilityScope.js");
async function fixture(
  run: (stub: (object: any, key: string, value: any) => void) => Promise<void>,
) {
  const originals: [any, string, any][] = [];
  const stub = (object: any, key: string, value: any) => {
    originals.push([object, key, object[key]]);
    object[key] = value;
  };
  try {
    await run(stub);
  } finally {
    for (const [object, key, value] of originals.reverse()) object[key] = value;
  }
}

test("AUD-05: conflicting facility contexts remain forbidden; Admin FE must omit ALL", async () => {
  let error: any;
  await checkFacilityScope(
    {
      user: { id: "admin", role: "ADMIN" },
      params: {},
      query: { facilityId: "ALL" },
      body: {},
      get: () => "facility-a",
    },
    {},
    (e: any) => {
      error = e;
    },
  );
  assert.equal(error.statusCode, 400);
});
test("AUD-01: a paid queued period blocks another purchase without changing its dates", async () => {
  const plan = {
    id: "monthly",
    name: "Monthly",
    tier: "MEMBERSHIP",
    durationDays: 30,
  };
  const active = {
    id: "active",
    tier: "MEMBERSHIP",
    endDate: new Date("2030-11-10"),
    plan,
    payments: [],
  };
  let queued: any = null;
  const db = {
    membershipSubscription: {
      findFirst: async ({ where }: any) =>
        where.status === "SCHEDULED" ? queued : active,
    },
  };
  const first = await inspectPlanPurchase(
    db,
    "member",
    plan,
    undefined,
    new Date("2030-10-28"),
  );
  assert.equal(first.targetStatus, "SCHEDULED");
  assert.equal(first.calculatedStartDate.getTime(), active.endDate.getTime());
  queued = { id: "already-paid", status: "SCHEDULED" };
  await assert.rejects(
    () =>
      inspectPlanPurchase(
        db,
        "member",
        plan,
        undefined,
        new Date("2030-10-28"),
      ),
    /gói chờ kích hoạt/,
  );
});
test("AUD-02: entitlement reads perform no writes and ignore a cancelled scheduled period", async () => {
  let writes = 0;
  const db = {
    membershipSubscription: {
      findFirst: async ({ where }: any) =>
        where.status === "SCHEDULED" ? null : { id: "valid" },
      update: async () => {
        writes++;
      },
      updateMany: async () => {
        writes++;
      },
    },
  };
  assert.equal((await findActiveSubscription(db, "member")).id, "valid");
  assert.equal(writes, 0);
});
test("AUD-02: stale activation cannot suspend a valid subscription", async () => {
  const writes: any[] = [];
  const tx = {
    $executeRaw: async () => 0,
    membershipSubscription: {
      findFirst: async () => null,
      updateMany: async (args: any) => {
        writes.push(args);
        return { count: 0 };
      },
    },
  };
  assert.equal(await activateDueSubscription(tx, "cancelled", "member"), false);
  assert.ok(
    writes.every(
      (args) =>
        args.where.status === "SCHEDULED" && args.data.status === "EXPIRED",
    ),
  );
});
for (const status of ["ACTIVE", "SCHEDULED", "EXPIRED"])
  test(`AUD-03: confirmed refund revokes ${status} rights only from its source`, async () => {
    await fixture(async (stub) => {
      const payment: any = {
        id: "cash",
        status: "SUCCESS",
        gateway: null,
        amount: 300000,
        refundRequestedAt: new Date(),
        subscriptionId: "source",
        memberId: "member",
        invoice: null,
      };
      const sub: any = { id: "source", status, memberId: "member" };
      let revoked: any;
      let memberLocked = false;
      stub(prisma.payment, "findUnique", async () => payment);
      stub(prisma, "$transaction", async (run: any) =>
        run({
          $executeRaw: async (sql: TemplateStringsArray, memberId: string) => {
            assert.match(sql.join("?"), /membership:member:/);
            assert.equal(memberId, "member");
            memberLocked = true;
            return 0;
          },
          payment: {
            updateMany: async ({ data }: any) => {
              assert.equal(memberLocked, true);
              Object.assign(payment, data);
              return { count: 1 };
            },
          },
          membershipSubscription: {
            findUnique: async () => sub,
            update: async ({ data }: any) => Object.assign(sub, data),
          },
          enrollment: {
            updateMany: async (args: any) => {
              revoked = args;
              return { count: 1 };
            },
          },
        }),
      );
      await updatePaymentStatus("cash", "REFUNDED", {
        reason: "Đã hoàn tại quầy",
        reference: "cash-receipt-1",
      });
      assert.equal(payment.status, "REFUNDED");
      assert.equal(sub.status, "CANCELLED");
      assert.deepEqual(revoked.where.OR[0], { subscriptionId: "source" });
      assert.equal(revoked.where.memberId, "member");
      assert.equal(revoked.data.status, "CANCELLED");
    });
  });
test("refund requests do not claim that money has already been returned", async () => {
  let write: any;
  const tx = {
    payment: {
      findUnique: async () => ({ status: "SUCCESS", amount: 300000 }),
      updateMany: async (args: any) => {
        write = args;
        return { count: 1 };
      },
    },
  };
  await requestRefund(tx, { id: "paid" }, 90000, "Hủy theo chính sách");
  assert.equal(write.data.refundRequestedAmount, 90000);
  assert.equal(write.data.status, undefined);
  assert.equal(write.data.refundedAt, undefined);
});
test("AUD-07: partial term PATCH rejects an end date before the stored start", async () => {
  await fixture(async (stub) => {
    stub(prisma, "$transaction", async (run: any) =>
      run({ $executeRaw: async () => 0 }),
    );
    stub(prisma.term, "findUnique", async () => ({
      id: "term",
      status: "PLANNING",
      startDate: new Date("2030-11-01"),
      endDate: new Date("2030-12-01"),
      registrationStartDate: new Date("2030-09-01"),
      registrationEndDate: new Date("2030-10-01"),
    }));
    await assert.rejects(
      () =>
        updateTerm(
          "term",
          UpdateTermSchema.parse({ endDate: "2030-10-01T00:00:00Z" }),
        ),
      /không hợp lệ/,
    );
  });
});
test("AUD-06: a supporting coach keeps attendance rights with a substitute primary", async () => {
  await fixture(async (stub) => {
    const schedule = {
      id: "session",
      coachId: "replacement",
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() + 3600000),
      status: "SCHEDULED",
      class: {
        coaches: [
          { coachId: "primary", isPrimary: true },
          { coachId: "support", isPrimary: false },
        ],
      },
    };
    stub(prisma.classSchedule, "findUnique", async () => schedule);
    stub(prisma.coachProfile, "findUnique", async () => ({ id: "support" }));
    stub(prisma.enrollment, "findUnique", async () => ({ status: "BOOKED" }));
    stub(prisma.attendance, "create", async ({ data }: any) => data);
    assert.equal(
      (
        await createAttendance(
          { scheduleId: "session", memberId: "member", status: "PRESENT" },
          { id: "support-user", role: "COACH" },
        )
      ).status,
      "PRESENT",
    );
  });
});
test("AUD-04: PostgreSQL failure leaves Mongo account blocked and recoverable", async () => {
  await fixture(async (stub) => {
    let account: any;
    let committed = false;
    stub(User, "findOne", () => ({ select: async () => null }));
    stub(prisma.user, "findUnique", async () => null);
    stub(prisma.user, "updateMany", async () => ({ count: 0 }));
    stub(User.prototype, "save", async function (this: any) {
      account = this;
      return this;
    });
    stub(mongoose, "startSession", async () => ({
      startTransaction() {},
      commitTransaction: async () => {
        committed = true;
      },
      inTransaction: () => !committed,
      abortTransaction: async () => {},
      endSession() {},
    }));
    stub(prisma, "$transaction", async () => {
      throw Error("injected DB failure");
    });
    stub(User, "updateOne", async (_where: any, data: any) => {
      Object.assign(account, data.$set);
      return { modifiedCount: 1 };
    });
    await assert.rejects(
      () =>
        createUser({
          email: "audit@example.invalid",
          password: "AuditOnly123!",
          fullName: "Audit",
          role: "RECEPTIONIST",
        }),
      /Chưa hoàn tất/,
    );
    assert.ok(committed);
    assert.equal(account.isActive, false);
    assert.equal(account.provisioningStatus, "FAILED");
  });
});
test("AUD-08: protecting the last Admin counts Admins, not Managers", async () => {
  await fixture(async (stub) => {
    let predicate: any;
    stub(prisma, "$transaction", async (run: any) =>
      run({ $executeRaw: async () => 0 }),
    );
    stub(prisma.coachProfile, "findUnique", async () => null);
    stub(User, "findById", async () => ({ _id: "admin-2", role: "ADMIN" }));
    stub(User, "countDocuments", async (query: any) => {
      predicate = query;
      return 1;
    });
    await assert.rejects(
      () => deactivateUser("admin-2", "admin-1"),
      /cuối cùng/,
    );
    assert.equal(predicate.role, "ADMIN");
  });
});
test("AUD-09: changing a password immediately rejects an existing access token", async () => {
  await fixture(async (stub) => {
    const user = {
      _id: "user",
      role: "MEMBER",
      isActive: true,
      tokenVersion: 0,
      password: await hashPassword("OldPassword123!"),
    };
    const token = signAccessToken({
      id: "user",
      role: "MEMBER",
      tokenVersion: 0,
    });
    stub(User, "findById", () => ({
      select: () => {
        const p: any = Promise.resolve(user);
        p.lean = async () => user;
        return p;
      },
    }));
    stub(User, "updateOne", async (_where: any, data: any) => {
      user.password = data.password;
      user.tokenVersion += data.$inc.tokenVersion;
      return { modifiedCount: 1 };
    });
    stub(RefreshToken, "deleteMany", async () => ({ deletedCount: 1 }));
    await changePassword("user", "OldPassword123!", "NewPassword123!");
    let status = 0,
      next = false;
    const res = {
      status(n: number) {
        status = n;
        return this;
      },
      json() {
        return this;
      },
    };
    await authenticate(
      { headers: { authorization: `Bearer ${token}` } },
      res,
      () => {
        next = true;
      },
    );
    assert.equal(status, 401);
    assert.equal(next, false);
  });
});
test("AUD-10: resource validation enforces the stored equipment snapshot", async () => {
  const db = {
    class: {
      findUnique: async () => ({
        isActive: true,
        facilityId: "facility",
        capacity: 10,
        areaType: "INDOOR",
        requirementsSnapshot: { training_equipment: 1 },
        sports: [{ requirements: [] }],
        coaches: [{ coachId: "coach", isPrimary: true }],
      }),
    },
    room: {
      findUnique: async () => ({
        isActive: true,
        facilityId: "facility",
        capacity: 10,
        areaType: "INDOOR",
        capabilities: [],
      }),
    },
  };
  await assert.rejects(
    () =>
      validateResources(
        db,
        "room",
        "class",
        new Date(),
        new Date(Date.now() + 3600000),
      ),
    /ROOM_CAPABILITY_MISSING/,
  );
});

test("transfer cannot bypass the member cancellation cutoff", async () => {
  await fixture(async (stub) => {
    const {
      transferEnrollment,
    } = require("../src/modules/enrollments/enrollments.service.js");
    stub(prisma.enrollment, "findUnique", async () => ({
      id: "old",
      status: "BOOKED",
      scheduleId: "old-session",
      member: { userId: "user" },
      schedule: { startTime: new Date(Date.now() + 60000) },
    }));
    await assert.rejects(
      () => transferEnrollment("old", "target", "user", "MEMBER"),
      /quá thời hạn/,
    );
  });
});

test("provisioning retries the same blocked account without creating a duplicate user", async () => {
  await fixture(async (stub) => {
    const {
      provisionAccount,
    } = require("../src/modules/users/provisioning.service.js");
    const account: any = {
      _id: "same-id",
      email: "retry@example.invalid",
      fullName: "Retry",
      role: "RECEPTIONIST",
      isActive: false,
      provisioningStatus: "FAILED",
      password: await hashPassword("RetryPassword123!"),
    };
    const writes: any[] = [];
    stub(User, "findOne", () => ({ select: async () => account }));
    stub(User, "findOneAndUpdate", (_where: any, data: any) => ({
      select: async () => {
        Object.assign(account, data.$set);
        return account;
      },
    }));
    stub(User, "updateOne", async (_where: any, data: any) => {
      Object.assign(account, data.$set);
      return { modifiedCount: 1 };
    });
    stub(prisma, "$transaction", async (run: any) =>
      run({
        $executeRaw: async () => 0,
        user: {
          upsert: async (args: any) => {
            writes.push(args);
            return { id: "same-id" };
          },
        },
      }),
    );
    stub(prisma.user, "update", async ({ data }: any) => {
      assert.equal(account.provisioningStatus, "READY");
      assert.equal(data.isActive, true);
      return { id: "same-id" };
    });
    assert.equal(
      await provisionAccount({
        email: account.email,
        password: "RetryPassword123!",
        fullName: "Retry",
        role: "RECEPTIONIST",
      }),
      "same-id",
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].create.isActive, false);
    assert.equal(account.isActive, true);
    await assert.rejects(
      () =>
        provisionAccount({
          email: account.email,
          password: "RetryPassword123!",
          fullName: "Retry",
          role: "RECEPTIONIST",
        }),
      /already in use/,
    );
  });
});

test("HTTP report integration crosses authentication, facility middleware and controller", async () => {
  await fixture(async (stub) => {
    const express = require("express");
    const { createServer } = require("node:http");
    const { requestContext } = require("../src/config/request-context.js");
    const { errorHandler } = require("../src/middlewares/errorHandler.js");
    const reportRoutes =
      require("../src/modules/reports/reports.routes.js").default;
    let role = "ADMIN";
    const observed: any[] = [];
    stub(User, "findById", () => ({
      select: () => ({
        lean: async () => ({
          _id: "user",
          role,
          isActive: true,
          tokenVersion: 0,
        }),
      }),
    }));
    stub(prisma.user, "findUnique", async () => ({ role, isActive: true }));
    stub(prisma.facility, "findUnique", async () => ({
      id: "facility-a",
      isActive: true,
    }));
    stub(prisma.facilityStaff, "findMany", async () => [
      { facilityId: "facility-a" },
    ]);
    stub(prisma.membershipSubscription, "count", async () => 0);
    stub(prisma.membershipSubscription, "groupBy", async () => []);
    stub(prisma.membershipSubscription, "findMany", async () => []);
    stub(prisma.membershipPlan, "findMany", async () => []);
    stub(prisma.payment, "aggregate", async () => ({ _sum: { amount: 0 } }));
    stub(prisma.payment, "groupBy", async () => []);
    stub(prisma.enrollment, "findMany", async () => {
      observed.push(requestContext.getStore());
      return [];
    });
    const app = express();
    app.use(express.json());
    app.use("/reports", authenticate, checkFacilityScope, reportRoutes);
    app.use(errorHandler);
    const server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const base = `http://127.0.0.1:${server.address().port}/reports/memberships?startDate=2026-10-01&endDate=2026-10-29`;
    const headers = () => ({
      Authorization: `Bearer ${signAccessToken({ id: "user", role, tokenVersion: 0 })}`,
      "X-Facility-Id": "facility-a",
    });
    try {
      const noFacility = await fetch(base, { headers: { Authorization: headers().Authorization } });
      assert.equal(noFacility.status, 200);
      const admin = await fetch(base, { headers: headers() });
      assert.equal(admin.status, 200);
      assert.equal(observed.at(-1).facilityId, undefined);
      role = "MANAGER";
      const manager = await fetch(base, { headers: headers() });
      assert.equal(manager.status, 200);
      assert.equal(observed.at(-1).facilityId, "facility-a");
      const crossed = await fetch(base + "&facilityId=facility-b", {
        headers: headers(),
      });
      assert.equal(crossed.status, 403);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
