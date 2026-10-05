import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const [role, base, routes] of [
  [
    "MANAGER",
    "manager",
    ["dashboard", "rooms", "schedules", "activity-planner"],
  ],
  ["RECEPTIONIST", "receptionist", ["dashboard", "classes", "payments", "membership"]],
  ["COACH", "coach", ["dashboard", "schedule", "classes", "profile"]],
] as const) {
  for (const width of [375, 1440]) {
    test(`${role} shares the member design language at ${width}px`, async ({
      page,
    }) => {
      await setup(page, role);
      await page.setViewportSize({ width, height: 960 });
      for (const route of routes) {
        await page.goto(`/${base}/${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator(".skeleton, .loading")).toHaveCount(0);
        await expect(page.locator(".app-layout")).toHaveClass(/portal-theme/);
        expect(
          await page
            .locator(".app-layout")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe("rgb(11, 16, 24)");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(results.violations, `${base}/${route}`).toEqual([]);
        await page.screenshot({
          path: `artifacts/portal-theme/${base}-${route}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}
