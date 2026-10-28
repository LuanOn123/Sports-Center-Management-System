import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

for (const fail of [false, true]) {
  test(`area cards remain visually hidden native controls during save and ${fail ? "recover after an error" : "close after success"}`, async ({
    page,
  }) => {
    await setup(page, "ADMIN");
    let releaseSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const sport = {
      id: "swim",
      name: "Bơi lội",
      description: "Lớp bơi lội cho mọi trình độ.",
      areaTypes: ["POOL"],
      isActive: true,
    };
    let saved = false;
    await page.route("**/api/v1/sports**", async (route) => {
      if (route.request().method() === "PATCH") {
        expect(route.request().postDataJSON().areaTypes).toEqual(["POOL"]);
        await saving;
        saved = true;
        return route.fulfill({
          status: fail ? 500 : 200,
          json: fail
            ? { success: false, message: "Không lưu được bộ môn" }
            : { success: true, data: sport },
        });
      }
      return route.fulfill({ json: { success: true, data: [sport] } });
    });
    await page.goto("/admin/sports");
    await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const radios = dialog.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(dialog.getByRole("radio", { name: /Hồ bơi/ })).toBeChecked();
    await dialog
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    try {
      await expect(
        dialog.getByRole("button", { name: /Đang lưu/ }),
      ).toBeDisabled();
      for (const radio of await radios.all()) {
        await expect(radio).toBeDisabled();
        await expect(radio).toHaveCSS("opacity", "0");
      }
      await expect(dialog.getByRole("radio", { name: /Hồ bơi/ })).toBeChecked();
      expect(saved).toBe(false);
    } finally {
      releaseSave();
    }
    if (fail) {
      await expect(dialog.getByRole("alert")).toBeVisible();
      for (const radio of await radios.all()) {
        await expect(radio).toBeEnabled();
        await expect(radio).toHaveCSS("opacity", "0");
      }
      await dialog.getByRole("radio", { name: /Trong nhà/ }).check();
      await expect(
        dialog.getByRole("radio", { name: /Trong nhà/ }),
      ).toBeChecked();
    } else {
      await expect(dialog).not.toBeVisible();
    }
  });
}
