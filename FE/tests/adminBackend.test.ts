import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: { findById: vi.fn() },
  db: {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    facility: { findUnique: vi.fn(), findMany: vi.fn() },
    facilityStaff: { findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    payment: { groupBy: vi.fn() },
    membershipSubscription: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    classSchedule: { findMany: vi.fn() },
    class: { findUnique: vi.fn(), create: vi.fn() },
    room: { findFirst: vi.fn() },
    sport: { findMany: vi.fn() },
    memberProfile: { findMany: vi.fn() },
  },
}));
vi.mock("../../BE/src/config/prisma.js", () => ({ prisma: mocks.db }));
vi.mock("../../BE/src/models/User.js", () => ({ User: mocks.user }));
vi.mock("../../BE/src/modules/notifications/notifications.service.js", () => ({
  broadcastNotification: vi.fn(),
}));
vi.mock(
  "../../BE/src/modules/enrollments/course-enrollment.service.js",
  () => ({ evaluateCourseEligibility: vi.fn() }),
);
import { requestContext } from "../../BE/src/config/request-context";
import { assignFacilityManager } from "../../BE/src/modules/facilities/facility-manager.service";
import { getFacilityOverview } from "../../BE/src/modules/reports/facility-overview.service";
import {
  createClass,
  getClassRegistrations,
} from "../../BE/src/modules/classes/classes.service";
import { authorizeExact } from "../../BE/src/middlewares/authorize";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(async (fn) => fn(mocks.db));
  mocks.user.findById.mockReturnValue({
    lean: async () => ({ isActive: true, role: "MANAGER" }),
  });
  mocks.db.facility.findUnique.mockResolvedValue({ id: "b", isActive: true });
  mocks.db.facilityStaff.findFirst.mockResolvedValue(null);
  mocks.db.facilityStaff.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.facilityStaff.upsert.mockResolvedValue({ id: "assigned" });
});

describe("facility manager assignment", () => {
  it("rejects an already assigned manager across facilities before removing the old one", async () => {
    mocks.db.facilityStaff.findFirst.mockImplementation(async () => {
      expect(requestContext.getStore()?.facilityId).toBeUndefined();
      return { facilityId: "a" };
    });
    await expect(
      requestContext.run({ facilityId: "b", role: "ADMIN" }, () =>
        assignFacilityManager("b", "new", "old"),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.facilityStaff.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.facilityStaff.upsert).not.toHaveBeenCalled();
  });
  it("checks stale replacement and aborts the new assignment", async () => {
    mocks.db.facilityStaff.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      assignFacilityManager("b", "new", "old"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.facilityStaff.upsert).not.toHaveBeenCalled();
  });
  it("assigns a manager within the target scope and locks both identities", async () => {
    mocks.db.facilityStaff.upsert.mockImplementation(async (args) => {
      expect(requestContext.getStore()?.facilityId).toBe("b");
      expect(args.create.role).toBe("MANAGER");
      return { id: "assigned" };
    });
    await expect(assignFacilityManager("b", "new", "old")).resolves.toEqual({
      id: "assigned",
    });
    expect(mocks.db.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it("rejects receptionist and inactive accounts", async () => {
    for (const user of [
      { role: "RECEPTIONIST", isActive: true },
      { role: "MANAGER", isActive: false },
    ]) {
      mocks.user.findById.mockReturnValue({ lean: async () => user });
      await expect(assignFacilityManager("b", "new")).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});

it("global overview deduplicates members and separates refunds and cancelled bookings", async () => {
  mocks.db.facility.findMany.mockImplementation(async () => {
    expect(requestContext.getStore()?.facilityId).toBeUndefined();
    return [
      { id: "a", name: "A", staffs: [] },
      { id: "b", name: "B", staffs: [] },
    ];
  });
  mocks.db.payment.groupBy
    .mockResolvedValueOnce([
      { facilityId: "a", _sum: { amount: 200 } },
      { facilityId: "b", _sum: { amount: 100 } },
    ])
    .mockResolvedValueOnce([
      { facilityId: "a", _sum: { refundedAmount: 250 } },
    ]);
  mocks.db.membershipSubscription.findMany.mockResolvedValue([
    { facilityId: "a", memberId: "m1" },
    { facilityId: "b", memberId: "m1" },
    { facilityId: "b", memberId: "m2" },
  ]);
  mocks.db.enrollment.findMany.mockResolvedValue([
    { memberId: "m1", status: "BOOKED", class: { facilityId: "a" } },
    { memberId: "m1", status: "CANCELLED", class: { facilityId: "b" } },
  ]);
  mocks.db.classSchedule.findMany.mockResolvedValue([]);
  const result = await requestContext.run(
    { facilityId: "a", role: "ADMIN" },
    () => getFacilityOverview("2026-10-01", "2026-10-08"),
  );
  expect(result).toMatchObject({
    totalMembers: 2,
    totalBookings: 1,
    totalRevenue: 300,
    refundedAmount: 250,
    netRevenue: 50,
  });
  expect(result.facilities[0]).toMatchObject({ members: 1, netRevenue: -50 });
  expect(result.facilities[1]).toMatchObject({
    members: 2,
    cancelledBookings: 1,
  });
});

describe("default room validation", () => {
  it("rejects room area or insufficient capacity before creating a class", async () => {
    mocks.db.sport.findMany.mockResolvedValue([
      { name: "Yoga", areaTypes: ["INDOOR"] },
    ]);
    for (const room of [
      { areaType: "POOL", capacity: 50 },
      { areaType: "INDOOR", capacity: 5 },
      null,
    ]) {
      mocks.db.room.findFirst.mockResolvedValue(room);
      await expect(
        createClass({
          sportIds: ["yoga"],
          areaType: "INDOOR",
          capacity: 10,
          defaultRoomId: "room",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.db.class.create).not.toHaveBeenCalled();
  });
  it("counts each registered member once across sessions", async () => {
    mocks.db.class.findUnique.mockResolvedValue({ id: "c1" });
    mocks.db.classSchedule.findMany.mockResolvedValue([
      { id: "past", status: "COMPLETED" },
      { id: "cancelled", status: "CANCELLED" },
    ]);
    mocks.db.enrollment.findMany.mockResolvedValue(
      ["BOOKED", "COMPLETED", "BOOKED"].map((status) => ({
        memberId: "m1",
        status,
        member: { user: { fullName: "Lan", email: "lan@example.test" } },
      })),
    );
    const result = await getClassRegistrations("c1");
    expect(result).toMatchObject({
      totalMembers: 1,
      totalEnrollments: 3,
      members: [{ bookedSessions: 2, completedSessions: 1 }],
    });
    expect(result.sessions).toHaveLength(2);
  });
});

it("exact role guards deny inherited admin operational access", () => {
  for (const [allowed, denied] of [
    ["RECEPTIONIST", "ADMIN"],
    ["RECEPTIONIST", "MANAGER"],
    ["MANAGER", "ADMIN"],
  ]) {
    const next = vi.fn(),
      res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    authorizeExact(allowed)(
      { user: { role: denied } } as never,
      res as never,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    authorizeExact(allowed)(
      { user: { role: allowed } } as never,
      res as never,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  }
});
