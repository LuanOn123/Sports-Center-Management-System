import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";
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
