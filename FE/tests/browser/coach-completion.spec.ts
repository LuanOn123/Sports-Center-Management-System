import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const ended of [true, false]) {
  test(`coach completion requires an ended session: ${ended}`, async ({ page }) => {
    await setup(page, "COACH");
    await page.route("**/api/v1/auth/me", route => route.fulfill({ json: { success: true, data: {
      id: "coach-user", fullName: "HLV demo", role: "COACH", isActive: true, coachProfile: { id: "coach-a" },
    } } }));
    let completed = false;
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + (ended ? -60000 : 3600000)).toISOString();
    await page.route(/\/api\/v1\/class-schedules(?:\?|$)/, route => route.fulfill({ json: { success: true, data: [
      { id: "session-complete", classId: "class-a", startTime: start, endTime: end, status: completed ? "COMPLETED" : "SCHEDULED", class: { id: "class-a", name: "HIIT demo" }, room: { name: "Phòng HIIT" } },
    ] } }));
    await page.route("**/api/v1/class-schedules/session-complete/complete", route => {
      expect(route.request().method()).toBe("PATCH"); completed = true;
      return route.fulfill({ json: { success: true, data: { status: "COMPLETED" } } });
    });
    await page.goto("/coach/schedule");
    await page.locator(".coach-session").filter({ hasText: "HIIT demo" }).first().click();
    const dialog = page.getByRole("dialog");
    const checkbox = dialog.getByRole("checkbox", { name: "Đã hoàn thành", exact: true });
    if (!ended) { await expect(checkbox).toBeDisabled(); return; }
    await checkbox.check();
    expect(completed).toBe(false);
    await dialog.getByRole("button", { name: "Xác nhận hoàn thành", exact: true }).click();
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
    await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(page.locator(".coach-session").filter({ hasText: "HIIT demo" }).first()).toContainText("Hoàn thành");
  });
}
