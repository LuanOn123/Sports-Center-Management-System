import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const [role, path] of [
  ["MEMBER", "member"],
  ["COACH", "coach"],
  ["RECEPTIONIST", "receptionist"],
  ["MANAGER", "manager"],
]) {
  test(`avatar upload controls: ${role}`, async ({ page }) => {
    await setup(page, role);
    await page.goto(`/${path}/profile`);
    const editor = page.getByRole("region", { name: "Cập nhật ảnh đại diện" });
    await expect(editor).toBeVisible();
    await editor.locator('input[type="file"]').setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid"),
    });
    await expect(editor.getByRole("alert")).toContainText("Vui lòng chọn ảnh");
    await expect(editor.getByRole("button", { name: "Lưu ảnh" })).toHaveCount(
      0,
    );
  });
}

test("multipart upload updates navbar", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  await page.goto("/receptionist/profile");
  const profile = await page.evaluate(async () =>
    (
      await fetch(
        "https://sports-center-management-system.onrender.com/api/v1/auth/me",
      )
    ).json(),
  );
  profile.data.avatarUrl = "/uploads/avatars/test.png";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/uploads/avatars/test.png", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/auth/me", (route) => route.fulfill({ json: profile }));
  await page.route("**/auth/me/avatar", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toContain(
      "multipart/form-data; boundary=",
    );
    expect(route.request().postDataBuffer()?.toString()).toContain(
      'name="avatar"',
    );
    const payload = route.request().postDataBuffer()!;
    const signature = payload.indexOf(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(signature).toBeGreaterThan(0);
    expect(payload.readUInt32BE(signature + 16)).toBe(512);
    expect(payload.readUInt32BE(signature + 20)).toBe(512);
    await route.fulfill({ json: profile });
  });
  const editor = page.getByRole("region", { name: "Cập nhật ảnh đại diện" });
  await editor
    .locator('input[type="file"]')
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(editor.getByAltText("Xem trước ảnh đại diện mới")).toBeVisible();
  const zoom = editor.getByRole("slider", { name: "Phóng to" });
  await zoom.fill("2");
  const crop = editor.getByRole("group", { name: "Điều chỉnh vị trí ảnh" });
  await crop.focus();
  await page.keyboard.press("ArrowRight");
  const image = editor.getByAltText("Xem trước ảnh đại diện mới");
  await expect(image).toHaveCSS("transform", "matrix(1, 0, 0, 1, -232, -240)");
  const box = await crop.boundingBox();
  if (!box) throw new Error("Crop area missing");
  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140);
  await page.mouse.up();
  await expect(image).toHaveCSS("transform", "matrix(1, 0, 0, 1, -192, -220)");
  await editor.getByRole("button", { name: "Đặt lại vị trí" }).click();
  await expect(zoom).toHaveValue("1");
  await editor.getByRole("button", { name: "Lưu ảnh" }).click();
  await expect(editor.getByRole("status")).toContainText("Đã cập nhật");
  await expect(page.locator(".profile-link img")).toHaveAttribute(
    "src",
    /uploads/,
  );
});

test("avatar viewer supports zoom and Escape", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  await page.goto("/receptionist/profile");
  const profile = await page.evaluate(async () =>
    (
      await fetch(
        "https://sports-center-management-system.onrender.com/api/v1/auth/me",
      )
    ).json(),
  );
  profile.data.avatarUrl = "/uploads/avatars/view.png";
  await page.route("**/auth/me", (route) => route.fulfill({ json: profile }));
  await page.route("**/uploads/avatars/view.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="green"/></svg>',
    }),
  );
  await page.reload();
  const trigger = page
    .locator(".profile-link")
    .getByRole("button", { name: /Xem ảnh đại diện/ });
  await trigger.click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  const slider = viewer.getByRole("slider", { name: "Mức phóng ảnh đại diện" });
  await slider.fill("2");
  await expect(slider).toHaveValue("2");
  await viewer.getByRole("button", { name: "Vừa khung" }).click();
  await expect(slider).toHaveValue("1");
  await slider.fill("0.5");
  await expect(slider).toHaveValue("0.5");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
