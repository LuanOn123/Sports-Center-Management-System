import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("profile menu holds personal actions and editing is explicit", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  await page.goto("/member/profile");
  const sidebar = page.locator(".sidebar nav");
  await expect(sidebar.getByRole("link")).toHaveText([
    "Tổng quan hội viên",
    "Lịch tập",
    "Lớp của tôi",
    "Khám phá lớp học",
    "Gói thành viên",
    "Danh sách chờ",
    "Chính sách sử dụng",
  ]);
  await expect(
    page.getByRole("region", { name: "Cập nhật ảnh đại diện" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Cập nhật ảnh đại diện" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hủy chỉnh sửa", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Cập nhật ảnh đại diện" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Menu hồ sơ của/ }).click();
  const menu = page.getByRole("navigation", {
    name: "Menu hồ sơ",
    exact: true,
  });
  await menu.getByRole("link", { name: "Thanh toán & hóa đơn" }).click();
  await expect(page).toHaveURL(/\/member\/payments$/);
  await page.getByRole("button", { name: /Menu hồ sơ của/ }).click();
  await menu.getByRole("link", { name: "Yêu cầu hỗ trợ" }).click();
  await expect(page).toHaveURL(/\/member\/support$/);
});

test("hover opens a radial menu and facility check-in works in place", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  await page.route("**/api/v1/facility-visits/my*", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route("**/api/v1/facility-visits/check-in", (route) => {
    expect(route.request().method()).toBe("POST");
    return route.fulfill({
      json: {
        success: true,
        data: {
          id: "visit-1",
          checkInAt: new Date().toISOString(),
          method: "QR",
        },
      },
    });
  });
  await page.goto("/member/membership");
  const trigger = page.locator(".pulse-quick-trigger");
  await trigger.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const actions = page.locator(".pulse-quick-action:visible");
  await expect(actions).toHaveCount(4);
  const first = await actions.nth(0).boundingBox();
  const last = await actions.nth(3).boundingBox();
  expect(first!.y).toBeLessThan(last!.y - 100);
  expect(first!.x).toBeGreaterThan(last!.x + 100);
  await page
    .getByRole("button", { name: "Check-in cơ sở", exact: true })
    .hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: "artifacts/radial-menu-desktop.png" });
  await page
    .getByRole("button", { name: "Check-in cơ sở", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Check-in cơ sở",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Check-in vào cơ sở" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Đã ghi nhận lượt vào cửa",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/member\/membership$/);
  await trigger.hover();
  await page.mouse.move(50, 120);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test.describe("touch utility menu", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("tap toggles the orbit and keeps all actions within the screen", async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    await page.goto("/member/membership");
    const trigger = page.locator(".pulse-quick-trigger");
    await trigger.tap();
    await expect(page.locator(".pulse-quick-action:visible")).toHaveCount(4);
    for (const action of await page.locator(".pulse-quick-action").all())
      await expect(action).toBeInViewport();
    await page.screenshot({ path: "artifacts/radial-menu-mobile.png" });
    await trigger.tap();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
