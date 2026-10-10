import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  tx: { $executeRaw: vi.fn() },
  notify: vi.fn(),
  enrollment: { findMany: vi.fn() },
  attendance: { findMany: vi.fn() },
  notification: { findMany: vi.fn() },
  issue: { findMany: vi.fn() },
  membershipSubscription: { findFirst: vi.fn() },
  coverage: vi.fn(),
  facility: vi.fn(),
}));
vi.mock("../../BE/src/config/prisma.js", () => ({ prisma: mocks }));
vi.mock("../../BE/src/middlewares/facilityScope.js", () => ({
  getStaffFacilityId: mocks.facility,
}));
vi.mock(
  "../../BE/src/modules/attendance/attendance-analytics.service.js",
  () => ({
    getMembershipCoverageIntervals: mocks.coverage,
    isCoveredAt: (intervals: { start: Date; end: Date }[], at: Date) =>
      intervals.some((i) => i.start <= at && at <= i.end),
  }),
);
vi.mock("../../BE/src/modules/notifications/notifications.service.js", () => ({
  createNotification: mocks.notify,
}));
import {
  attendanceSummary,
  getReceptionAttendanceDetail,
  getReceptionAttendanceMonitoring,
  sendReceptionAttendanceWarning,
} from "../../BE/src/modules/attendance/reception-attendance.service";

const staff = { id: "reception-a", role: "RECEPTIONIST" };
const at = (day: number) =>
  new Date(`2026-01-${String(day).padStart(2, "0")}T10:00:00Z`);
function enrollment(id: string, day: number, bookedAt = at(1)) {
  return {
    id,
    memberId: "member-a",
    classId: "class-a",
    scheduleId: id,
    status: "COMPLETED",
    bookedAt,
    class: { id: "class-a", name: "Yoga A", facilityId: "facility-a" },
    member: {
      id: "member-a",
      userId: "user-a",
      user: { fullName: "Hội viên A", email: "a@test.invalid", phone: null },
    },
    schedule: {
      id,
      startTime: at(day),
      endTime: new Date(+at(day) + 3600000),
      room: { name: "Phòng A" },
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.facility.mockResolvedValue("facility-a");
  mocks.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.notify.mockResolvedValue({ createdAt: at(10) });
  mocks.enrollment.findMany.mockResolvedValue([]);
  mocks.attendance.findMany.mockResolvedValue([]);
  mocks.notification.findMany.mockResolvedValue([]);
  mocks.issue.findMany.mockResolvedValue([]);
  mocks.membershipSubscription.findFirst.mockResolvedValue(null);
  mocks.coverage.mockResolvedValue(
    new Map([["member-a", [{ start: at(2), end: at(20) }]]]),
  );
});

describe("Reception attendance policy", () => {
  it.each([
    [1, 10, "NORMAL"],
    [2, 10, "WARNING"],
    [3, 10, "VIOLATION"],
    [0, 0, "NORMAL"],
  ])(
    "classifies %i absences in %i relevant sessions as %s",
    (absent, total, status) => {
      expect(
        attendanceSummary(
          Array.from({ length: Number(total) }, (_, i) => ({
            state: i < Number(absent) ? "ABSENT" : "PRESENT",
          })),
        ).status,
      ).toBe(status);
    },
  );
  it("separates late, excused, pending and upcoming without inventing absences", () => {
    expect(
      attendanceSummary(
        ["PRESENT", "LATE", "EXCUSED", "NOT_RECORDED", "UPCOMING"].map(
          (state) => ({ state }),
        ),
      ),
    ).toMatchObject({
      attendedCount: 2,
      absentCount: 0,
      totalRelevantClassSessions: 4,
      excusedCount: 1,
      unrecordedCount: 1,
      upcomingCount: 1,
    });
  });
  it("does not promote a rounded percentage across the 30% boundary", () => {
    const result = attendanceSummary(
      Array.from({ length: 10001 }, (_, i) => ({
        state: i < 3000 ? "ABSENT" : "PRESENT",
      })),
    );
    expect(result.absenceRate).toBe(30);
    expect(result.status).toBe("WARNING");
  });
  it("counts only own enrolled sessions covered by membership at class time", async () => {
    mocks.enrollment.findMany.mockResolvedValue([
      enrollment("present", 3),
      enrollment("absent", 4),
      enrollment("pending", 5),
      enrollment("before-coverage", 1),
      enrollment("late-booking", 6, at(7)),
      enrollment("expired", 21),
    ]);
    mocks.attendance.findMany.mockResolvedValue([
      { memberId: "member-a", scheduleId: "present", status: "PRESENT" },
      { memberId: "member-a", scheduleId: "absent", status: "ABSENT" },
    ]);
    const result = await getReceptionAttendanceDetail(staff, {
      memberId: "member-a",
      classId: "class-a",
    });
    expect(result.sessions.map((s) => s.scheduleId)).toEqual([
      "present",
      "absent",
      "pending",
    ]);
    expect(result.summary).toMatchObject({
      attendedCount: 1,
      absentCount: 1,
      unrecordedCount: 1,
      totalRelevantClassSessions: 3,
    });
    expect(mocks.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          class: { facilityId: "facility-a" },
          memberId: "member-a",
          classId: "class-a",
          status: { in: ["BOOKED", "COMPLETED"] },
          schedule: { status: { not: "CANCELLED" } },
        }),
      }),
    );
  });
  it("rejects detail without an actual enrollment in the assigned facility", async () => {
    await expect(
      getReceptionAttendanceDetail(staff, {
        memberId: "foreign-member",
        classId: "class-a",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it("takes the warning advisory lock on the transaction client", async () => {
    mocks.enrollment.findMany.mockResolvedValue([enrollment("absent", 4)]);
    mocks.attendance.findMany.mockResolvedValue([
      { memberId: "member-a", scheduleId: "absent", status: "ABSENT" },
    ]);
    const result = await sendReceptionAttendanceWarning(staff, {
      memberId: "member-a",
      classId: "class-a",
    });
    expect(result.alreadySent).toBe(false);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledWith(
      expect.anything(),
      "reception-attendance:facility-a:member-a:class-a",
    );
    expect(mocks.notify).toHaveBeenCalledOnce();
  });
  it("returns an existing warning without writing another notification", async () => {
    mocks.enrollment.findMany.mockResolvedValue([enrollment("absent", 4)]);
    mocks.attendance.findMany.mockResolvedValue([
      { memberId: "member-a", scheduleId: "absent", status: "ABSENT" },
    ]);
    mocks.notification.findMany.mockResolvedValue([
      {
        id: "warning-a",
        userId: "user-a",
        metadata: { classId: "class-a", facilityId: "facility-a" },
        title: "Warning",
        body: "Existing warning",
        createdAt: at(10),
      },
    ]);
    expect(
      (
        await sendReceptionAttendanceWarning(staff, {
          memberId: "member-a",
          classId: "class-a",
        })
      ).alreadySent,
    ).toBe(true);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("validates filters and pagination instead of returning server errors", async () => {
    await expect(
      getReceptionAttendanceMonitoring(staff, { status: "INVALID" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      getReceptionAttendanceMonitoring(staff, { page: 0 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await getReceptionAttendanceMonitoring(staff, {})).items).toEqual(
      [],
    );
  });
});
