import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

const free = {
  id: "free",
  name: "FREE",
  tier: "FREE",
  price: 0,
  durationDays: 3650,
  maxConcurrentClasses: 0,
};
const membership = {
  id: "membership",
  name: "Membership Monthly",
  tier: "MEMBERSHIP",
  price: 300000,
  durationDays: 30,
  maxConcurrentClasses: 3,
};
const premium = {
  ...membership,
  id: "premium",
  name: "Premium Monthly",
  tier: "PREMIUM",
  price: 600000,
  maxConcurrentClasses: 6,
};

for (const width of [390, 1440]) {
  test(`Free summary, paid plans and quick actions work together at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "MEMBER");
    await page.route("**/api/v1/membership-plans?*", (route) =>
      route.fulfill({
        json: { success: true, data: [free, membership, premium] },
      }),
    );
    await page.route("**/api/v1/subscriptions/member/*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "sub-free",
              planId: free.id,
              tier: "FREE",
              status: "ACTIVE",
              startDate: "2020-01-01T00:00:00Z",
              endDate: "2099-01-01T00:00:00Z",
              plan: free,
            },
          ],
        },
      }),
    );
    await page.goto("/member/membership");
    await expect(
      page.getByRole("heading", { name: "Tài khoản Free" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bảng giá các gói tập" }),
    ).toBeVisible();
    await expect(page.locator(".membership-plan-card")).toHaveCount(2);
    await expect(
      page.locator(".membership-plan-card").filter({ hasText: "FREE" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Hủy gói/ })).toHaveCount(0);
    await expect(
      page.locator(".ai-fab, .attendance-shortcut, .floating-chat-button"),
    ).toHaveCount(0);

    const trigger = page.getByRole("button", { name: "Mở tiện ích nhanh" });
    await expect(trigger.locator("img")).toHaveAttribute(
      "src",
      "/brand/pulse-member.svg",
    );
    await trigger.click();
    await expect(page.locator(".pulse-quick-action:visible")).toHaveCount(4);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator(".pulse-quick-action:visible")).toHaveCount(0);
    await trigger.click();
    await page.getByRole("heading", { name: "Quản lý Gói hội viên" }).click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();
    await page.getByRole("button", { name: "Trợ lý AI", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Trợ Lý Sports Center" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await page.getByRole("button", { name: "Điểm danh", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Điểm danh nhanh" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await page.getByRole("button", { name: "Tin nhắn", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Cửa sổ tin nhắn" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Đóng tin nhắn" }).click();
    await expect(page.locator(".pulse-quick-action:visible")).toHaveCount(0);

    await page
      .locator(".membership-plan-card")
      .filter({ hasText: "Membership Monthly" })
      .getByRole("button", { name: "Nâng cấp qua VietQR" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Nâng cấp gói tập" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await page.screenshot({
      path: `artifacts/quick-actions-menu-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `artifacts/membership-quick-actions-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
