import assert from "node:assert/strict";
import { test } from "node:test";

// Service tests use isolated delegates; no application database is contacted.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "test-only-coach-changes-access-secret";
process.env.JWT_REFRESH_SECRET = "test-only-coach-changes-refresh-secret";
const {
  createCoachChange,
  decideCoachChange,
  assertRequestableSession,
} = require("../src/modules/operations/coach-changes.service.js");
const { requestContext } = require("../src/config/request-context.js");

function fixture() {
  const session = {
    id: "session-a",
    classId: "class-a",
    roomId: "room-a",
    status: "SCHEDULED",
    coachId: "coach-a",
    startTime: new Date("2099-01-01T01:00:00Z"),
    endTime: new Date("2099-01-01T02:00:00Z"),
    class: {
      name: "Yoga",
      facilityId: "facility-a",
      isActive: true,
      capacity: 10,
      areaType: "INDOOR",
      requirementsSnapshot: {},
      sports: [{ id: "yoga" }],
      coaches: [{ coachId: "coach-a" }],
    },
  };
  const row = {
    id: "request-a",
    facilityId: "facility-a",
    status: "PENDING",
    scheduleId: session.id,
    requesterCoachId: "coach-a",
    requestedStartTime: session.startTime,
    requestedEndTime: session.endTime,
    requester: { userId: "user-a" },
    schedule: session,
  };
  const notifications: unknown[] = [];
  const updates: unknown[] = [];
  let duplicate = false;
  const tx: any = {
    $executeRaw: async () => [],
    coachProfile: {
      findUnique: async ({ where }: any) =>
        where.id === "coach-b"
          ? {
              id: "coach-b",
              userId: "user-b",
              user: { isActive: true },
              specializations: [{ sportId: "yoga" }],
            }
          : { id: "coach-a", userId: "user-a" },
    },
    classSchedule: {
      findFirst: async ({ where }: any) =>
        where.class.facilityId === "facility-a" ? session : null,
    },
    class: { findUnique: async () => session.class },
    room: {
      findUnique: async () => ({
        id: "room-a",
        facilityId: "facility-a",
        capacity: 20,
        areaType: "INDOOR",
        isActive: true,
        capabilities: [],
      }),
    },
    facilityStaff: {
      findMany: async () => [{ userId: "manager-a" }],
      findFirst: async () => ({ userId: "user-b" }),
    },
    leaveRequest: {
      findFirst: async () => null,
      create: async () => {
        throw new Error("Coach changes must never create leave");
      },
    },
    notificationOutbox: {
      create: async ({ data }: any) => {
        notifications.push(data);
        return data;
      },
    },
    coachChangeRequest: {
      findFirst: async ({ where }: any) =>
        where.id
          ? where.facilityId === row.facilityId
            ? row
            : null
          : duplicate
            ? row
            : null,
      create: async ({ data }: any) => ({ id: "request-a", ...data }),
      update: async ({ data }: any) => {
        updates.push(data);
        return { ...row, ...data };
      },
    },
  };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const scope = <T>(callback: () => T) =>
    requestContext.run(
      { facilityId: "facility-a", role: "MANAGER", actorId: "manager-a" },
      callback,
    );
  return {
    session,
    row,
    tx,
    db,
    scope,
    notifications,
    updates,
    setDuplicate: () => {
      duplicate = true;
    },
  };
}

