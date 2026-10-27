import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const width of [390, 1440]) {
  test(`facility form has Vietnamese sections and creates optional limits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "ADMIN");
    let saved: Record<string, unknown> | null = null;
    await page.route(/\/api\/v1\/facilities(?:\?.*)?$/, (route) => {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { success: true, data: { id: "new" } } });
      }
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "facility-a",
              code: "A",
              name: "Cơ sở A",
              address: "123 Đường số 1",
              isActive: true,
              staffs: [],
            },
          ],
        },
      });
    });
    await page.goto("/admin/facilities");
    await page.getByRole("button", { name: "Thêm cơ sở", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Thêm cơ sở" });
    await expect(
      dialog.getByRole("heading", { name: "Thông tin cơ sở" }),
    ).toBeVisible();
    await dialog.getByLabel(/^Mã cơ sở/).fill("DI_AN");
    await dialog.getByLabel(/^Tên cơ sở/).fill("Pulse Dĩ An");
    await dialog.getByRole("combobox", { name: /^Tỉnh/ }).selectOption("79");
    await dialog
      .getByRole("combobox", { name: /^Phường/ })
      .selectOption({ label: "Phường Dĩ An" });
    await dialog.getByLabel(/^Số nhà, tên đường/).fill("123 Đường số 1");
    await expect(dialog.locator("details")).not.toHaveAttribute("open");
    await dialog.getByText("Giới hạn vận hành", { exact: true }).click();
    await expect(
      dialog.getByText(/maxClasses|maxMembers|maxRooms|maxCoaches|maxSports/),
    ).toHaveCount(0);
    await dialog.getByLabel(/^Số lớp học tối đa/).fill("12");
    await page.screenshot({ path: `artifacts/facility-editor-${width}.png` });
    expect(
      (
        await new AxeBuilder({ page })
          .include(".facility-editor")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Tạo cơ sở" }).click();
    await expect
      .poll(() => saved)
      .toMatchObject({
        code: "DI_AN",
        name: "Pulse Dĩ An",
        maxClasses: 12,
        maxMembers: null,
        maxRooms: null,
        maxCoaches: null,
        maxSports: null,
      });
    await expect(dialog).toHaveCount(0);
  });
}

test("clearing an existing facility limit saves null", async ({ page }) => {
  await setup(page, "ADMIN");
  const facility = {
    id: "facility-a",
    code: "A",
    name: "Cơ sở A",
    address: "123 Đường số 1",
    isActive: true,
    staffs: [],
    maxClasses: 10,
    maxRooms: null,
    maxMembers: 200,
  };
  await page.route(/\/api\/v1\/facilities(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { success: true, data: [facility] } }),
  );
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/v1/facilities/facility-a", (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: facility } });
  });
  await page.goto("/admin/facilities");
  await page
    .getByRole("button", { name: /Chỉnh sửa/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Giới hạn vận hành", { exact: true }).click();
  await expect(dialog.getByLabel(/^Số lớp học tối đa/)).toHaveValue("10");
  await dialog.getByLabel(/^Số lớp học tối đa/).fill("");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect
    .poll(() => saved)
    .toMatchObject({ maxClasses: null, maxMembers: 200, isActive: true });
});
