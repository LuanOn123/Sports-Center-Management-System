import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const [path, button, key] of [
  ["sports", "Thêm bộ môn", "areaTypes"],
  ["rooms", "Thêm phòng tập", "areaType"],
]) {
  test(`${path} form uses three accessible icon cards and saves the selected area`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await setup(page, "ADMIN");
    let saved: Record<string, unknown> | null = null;
    await page.route(
      new RegExp("/api/v1/" + path + "(?:\\?.*)?$"),
      async (route) => {
        if (route.request().method() === "POST") {
          saved = route.request().postDataJSON();
          return route.fulfill({
            json: { success: true, data: { id: "new" } },
          });
        }
        return route.fallback();
      },
    );
    await page.goto(`/admin/${path}`);
    await page.getByRole("button", { name: button, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio")).toHaveCount(3);
    await dialog
      .getByLabel(/^Tên/)
      .fill(path === "sports" ? "Bơi lội" : "Hồ bơi A");
    if (path === "rooms") await dialog.getByLabel(/^Sức chứa/).fill("20");
    await dialog.getByRole("radio", { name: /Hồ bơi/ }).check();
    await expect(dialog.getByRole("radio", { name: /Hồ bơi/ })).toBeChecked();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".area-type-picker")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/form-area-${path}-390.png` });
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect
      .poll(() => saved?.[key])
      .toEqual(path === "sports" ? ["POOL"] : "POOL");
  });
}

test("new facility address follows two levels and clears dependent values on province change", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.goto("/admin/facilities");
  await page.getByRole("button", { name: "Thêm cơ sở", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const province = dialog.getByRole("combobox", { name: /^Tỉnh/ });
  const ward = dialog.getByRole("combobox", { name: /^Phường/ });
  const street = dialog.getByRole("textbox", { name: /^Số nhà/ });
  await expect(ward).toBeDisabled();
  await expect(street).toBeDisabled();
  await expect(province.locator("option")).toHaveCount(35);
  await province.selectOption("79");
  await ward.selectOption({ label: "Phường Dĩ An" });
  await street.fill("123 Đường số 1");
  await expect(dialog.getByRole("status")).toContainText(
    "123 Đường số 1, Phường Dĩ An, Thành phố Hồ Chí Minh",
  );
  await province.selectOption("1");
  await expect(ward).toHaveValue("");
  await expect(street).toHaveValue("");
  await expect(street).toBeDisabled();
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: /Quận|Huyện/ }),
  ).toHaveCount(0);
});
