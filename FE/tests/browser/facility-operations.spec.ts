import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
test("admin has a portal and changing facilities switches API context", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  const headers: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/rooms"))
      headers.push(r.headers()["x-facility-id"]);
  });
  await page.goto("/admin/rooms");
  await expect(
    page.getByRole("heading", { name: "Phòng tập", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Cơ sở đang làm việc" }),
  ).toHaveValue("facility-a");
  await page
    .getByRole("combobox", { name: "Cơ sở đang làm việc" })
    .selectOption("facility-b");
  await expect.poll(() => headers).toContain("facility-b");
  expect(headers[0]).toBe("facility-a");
});
test("member can create a scoped support request", async ({ page }) => {
  await setup(page, "MEMBER");
  await page.route("**/api/v1/issues", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.goto("/member/support");
  await expect(
    page.getByRole("heading", { name: "Yêu cầu hỗ trợ", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thêm mới", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Lưu|Tạo/ }),
  ).toBeVisible();
});
test("manager cannot edit plan prices", async ({ page }) => {
  await setup(page, "MANAGER");
  await page.goto("/manager/membership-plans");
  await expect(
    page.getByRole("heading", { name: "Báo cáo doanh thu", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);
});

test("room configuration loads existing quantities and blocks saving after failed lookup", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  await page.route("**/api/v1/rooms**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/missing"))
      return route.fulfill({
        status: 404,
        json: { success: false, message: "Room not found" },
      });
    if (path.endsWith("/known"))
      return route.fulfill({
        json: {
          success: true,
          data: { id: "known", capabilities: [{ key: "mats", quantity: 12 }] },
        },
      });
    return route.fulfill({
      json: {
        success: true,
        data: [
          { id: "known", name: "Phòng đã cấu hình" },
          { id: "missing", name: "Phòng đã xóa" },
        ],
      },
    });
  });
  await page.goto("/manager/requirements");
  await expect(page).toHaveURL(/\/manager\/rooms$/);
  await page.getByRole("button", { name: "Sử dụng & cấu hình phòng" }).click();
  await page
    .getByRole("combobox", { name: "Phòng tập", exact: true })
    .selectOption("known");
  await page.getByRole("button", { name: "Cấu hình phòng", exact: true }).click();
  await expect(page.locator('input[value="mats"]')).toBeVisible();
  const save = page.getByRole("button", { name: "Lưu cấu hình" });
  await expect(save).toBeEnabled();
  await page.getByRole("dialog").getByRole("button", { name: "Hủy", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Phòng tập", exact: true })
    .selectOption("missing");
  await page.getByRole("button", { name: "Cấu hình phòng", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Không tìm thấy phòng tập",
  );
  await expect(save).toHaveCount(0);
});

for (const width of [375, 1440])
  test(`new operation screens are accessible at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page, "ADMIN");
    await page.setViewportSize({ width, height: 960 });
    for (const path of [
      "facilities",
      "staff",
      "requirements",
      "slots",
      "patterns",
      "leave",
      "orders",
      "issues",
      "audit",
    ]) {
      await page.goto("/admin/" + path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".loading, .skeleton")).toHaveCount(0);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations, path).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        path,
      ).toBe(true);
    }
  });
