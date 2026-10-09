import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function flowFixture(page: Page, role = "MEMBER") {
  await setup(page, role);
  const calls: { path: string; body: unknown; facility: string | undefined }[] =
    [];
  let waiting = true;
  let checkedIn = false;
  const visit = {
    id: "v1",
    checkInAt: "2026-10-08T03:00:00Z",
    method: "QR",
    facility: { name: "Cơ sở A" },
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (path === "/facility-visits/check-in") {
      checkedIn = true;
      data = visit;
    } else if (path === "/facility-visits/my") data = checkedIn ? [visit] : [];
    else if (path === "/waitlist/my")
      data = [
        {
          id: "w1",
          scheduleId: "s1",
          position: 2,
          status: waiting ? "WAITING" : "CANCELLED",
          schedule: {
            startTime: "2099-10-08T03:00:00Z",
            class: { name: "Yoga sáng" },
          },
        },
      ];
    else if (path === "/waitlist/w1" && request.method() === "DELETE") {
      waiting = false;
      data = {};
    } else if (path === "/attendance/my") data = [];
    else if (path === "/attendance/my/summary")
      data = {
        thresholds: {},
        penalties: [],
        buckets: [
          {
            classId: "c1",
            className: "Khóa Yoga cố định",
            policy: "FIXED",
            totalPlannedSessions: 10,
            sampleSize: 3,
            currentAbsences: 2,
            allowedAbsences: 2,
            remainingAbsences: 0,
            status: "NOTICE",
            attendanceRate: 33.33,
            presentCount: 1,
            lateCount: 0,
            absentCount: 2,
            noShowCount: 0,
            excusedCount: 0,
          },
          {
            classId: "c2",
            className: "Lớp Yoga định kỳ",
            policy: "RECURRING",
            sampleSize: 5,
            status: "WARNING",
            attendanceRate: 60,
            presentCount: 3,
            lateCount: 0,
            absentCount: 2,
            noShowCount: 0,
            excusedCount: 0,
          },
        ],
      };
    else if (path === "/attendance/penalties") data = [];
    else if (path === "/attendance/penalties/preview")
      data = {
        items: [
          {
            memberId: "m1",
            memberName: "Minh Anh",
            classId: "c1",
            className: "Yoga sáng",
            attendanceRate: 60,
            sampleSize: 5,
            futureBookedEnrollmentCount: 2,
            reason: "Vắng vượt số buổi cho phép",
          },
        ],
      };
    else if (path === "/attendance/penalties/apply") data = {};
    else return route.fallback();
    if (request.method() !== "GET")
      calls.push({
        path,
        body: request.postData() ? request.postDataJSON() : null,
        facility: request.headers()["x-facility-id"],
      });
    await route.fulfill({
      json: {
        success: true,
        data,
        ...(Array.isArray(data)
          ? {
              pagination: {
                page: 1,
                totalPages: 1,
                total: data.length,
                limit: 100,
              },
            }
          : {}),
      },
    });
  });
  return calls;
}

test("member check-in sends the selected facility and refreshes global visit history", async ({
  page,
}) => {
  const calls = await flowFixture(page);
  await page.goto("/member/checkin");
  await expect(page.getByText("Chưa có lượt vào cửa.")).toBeVisible();
  await page
    .getByRole("button", { name: "Check-in vào cơ sở", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Đã ghi nhận lượt vào cửa",
  );
  await expect(
    page.getByRole("heading", { name: "Lịch sử vào cửa trên mọi cơ sở" }),
  ).toBeVisible();
  expect(calls).toEqual([
    {
      path: "/facility-visits/check-in",
      body: { method: "QR" },
      facility: "facility-a",
    },
  ]);
});

test("member leaves only their waiting entry and sees its terminal status", async ({
  page,
}) => {
  const calls = await flowFixture(page);
  await page.goto("/member/waitlist");
  await page.getByRole("button", { name: "Rời danh sách chờ" }).click();
  await expect(page.getByText(/Thứ tự 2 · Đã rời danh sách/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rời danh sách chờ" }),
  ).toHaveCount(0);
  expect(calls[0]).toEqual({
    path: "/waitlist/w1",
    body: null,
    facility: "facility-a",
  });
});

test("attendance uses new advisory states and fixed absence allowance", async ({
  page,
}) => {
  await flowFixture(page);
  await page.goto("/member/attendance");
  await expect(page.getByText("Nhắc nhở", { exact: true })).toBeVisible();
  await expect(page.getByText("Cảnh báo", { exact: true })).toBeVisible();
  await expect(page.getByText(/Khóa 10 buổi · đã vắng 2\/2/)).toBeVisible();
  await expect(
    page.getByText(/quyết định hạn chế đặt lớp do quản lý áp dụng riêng/),
  ).toBeVisible();
});

test("obsolete Manager penalty screen redirects without applying penalties", async ({
  page,
}) => {
  const calls = await flowFixture(page, "MANAGER");
  await page.goto("/manager/attendance-rules");
  await expect(page).toHaveURL(/\/manager\/classes$/);
  await expect(page.getByRole("heading", { name: "Lớp học", exact: true })).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith("/apply"))).toHaveLength(0);
});

