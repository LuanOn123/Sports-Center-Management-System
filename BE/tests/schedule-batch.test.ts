import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_ACCESS_SECRET = "test-only-scheduling-access-secret";
process.env.JWT_REFRESH_SECRET = "test-only-scheduling-refresh-secret";
const { prisma } = require("../src/config/prisma.js");
const { createScheduleBatch, createScheduleBatchInTx } = require("../src/modules/class-schedules/class-schedules.service.js");
const { expandPattern } = require("../src/modules/operations/rules.js");
const { validateResources } = require("../src/modules/operations/scheduling.js");
const { CreateClassSchema } = require("../src/modules/classes/classes.schema.js");
const { CreateUserSchema } = require("../src/modules/users/users.schema.js");

function fixture() {
  const cls = {
    id: "class-a", facilityId: "facility-a", isActive: true, areaType: "INDOOR", capacity: 20,
    sports: [{ id: "gym", requirements: [{ key: "Máy chạy bộ", minimum: 2 }] }],
    coaches: [{ coachId: "primary", isPrimary: true }, { coachId: "support", isPrimary: false }],
  };
  const room = { id: "room-a", facilityId: "facility-a", isActive: true, areaType: "INDOOR", capacity: 30, capabilities: [{ key: "máy chạy bộ", quantity: 2 }] };
  const inserts: any[] = [], conflicts: any[] = [], leaves: any[] = [], checkedCoaches: string[] = [];
  let resourceReads = 0;
  const tx = {
    $executeRaw: async () => 0,
    class: { findUnique: async () => { resourceReads++; return cls; } },
    room: { findUnique: async () => { resourceReads++; return room; } },
    classMember: { findMany: async () => cls.coaches },
    coachProfile: { findUnique: async ({ where }: any) => {
      checkedCoaches.push(where.id);
      return { userId: where.id, user: { isActive: true }, specializations: [{ sportId: "gym" }] };
    } },
    facilityStaff: { findFirst: async () => ({ isActive: true }) },
    leaveRequest: { findFirst: async ({ where }: any) => leaves.find((leave) => leave.coachId === where.coachId && where.OR.some((range: any) => leave.startTime < range.startTime.lt && leave.endTime > range.endTime.gt)) },
    classSchedule: { findMany: async () => conflicts, createMany: async ({ data }: any) => { inserts.push(...data); return { count: data.length }; } },
    // R-07: lịch bắt buộc thuộc một kỳ — fixture có sẵn một kỳ bao trọn tháng 01/2099.
    term: { findFirst: async () => ({ id: "term-2099" }) },
  };
  return { tx, cls, room, inserts, conflicts, leaves, checkedCoaches, reads: () => resourceReads };
}
const session = (day: number) => ({ startTime: `2099-01-${String(day).padStart(2, "0")}T01:00:00Z`, endTime: `2099-01-${String(day).padStart(2, "0")}T03:00:00Z` });

test("bulk insert uses one write and constant resource reads for many sessions", async () => {
  const f = fixture();
  const original = prisma.$transaction;
  prisma.$transaction = async (callback: any) => callback(f.tx);
  try {
    const result = await createScheduleBatch({ classId: "class-a", roomId: "room-a", schedules: Array.from({ length: 28 }, (_, i) => session(i + 1)) });
    assert.equal(result.schedulesCreated, 28);
    assert.equal(f.inserts.length, 28);
    assert.ok(f.inserts.every((row) => row.termId === "term-2099"));
    assert.equal(f.reads(), 4);
    assert.deepEqual(f.checkedCoaches, ["primary", "support"]);
  } finally { prisma.$transaction = original; }
});

test("conflicts reject the entire request before any schedule insert", async () => {
  const f = fixture();
  f.conflicts.push({ startTime: new Date(session(2).startTime), endTime: new Date(session(2).endTime) });
  const original = prisma.$transaction;
  prisma.$transaction = async (callback: any) => callback(f.tx);
  try {
    await assert.rejects(createScheduleBatch({ classId: "class-a", roomId: "room-a", schedules: [session(1), session(2)] }), /trùng giờ/);
    assert.equal(f.inserts.length, 0);
  } finally { prisma.$transaction = original; }
});

