import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`member product screens fit ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await setup(page, "MEMBER");
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of [
      "dashboard",
      "classes",
      "my-classes",
      "schedule",
      "membership",
      "payments",
      "attendance",
      "training",
      "profile",
      "notifications",
    ]) {
      await page.goto(`/member/${route}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      ).toBe(true);
      if (
        [375, 1440].includes(width) &&
        ["classes", "schedule", "dashboard"].includes(route)
      ) {
        await page.screenshot({
          path: `artifacts/redesign/member-${route}-${width}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("collection view keeps room details accessible in both modes", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/manager/rooms");
  await expect(page.locator(".resource-card").first()).toBeVisible();
  await page.screenshot({
    path: "artifacts/redesign/rooms-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Xem chi tiết", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Bảng", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("button", { name: "Xem chi tiết", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("booking date filter uses documented query and preserves member selection", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/receptionist/classes");
  await page.getByRole("button", { name: "Chọn", exact: true }).first().click();
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/class-schedules?") &&
      new URL(r.url()).searchParams.get("date") === "2099-09-15",
  );
  await page.getByLabel("Ngày học", { exact: true }).fill("2099-09-15");
  await request;
  await expect(
    page.getByRole("button", { name: "Đổi hội viên" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem đăng ký" }).first().click();
  await expect(
    page.getByRole("button", { name: "Đăng ký cho hội viên đã chọn" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "artifacts/redesign/booking.png",
    fullPage: true,
  });
});

for (const width of [375, 1440]) {
  test(`member screens have accessible controls at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await setup(page, "MEMBER");
    await page.setViewportSize({ width, height: 960 });
    for (const route of [
      "classes",
      "schedule",
      "membership",
      "profile",
      "my-classes",
    ]) {
      await page.goto(`/member/${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        route,
      ).toEqual([]);
    }
  });
}