test("full future session offers schedule-specific waitlist registration", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  const submitted: unknown[] = [];
  await page.route("**/api/v1/classes/c1/course-plan", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          course: {
            classId: "c1",
            className: "Yoga sáng",
            capacity: 10,
            totalSessions: 1,
            firstSessionStart: "2099-10-08T03:00:00Z",
            lastSessionStart: "2099-10-08T03:00:00Z",
            lastSessionEnd: "2099-10-08T04:00:00Z",
            slots: [],
            availability: {
              minRemainingSlots: 0,
              fullSessionCount: 1,
              isFullyBookable: false,
            },
          },
          sessions: [
            {
              id: "s1",
              status: "SCHEDULED",
              startTime: "2099-10-08T03:00:00Z",
              endTime: "2099-10-08T04:00:00Z",
              weekdayLabel: "Thứ 5",
              timeLabel: "10:00–11:00",
              room: { name: "Phòng A" },
              isFull: true,
              myEnrollmentStatus: null,
              remainingSlots: 0,
            },
          ],
          registration: {
            eligible: false,
            blockers: [{ code: "CLASS_FULL", message: "Buổi học đã đầy" }],
            registeredSessions: 0,
            remainingSessionsToRegister: 1,
          },
        },
      },
    }),
  );
  await page.route("**/api/v1/waitlist", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({
      json: { success: true, data: { id: "w1", position: 3 } },
    });
  });
  await page.goto("/member/classes/c1");
  await page.getByText(/Xem.*buổi|Chi tiết.*buổi/).click();
  await page.getByRole("button", { name: "Vào danh sách chờ" }).click();
  await expect(
    page.getByRole("button", { name: "Đã vào danh sách chờ · thứ tự 3" }),
  ).toBeDisabled();
  expect(submitted).toEqual([{ scheduleId: "s1" }]);
});

test("Manager revenue page does not query cross-facility usage or attendance reports", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  const origins: string[] = [];
  await page.route(
    "**/api/v1/reports/cross-facility-usage?*",
    async (route) => {
      origins.push(route.request().headers()["x-facility-id"]);
      await route.fulfill({
        json: {
          success: true,
          data: {
            originFacilityName: "Cơ sở A",
            totalBookings: 4,
            totalVisits: 2,
            totalUniqueMembers: 3,
            usage: [
              {
                usageFacilityId: "facility-b",
                usageFacilityName: "Cơ sở B",
                bookings: 4,
                visits: 2,
                uniqueMembers: 3,
              },
            ],
          },
        },
      });
    },
  );
  await page.route("**/api/v1/reports/attendance?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          summary: { total: 3, normal: 1, notice: 1, warning: 1 },
          rows: [
            {
              memberId: "m1",
              memberName: "Minh Anh",
              classId: "c1",
              className: "Yoga",
              status: "WARNING",
              policy: "FIXED",
              sampleSize: 5,
              currentAbsences: 3,
              allowedAbsences: 2,
            },
          ],
        },
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    }),
  );
  await page.goto("/manager/reports");
  await expect(
    page.getByRole("heading", { name: "Báo cáo doanh thu", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sử dụng liên cơ sở" })).toHaveCount(0);
  await expect(page.getByLabel("Trạng thái chuyên cần")).toHaveCount(0);
  expect(origins).toEqual([]);
});
