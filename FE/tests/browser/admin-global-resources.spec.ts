import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

test("Admin chooses the destination facility when creating a room from a filtered list", async ({ page }) => {
  await setup(page, "ADMIN");
  let saved: { body: unknown; facility?: string } | undefined;
  await page.route(/\/api\/v1\/rooms(?:\?|$)/, (route) => {
    if (route.request().method() === "POST") {
      saved = { body: route.request().postDataJSON(), facility: route.request().headers()["x-facility-id"] };
      return route.fulfill({ status: 201, json: { success: true, data: { id: "room-new" } } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/admin/rooms");
  await page.getByRole("combobox", { name: "Lọc dữ liệu cơ sở", exact: true }).selectOption("facility-b");
  await page.getByRole("button", { name: "Thêm phòng tập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cơ sở tạo mới", { exact: true }).selectOption("facility-a");
  await dialog.getByLabel("Tên", { exact: false }).first().fill("Phòng thử nghiệm");
  await dialog.getByLabel("Sức chứa", { exact: false }).fill("20");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(saved).toMatchObject({ facility: "facility-a", body: { facilityId: "facility-a", name: "Phòng thử nghiệm", capacity: 20 } });
});

for (const resource of ["rooms", "classes", "schedules"]) {
  test(`Admin views ${resource} across facilities and filters by facility`, async ({ page }) => {
    await setup(page, "ADMIN");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const calls: (string | undefined)[] = [];
    const endpoint = resource === "schedules" ? "class-schedules" : resource;
    await page.route(new RegExp("/api/v1/" + endpoint + "(?:\\?|$)"), (route) => {
      const facility = route.request().headers()["x-facility-id"];
      calls.push(facility);
      const start = new Date();
      start.setHours(12, 0, 0, 0);
      const end = new Date(+start + 3600000);
      return route.fulfill({ json: { success: true, data: ["a", "b"].filter((key) => !facility || facility === "facility-" + key).map((key) => ({
        id: "resource-" + key, name: "Mục " + key, facilityId: "facility-" + key, isActive: true,
        capacity: 10, areaType: "INDOOR", classType: "REGULAR",
        class: { id: "class-" + key, name: "Lớp " + key, facilityId: "facility-" + key },
        room: { id: "room-" + key, name: "Phòng " + key, facilityId: "facility-" + key },
        startTime: start.toISOString(), endTime: end.toISOString(), status: "SCHEDULED",
      })) } });
    });
    await page.goto("/admin/" + resource);
    const filter = page.getByRole("combobox", { name: "Lọc dữ liệu cơ sở", exact: true });
    await expect(filter).toHaveValue("");
    if (resource === "schedules") await page.getByRole("button", { name: "Bảng", exact: true }).click();
    const main = page.getByRole("main");
    const collection = resource === "schedules" ? main.locator("tbody") : main.locator(".resource-grid");
    await expect(collection).toContainText("Cơ sở A");
    await expect(collection).toContainText("Cơ sở B");
    expect(calls[0]).toBeUndefined();
    await filter.selectOption("facility-b");
    await expect.poll(() => calls.at(-1)).toBe("facility-b");
    if (resource === "schedules") await page.getByRole("button", { name: "Bảng", exact: true }).click();
    await expect(collection).toContainText("Cơ sở B");
    await expect(collection).not.toContainText("Cơ sở A");
    await filter.selectOption("");
    if (resource === "schedules") await page.getByRole("button", { name: "Bảng", exact: true }).click();
    await expect(collection).toContainText("Cơ sở A");
  });
}
