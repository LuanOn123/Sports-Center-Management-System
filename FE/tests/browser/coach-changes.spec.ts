import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

const session = {
  id: "session-a",
  startTime: "2099-01-01T01:00:00Z",
  endTime: "2099-01-01T02:00:00Z",
  class: { name: "Yoga buổi sáng" },
  room: { name: "Phòng A" },
};
const request = {
  id: "request-a",
  status: "PENDING",
  reason: "Cần bố trí người thay thế",
  requestedStartTime: session.startTime,
  requestedEndTime: session.endTime,
  schedule: session,
  requester: { user: { fullName: "Coach An" } },
};

for (const width of [390, 1440]) {
  test(`coach requests one assigned session rather than date-range leave at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "COACH");
    let saved: Record<string, unknown> | null = null;
    await page.route("**/api/v1/coach-change-requests", (route) => {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { success: true, data: request } });
      }
      return route.fulfill({
        json: { success: true, data: saved ? [request] : [] },
      });
    });
    await page.route("**/api/v1/coach-change-requests/sessions", (route) =>
      route.fulfill({ json: { success: true, data: [session] } }),
    );
    const legacy: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/leave-requests") && req.method() === "POST")
        legacy.push(req.url());
    });
    await page.goto("/coach/leave");
    await expect(page).toHaveURL(/\/coach\/coach-changes$/);
    await page.getByRole("button", { name: "Tạo yêu cầu đổi HLV" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Yêu cầu đổi huấn luyện viên",
    });
    await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
    await dialog.getByLabel("Buổi học cần đổi HLV").selectOption("session-a");
    await dialog
      .getByLabel("Lý do đề nghị đổi HLV")
      .fill("Cần bố trí người thay thế");
    expect(
      (
        await new AxeBuilder({ page })
          .include(".coach-change-form")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/coach-change-form-${width}.png` });
    await dialog
      .getByRole("button", { name: "Gửi yêu cầu", exact: true })
      .click();
    await expect
      .poll(() => saved)
      .toEqual({
        scheduleId: "session-a",
        reason: "Cần bố trí người thay thế",
      });
    await expect(dialog).toHaveCount(0);
    expect(legacy).toEqual([]);
    await expect(
      page.getByRole("heading", { name: "Yoga buổi sáng" }),
    ).toBeVisible();
  });
}

for (const action of ["APPROVED", "REJECTED"]) {
  test(`manager ${action} changes only the selected session`, async ({
    page,
  }) => {
    await setup(page, "MANAGER");
    await page.route("**/api/v1/coach-change-requests", (route) =>
      route.fulfill({ json: { success: true, data: [request] } }),
    );
    await page.route(
      "**/api/v1/coach-change-requests/request-a/candidates",
      (route) =>
        route.fulfill({
          json: {
            success: true,
            data: [{ id: "coach-b", fullName: "Coach Bình" }],
          },
        }),
    );
    let saved: Record<string, unknown> | null = null;
    await page.route("**/api/v1/coach-change-requests/request-a", (route) => {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { success: true, data: request } });
    });
    await page.goto("/manager/coach-changes");
    await page.getByRole("button", { name: "Xem xét yêu cầu" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Xem xét đổi huấn luyện viên",
    });
    await dialog.getByLabel("Kết quả xử lý").selectOption(action);
    if (action === "APPROVED")
      await dialog
        .getByLabel("Huấn luyện viên thay thế")
        .selectOption("coach-b");
    await dialog
      .getByLabel("Phản hồi cho huấn luyện viên")
      .fill("Đã kiểm tra và xử lý");
    await dialog
      .getByRole("button", {
        name: action === "APPROVED" ? "Duyệt & đổi HLV" : "Xác nhận từ chối",
        exact: true,
      })
      .click();
    await expect
      .poll(() => saved)
      .toEqual({
        status: action,
        reason: "Đã kiểm tra và xử lý",
        ...(action === "APPROVED" ? { coachId: "coach-b" } : {}),
      });
    await expect(dialog).toHaveCount(0);
  });
}

test("admin follows coach changes without a schedule approval action", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.route("**/api/v1/coach-change-requests", (route) =>
    route.fulfill({ json: { success: true, data: [request] } }),
  );
  await page.goto("/admin/coach-changes");
  await expect(
    page.getByRole("heading", { name: "Yoga buổi sáng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xem xét yêu cầu" }),
  ).toHaveCount(0);
});
