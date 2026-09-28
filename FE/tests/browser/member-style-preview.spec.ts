import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("member visual review", async ({ page }) => {
  test.setTimeout(90000);
  await setup(page, "MEMBER");
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of [
    "classes",
    "dashboard",
    "schedule",
    "membership",
    "payments",
    "profile",
    "my-classes",
    "attendance",
  ]) {
    await page.goto(`/member/${route}`);
    await page.locator(".member-theme").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `test-results/member-style-${route}.png`,
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(scan.violations, `Text contrast on ${route}`).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Mở điểm danh nhanh" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "test-results/member-style-modal.png" });
  await page.keyboard.press("Escape");
  await page.goto("/member/payments");
  await page.getByRole("button", { name: "Xem / In hóa đơn" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/member-style-invoice.png" });
  await page.keyboard.press("Escape");
  await page.goto("/member/membership");
  await page.getByRole("button", { name: "Bảng giá các gói" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/member-style-plans.png",
    fullPage: true,
  });
  await page.goto("/member/classes");
  await page
    .getByRole("button", { name: "Xem chi tiết khóa học" })
    .first()
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/member-style-class-detail.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["classes", "schedule", "membership", "payments"]) {
    await page.goto(`/member/${route}`);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/member-style-mobile-${route}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
