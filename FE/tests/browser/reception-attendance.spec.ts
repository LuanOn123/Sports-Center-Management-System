import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

async function reception(page: Page) {
  await setup(page);
  const writes: string[] = [];
  let warned = false;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    const row = {
      memberId: "member-a",
      memberName: "Nguyễn An",
      memberEmail: "an@test.invalid",
      classId: "class-a",
      className: "Yoga buổi sáng",
      attendedCount: 4,
      absentCount: 3,
      excusedCount: 1,
      unrecordedCount: 1,
      upcomingCount: 2,
      totalRelevantClassSessions: 10,
      absenceRate: 30,
      status: "VIOLATION",
      warningSent: warned,
      reportStatus: null,
    };
    let data: unknown;
    if (path === "/members")
      data = [
        {
          id: "member-a",
          user: { fullName: "Nguyễn An", email: "an@test.invalid" },
        },
      ];
    else if (path === "/members/member-a")
      data = {
        id: "member-a",
        user: { fullName: "Nguyễn An", email: "an@test.invalid" },
      };
    else if (path === "/classes")
      data = [{ id: "class-a", name: "Yoga buổi sáng" }];
    else if (path === "/attendance/monitoring") {
      expect(url.searchParams.get("memberId")).toBe("member-a");
      data = url.searchParams.get("status") === "NORMAL" ? [] : [row];
    } else if (path === "/attendance/monitoring/detail") {
      expect(url.searchParams.get("memberId")).toBe("member-a");
      expect(url.searchParams.get("classId")).toBe("class-a");
      data = {
        member: {
          fullName: row.memberName,
          email: row.memberEmail,
          subscription: null,
        },
        class: { name: row.className },
        summary: row,
        sessions: [
          {
            enrollmentId: "e1",
            startTime: "2026-10-01T08:00:00Z",
            endTime: "2026-10-01T09:00:00Z",
            roomName: "Phòng Yoga",
            state: "NOT_RECORDED",
            note: null,
          },
          {
            enrollmentId: "e2",
            startTime: "2026-10-02T08:00:00Z",
            endTime: "2026-10-02T09:00:00Z",
            roomName: "Phòng Yoga",
            state: "ABSENT",
            note: "SYSTEM_NO_SHOW",
          },
        ],
        warnings: [],
        reports: [],
      };
    } else if (path === "/attendance/warnings/send") {
      writes.push(path);
      expect(req.postDataJSON()).toEqual({
        memberId: "member-a",
        classId: "class-a",
      });
      warned = true;
      data = { message: "Đã gửi cảnh báo chuyên cần" };
    } else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/receptionist/members");
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await page
    .getByRole("button", { name: "Xem điểm danh", exact: true })
    .click();
  return { writes };
}

test("Members attendance shows own class totals, details and recoverable filters", async ({
  page,
}) => {
  const { writes } = await reception(page);
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("cell", { name: "4 buổi", exact: true }),
  ).toBeVisible();
  await modal.screenshot({ path: "artifacts/reception-attendance.png" });
  await expect(
    modal.getByText("Yoga buổi sáng", { exact: false }).last(),
  ).toBeVisible();
  await modal
    .getByRole("combobox", { name: "Trạng thái chuyên cần" })
    .selectOption("NORMAL");
  await expect(
    modal.getByText("Không có kết quả phù hợp với bộ lọc."),
  ).toBeVisible();
  await modal
    .getByRole("combobox", { name: "Trạng thái chuyên cần" })
    .selectOption("");
  await modal.getByRole("button", { name: "Xem chi tiết" }).click();
  await expect(
    modal.getByRole("heading", { name: "Nguyễn An · Yoga buổi sáng" }),
  ).toBeVisible();
  await expect(
    modal.getByRole("cell", { name: "Chưa ghi nhận", exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByText("Ghi nhận vắng khi hoàn tất buổi học"),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xem điểm danh", exact: true }),
  ).toBeFocused();
});

test("sending a warning requires explicit confirmation and disables repeat sends", async ({
  page,
}) => {
  const { writes } = await reception(page);
  const modal = page.getByRole("dialog");
  await modal
    .getByRole("button", { name: "Gửi cảnh báo", exact: true })
    .click();
  expect(writes).toEqual([]);
  await modal.getByRole("button", { name: "Xác nhận gửi" }).click();
  await expect(
    modal.getByRole("button", { name: "Đã gửi cảnh báo", exact: true }),
  ).toBeDisabled();
  expect(writes).toEqual(["/attendance/warnings/send"]);
});

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`attendance modal supports ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await reception(page);
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Xem chi tiết" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const violations = (
      await new AxeBuilder({ page }).include("dialog").analyze()
    ).violations;
    expect(violations).toEqual([]);
  });
}

test("Manager reviews the attendance report through the dedicated endpoint", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  let decision: unknown;
  let status = "OPEN";
  await page.route("**/api/v1/issues", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "report-a",
            title: "Vi phạm chuyên cần: Nguyễn An",
            status,
            requester: {
              id: "reception-a",
              fullName: "Lễ tân Mai",
              role: "RECEPTIONIST",
            },
            description: JSON.stringify({
              type: "ATTENDANCE_VIOLATION",
              memberId: "member-a",
              classId: "class-a",
              memberName: "Nguyễn An",
              className: "Yoga buổi sáng",
              attendedCount: 4,
              absentCount: 3,
              totalSessions: 10,
              absenceRate: 30,
              reason: "Cần đối chiếu lịch sử chuyên cần",
            }),
          },
        ],
      },
    }),
  );
  await page.route(
    "**/api/v1/attendance/reports/report-a/review",
    async (route) => {
      decision = route.request().postDataJSON();
      status = "RESOLVED";
      await route.fulfill({
        json: { success: true, data: { decision: "APPROVE_REMOVAL" } },
      });
    },
  );
  await page.goto("/manager/issues");
  await expect(
    page.getByText("Lý do báo cáo: Cần đối chiếu lịch sử chuyên cần"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Phản hồi", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Quyết định chuyên cần")
    .selectOption("APPROVE_REMOVAL");
  await page
    .getByLabel("Lý do quyết định")
    .fill("Đã đối chiếu dữ liệu với lễ tân");
  await page.getByRole("button", { name: "Xác nhận quyết định" }).click();
  await expect(page.getByLabel("Quyết định chuyên cần")).toHaveCount(0);
  expect(decision).toEqual({
    decision: "APPROVE_REMOVAL",
    response: "Đã đối chiếu dữ liệu với lễ tân",
  });
});