test("coach requests a single future session without creating leave", async () => {
  const f = fixture();
  const result = await f.scope(() =>
    createCoachChange(
      { id: "user-a", role: "COACH" },
      { scheduleId: "session-a", reason: "Cần HLV thay thế" },
      f.db,
    ),
  );
  assert.equal(result.scheduleId, "session-a");
  assert.equal(result.requesterCoachId, "coach-a");
  assert.equal((f.notifications[0] as any).type, "COACH_CHANGE_REQUESTED");
});
test("duplicate, past and someone else's sessions are rejected", async () => {
  const f = fixture();
  const send = () =>
    f.scope(() =>
      createCoachChange(
        { id: "user-a", role: "COACH" },
        { scheduleId: "session-a", reason: "Đổi HLV buổi này" },
        f.db,
      ),
    );
  f.setDuplicate();
  await assert.rejects(send, /đã có yêu cầu/);
  f.session.coachId = "coach-other";
  await assert.rejects(send, /không được phân công/);
  f.session.startTime = new Date("2000-01-01");
  await assert.rejects(send, /sắp diễn ra/);
});
test("approval changes only the requested session and records the manager decision", async () => {
  const f = fixture();
  const changes: unknown[] = [];
  const result = await f.scope(() =>
    decideCoachChange(
      { id: "manager-a", role: "MANAGER" },
      "request-a",
      {
        status: "APPROVED",
        reason: "Đã bố trí HLV phù hợp",
        coachId: "coach-b",
      },
      f.db,
      async (id, body) => {
        changes.push({ id, body });
        return {} as any;
      },
    ),
  );
  assert.deepEqual(changes, [
    {
      id: "session-a",
      body: { coachId: "coach-b", reason: "Đã bố trí HLV phù hợp" },
    },
  ]);
  assert.equal(result.replacementCoachId, "coach-b");
  assert.equal(result.status, "APPROVED");
  assert.equal(f.notifications.length, 2);
});
test("rejection does not change schedules, and approved requests cannot be decided again", async () => {
  const f = fixture();
  let changed = false;
  const change = async () => {
    changed = true;
    return {} as any;
  };
  await f.scope(() =>
    decideCoachChange(
      { id: "manager-a", role: "MANAGER" },
      "request-a",
      { status: "REJECTED", reason: "Chưa có HLV phù hợp" },
      f.db,
      change,
    ),
  );
  assert.equal(changed, false);
  f.row.status = "APPROVED";
  await assert.rejects(
    () =>
      f.scope(() =>
        decideCoachChange(
          { id: "manager-a", role: "MANAGER" },
          "request-a",
          { status: "REJECTED", reason: "Không hợp lệ" },
          f.db,
          change,
        ),
      ),
    /không còn/,
  );
});
test("stale schedules and other-facility requests cannot be approved", async () => {
  const f = fixture();
  f.session.startTime = new Date("2099-01-02T01:00:00Z");
  const send = () =>
    f.scope(() =>
      decideCoachChange(
        { id: "manager-a", role: "MANAGER" },
        "request-a",
        { status: "APPROVED", reason: "Thay HLV", coachId: "coach-b" },
        f.db,
      ),
    );
  await assert.rejects(send, /đã thay đổi/);
  f.row.facilityId = "facility-b";
  await assert.rejects(send, /không còn/);
});
test("coach and admin cannot approve their own scheduling changes", async () => {
  const f = fixture();
  for (const role of ["COACH", "ADMIN", "RECEPTIONIST", "MEMBER"])
    await assert.rejects(
      () =>
        f.scope(() =>
          decideCoachChange(
            { id: "user-a", role },
            "request-a",
            { status: "APPROVED", reason: "Tự duyệt", coachId: "coach-b" },
            f.db,
          ),
        ),
      /Quản lý cơ sở/,
    );
});

test("approval requires a different replacement and does not finalize an unavailable coach", async () => {
  const f = fixture();
  for (const coachId of [undefined, "coach-a"])
    await assert.rejects(
      () =>
        f.scope(() =>
          decideCoachChange(
            { id: "manager-a", role: "MANAGER" },
            "request-a",
            { status: "APPROVED", reason: "Đổi HLV buổi này", coachId },
            f.db,
          ),
        ),
      /chọn huấn luyện viên thay thế/,
    );
  await assert.rejects(
    () =>
      f.scope(() =>
        decideCoachChange(
          { id: "manager-a", role: "MANAGER" },
          "request-a",
          {
            status: "APPROVED",
            reason: "Đổi HLV buổi này",
            coachId: "coach-b",
          },
          f.db,
          async () => {
            throw new Error("Coach already has a class at this time");
          },
        ),
      ),
    /already has a class/,
  );
  assert.equal(f.updates.length, 0);
  assert.equal(f.notifications.length, 0);
});

test("incompatible coach specialization prevents final approval", async () => {
  const f = fixture();
  f.tx.coachProfile.findUnique = async () => ({
    id: "coach-b",
    userId: "user-b",
    user: { isActive: true },
    specializations: [],
  });
  await assert.rejects(
    () =>
      f.scope(() =>
        decideCoachChange(
          { id: "manager-a", role: "MANAGER" },
          "request-a",
          {
            status: "APPROVED",
            reason: "Đổi HLV buổi này",
            coachId: "coach-b",
          },
          f.db,
          async () => ({}) as any,
        ),
      ),
    /COACH_SPECIALIZATION_REQUIRED/,
  );
  assert.equal(f.updates.length, 0);
  assert.equal(f.notifications.length, 0);
});

test("a support coach cannot replace the whole session's lead assignment", () => {
  const f = fixture();
  const session = {
    ...f.session,
    coachId: null,
    class: {
      ...f.session.class,
      coaches: [
        { coachId: "coach-a", isPrimary: true },
        { coachId: "support", isPrimary: false },
      ],
    },
  };
  assert.doesNotThrow(() => assertRequestableSession(session, "coach-a"));
  assert.throws(
    () => assertRequestableSession(session, "support"),
    /không được phân công/,
  );
});