test("R-09: conflict error names exactly the clashing sessions", async () => {
  const f = fixture();
  f.conflicts.push({ startTime: new Date(session(2).startTime), endTime: new Date(session(2).endTime) });
  try {
    await createScheduleBatchInTx(f.tx, { classId: "class-a", roomId: "room-a", schedules: [session(1), session(2), session(3)] });
    assert.fail("expected a conflict");
  } catch (err: any) {
    assert.equal(err.statusCode, 409);
    assert.equal(err.errors.code, "SCHEDULE_CONFLICT");
    assert.match(err.message, /ở 1 buổi: 08:00 02\/01\/2099\. /);
    assert.equal(err.errors.conflictingSessions.length, 1);
  }
  assert.equal(f.inserts.length, 0);
});

test("R-09: a long pattern is created with one insert and constant reads", async () => {
  const f = fixture();
  // Mon–Sun for all of 2099-01 … 2099-03 → 90 sessions straight from the pattern expander (Date objects).
  const sessions = expandPattern("2099-01-01", "2099-03-31", [1, 2, 3, 4, 5, 6, 7], 8 * 60, 9 * 60);
  const result = await createScheduleBatchInTx(f.tx, { classId: "class-a", roomId: "room-a", termId: undefined, schedules: sessions });
  assert.equal(result.schedulesCreated, 90);
  assert.equal(f.inserts.length, 90);
  assert.equal(f.reads(), 4);
});

test("overlapping input sessions are rejected before resources are read", async () => {
  const f = fixture();
  const original = prisma.$transaction;
  prisma.$transaction = async (callback: any) => callback(f.tx);
  try {
    await assert.rejects(createScheduleBatch({ classId: "class-a", roomId: "room-a", schedules: [session(1), session(1)] }), /trùng nhau/);
    assert.equal(f.reads(), 0);
    assert.equal(f.inserts.length, 0);
  } finally { prisma.$transaction = original; }
});

test("leave between sessions is allowed; leave during a supporting coach's session is rejected", async () => {
  const f = fixture();
  f.leaves.push({ coachId: "support", startTime: new Date(session(2).startTime), endTime: new Date(session(2).endTime) });
  const original = prisma.$transaction;
  prisma.$transaction = async (callback: any) => callback(f.tx);
  try {
    await createScheduleBatch({ classId: "class-a", roomId: "room-a", schedules: [session(1), session(3)] });
    f.inserts.length = 0;
    await assert.rejects(createScheduleBatch({ classId: "class-a", roomId: "room-a", schedules: [session(1), session(2)] }), /COACH_ON_LEAVE/);
    assert.equal(f.inserts.length, 0);
  } finally { prisma.$transaction = original; }
});

test("live equipment requirements prevent assigning gym to an empty room", async () => {
  const f = fixture();
  f.room.capabilities = [];
  await assert.rejects(validateResources(f.tx, "room-a", "class-a", new Date(session(1).startTime), new Date(session(1).endTime)), /ROOM_CAPABILITY_MISSING/);
});

test("substituting a primary coach retains validation of the supporting coach", async () => {
  const f = fixture();
  await validateResources(f.tx, "room-a", "class-a", new Date(session(1).startTime), new Date(session(1).endTime), "substitute");
  assert.deepEqual(f.checkedCoaches, ["support", "substitute"]);
});

test("new classes cannot contain two subjects, and new coaches require specializations", () => {
  assert.equal(CreateClassSchema.safeParse({ name: "Gym + Yoga", sportIds: ["gym", "yoga"], capacity: 20, areaType: "INDOOR" }).success, false);
  assert.equal(CreateUserSchema.safeParse({ email: "coach@example.com", password: "secret123", fullName: "Coach A", role: "COACH" }).success, false);
  assert.equal(CreateUserSchema.safeParse({ email: "coach@example.com", password: "secret123", fullName: "Coach A", role: "COACH", sportIds: ["gym"] }).success, true);
});

test("automatic free entitlement cannot be edited or deactivated as a retail plan", async () => {
  const { updatePlan, deletePlan } = require("../src/modules/membership-plans/membership-plans.service.js");
  const original = prisma.membershipPlan.findUnique;
  prisma.membershipPlan.findUnique = async () => ({ id: "free", tier: "FREE" });
  try {
    await assert.rejects(updatePlan("free", { price: 1000 }), /không thể chỉnh sửa/);
    await assert.rejects(deletePlan("free"), /không thể ngừng hoạt động/);
  } finally { prisma.membershipPlan.findUnique = original; }
});
