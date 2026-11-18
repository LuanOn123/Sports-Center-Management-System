import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const [role, path] of [
  ["RECEPTIONIST", "/receptionist/dashboard"],
  ["MANAGER", "/manager/dashboard"],
  ["COACH", "/coach/dashboard"],
  ["MEMBER", "/member/dashboard"],
] as const) {
  test(`${role} header shows the current facility without a selector`, async ({ page }) => {
    await setup(page, role);
    await page.goto(path);
    const header = page.locator("header.topbar");
    await expect(header.getByLabel("Cơ sở hiện tại: Cơ sở A")).toBeVisible();
    await expect(header.getByRole("combobox")).toHaveCount(0);
    if (role === "MEMBER") {
      await page.goto("/member/classes");
      await page.getByRole("combobox", { name: "Cơ sở tìm lớp" }).selectOption("facility-b");
      await expect(header.getByLabel("Cơ sở hiện tại: Cơ sở B")).toBeVisible();
    }
  });
}
