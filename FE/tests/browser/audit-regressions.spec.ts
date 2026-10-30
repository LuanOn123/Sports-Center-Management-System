import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("manager navigation does not carry class search into schedule API", async ({ page }) => {
  await setup(page, "MANAGER");
  const queries: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/class-schedules")) queries.push(url.search);
  });
  await page.goto("/manager/classes");
  await page.getByRole("searchbox").fill("QA-DEMO");
  await page.locator(".sidebar").getByRole("link", { name: "Lịch hoạt động", exact: true }).click();
  await expect.poll(() => queries.length).toBeGreaterThan(0);
  expect(queries.every(query => !new URLSearchParams(query).has("search"))).toBe(true);
});

test("member cancels a queued plan without cancelling the active plan", async ({ page }) => {
  await setup(page, "MEMBER");
  const plan = { id: "plan", name: "Gói thử", price: 300000, durationDays: 30, tier: "MEMBERSHIP" };
  let queued = true;
  const cancellations: string[] = [];
  await page.route("**/api/v1/subscriptions/member/*", route => route.fulfill({ json: {
    success: true, data: [
      { id: "active", status: "ACTIVE", tier: "MEMBERSHIP", startDate: "2020-01-01", endDate: "2099-01-01", plan },
      ...(queued ? [{ id: "queued", status: "SCHEDULED", tier: "MEMBERSHIP", startDate: "2099-01-01", endDate: "2099-02-01", plan }] : []),
    ],
  } }));
  await page.route("**/api/v1/subscriptions/queued/cancel", async route => {
    expect(route.request().method()).toBe("PATCH");
    queued = false;
    cancellations.push(route.request().url());
    await route.fulfill({ json: { success: true, data: { willRefund: true, refundAmount: 300000, daysLeft: 0 } } });
  });
  await page.goto("/member/membership");
  await page.locator(".member-scheduled-plan").getByRole("button", { name: "Hủy gói", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Gói đang dùng được giữ nguyên");
  await dialog.getByRole("button", { name: "Xác nhận hủy gói", exact: true }).click();
  await expect(dialog).toContainText("Đã hủy gói chờ");
  await dialog.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await expect(page.locator(".member-scheduled-plan")).toHaveCount(0);
  expect(cancellations).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Hủy gói", exact: true })).toBeVisible();
});

