import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

for (const scenario of ["allows registration with the approved exception", "keeps other backend blockers", "opens at the scheduled time"] as const) {
  test(`term membership preview ${scenario}`, async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    const scheduled = scenario === "opens at the scheduled time";
    const opensAt = "2027-01-15T02:45:00Z";
    let eligible = scenario === "allows registration with the approved exception";
    let booked = false;
    if (scheduled) await page.clock.install({ time: new Date("2027-01-15T02:44:50Z") });
    const writes: unknown[] = [];
    await page.route("**/api/v1/classes/c1/course-plan", async (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            course: {
              classId: "c1",
              className: "Yoga học kỳ 1",
              description: "",
              classType: "REGULAR",
              areaType: "INDOOR",
              capacity: 10,
              sports: [{ id: "yoga", name: "Yoga" }],
              totalSessions: 1,
              firstSessionStart: "2099-10-01T11:00:00Z",
              lastSessionStart: "2099-10-01T11:00:00Z",
              lastSessionEnd: "2099-10-01T12:00:00Z",
              weekdays: [4],
              weekdayLabels: ["Thứ 5"],
              timeSlots: [],
              rooms: [],
              slots: [],
              term: scheduled ? {
                id: "term-1",
                name: "Học kỳ 1",
                status: "PLANNING",
                registrationStartDate: opensAt,
                registrationEndDate: "2027-01-15T16:59:59Z",
              } : undefined,
              availability: {
                minRemainingSlots: 5,
                fullSessionCount: 0,
                isFullyBookable: true,
              },
            },
            sessions: [
              {
                id: "session-1",
                termId: "term-1",
                startTime: "2099-10-01T11:00:00Z",
                endTime: "2099-10-01T12:00:00Z",
                status: "SCHEDULED",
                room: { name: "Phòng Yoga" },
                bookedCount: 5,
                remainingSlots: 5,
                isFull: false,
                isBookable: true,
                canBook: true,
                myEnrollmentStatus: booked ? "BOOKED" : null,
              },
            ],
            registration: {
              eligible,
              blockers: eligible
                ? []
                : scheduled ? [{
                    code: "TERM_REGISTRATION_NOT_STARTED",
                    message: "Chưa đến giờ mở đăng ký.",
                    details: { registrationStartDate: opensAt },
                  }] : [
                    {
                      code: "PREMIUM_REQUIRED",
                      message: "Khóa học Premium yêu cầu gói tập hạng PREMIUM.",
                    },
                  ],
              membershipCoverage: {
                policy: "HALF_REMAINING_TERM_V1",
                qualifiedAt: "2099-06-01T00:00:00Z",
                validUntil: "2099-12-31T00:00:00Z",
                subscriptionEndDate: "2099-08-30T00:00:00Z",
              },
              subscription: {
                tier: "MEMBERSHIP",
                endDate: "2099-08-30T00:00:00Z",
                planName: "180 ngày",
              },
              quota: {
                tier: "MEMBERSHIP",
                limit: 3,
                used: 0,
                remaining: 3,
                classes: [],
              },
              penalty: null,
              registeredSessions: booked ? 1 : 0,
              remainingSessionsToRegister: booked ? 0 : 1,
              isFullyRegistered: booked,
            },
          },
        },
      }),
    );
    await page.route("**/api/v1/enrollments/bulk", async (route) => {
      writes.push(route.request().postDataJSON());
      booked = true;
      return route.fulfill({
        json: {
          success: true,
          data: {
            classId: "c1",
            className: "Yoga học kỳ 1",
            summary: {
              totalSessions: 1,
              enrolledNow: 1,
              alreadyBooked: 0,
              totalRegistered: 1,
              firstSessionStart: "2099-10-01T11:00:00Z",
              lastSessionEnd: "2099-10-01T12:00:00Z",
            },
            sessions: [],
            quota: { limit: 3, used: 1, remaining: 2 },
          },
        },
      });
    });
    let cancellation: unknown;
    await page.route("**/api/v1/enrollments/courses/c1/cancel", async (route) => {
      cancellation = route.request().postDataJSON();
      booked = false;
      return route.fulfill({ json: { success: true, data: { cancelledSessions: 1, cancelledWaitlist: 0 } } });
    });
    await page.route("**/api/v1/classes/class-yoga-001/training-plans", (route) =>
      route.fulfill({ json: { success: true, data: { plans: booked ? [{ id: "plan-1", memberId: null, title: "Yoga căn bản", instructions: "Khởi động 5 phút" }] : [] } } }),
    );
    await page.goto("/member/classes/c1");
    await expect(
      page.getByText("Đủ điều kiện thời hạn cho trọn kỳ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Ngày hết hạn gói không thay đổi/),
    ).toBeVisible();
    const enroll = page.getByRole("button", { name: /Đăng ký trọn khóa/ });
    if (scheduled) {
      await expect(page.getByRole("button", { name: "Chưa mở đăng ký", exact: true })).toBeDisabled();
      eligible = true;
      await page.clock.fastForward(12_000);
      await expect(enroll).toBeEnabled();
      return;
    }
    if (!eligible) {
      await expect(
        page.getByText("Khóa học Premium yêu cầu gói tập hạng PREMIUM."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Chưa thể đăng ký", exact: true }),
      ).toBeDisabled();
      expect(writes).toEqual([]);
    } else {
      await expect(enroll).toBeEnabled();
      await enroll.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Xác nhận đăng ký/ })
        .click();
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0]).toMatchObject({ classId: "c1" });
      expect(writes[0]).not.toHaveProperty("membershipCoverage");
      await expect(page.getByRole("heading", { name: "Yoga căn bản" })).toBeVisible();
      await page.getByRole("button", { name: "Hủy đăng ký toàn khóa", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Xác nhận hủy toàn khóa" }).click();
      await expect(page.getByText("Đã hủy 1 buổi còn lại của khóa.")).toBeVisible();
      expect(cancellation).toEqual({ termId: "term-1" });
    }
  });
}
