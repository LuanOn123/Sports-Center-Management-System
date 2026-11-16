import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const width of [390, 1440]) {
  test(`term footer fills the form and save/cancel work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await setup(page, "ADMIN");
    let saved: Record<string, unknown> | null = null;
    await page.route(/\/api\/v1\/terms(?:\?.*)?$/, (route) => {
      if (route.request().method() === "POST") { saved = route.request().postDataJSON(); return route.fulfill({ json: { success: true, data: { id: "new" } } }); }
      return route.fulfill({ json: { success: true, data: [] } });
    });
    await page.goto("/admin/terms");
    await page.getByRole("button", { name: "Thêm kỳ học", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const footer = dialog.locator(".term-editor > .modal-footer");
    const form = dialog.locator(".term-editor");
    const footerBox = await footer.boundingBox();
    const formBox = await form.boundingBox();
    expect(Math.abs(footerBox!.width - formBox!.width)).toBeLessThan(2);
    await expect(footer.getByRole("button", { name: "Hủy", exact: true })).toBeInViewport();
    await footer.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toBe(null);
    await page.getByRole("button", { name: "Thêm kỳ học", exact: true }).click();
    await dialog.getByLabel(/^Mã kỳ học/).fill("KY_MOI_2027");
    await dialog.getByLabel(/^Tên kỳ học/).fill("Kỳ mới 2027");
    await dialog.getByLabel(/^Ngày bắt đầu kỳ/).fill("2027-02-01");
    await dialog.getByLabel(/^Ngày kết thúc kỳ/).fill("2027-05-01");
    await dialog.getByLabel(/^Mở đăng ký từ/).fill("2027-01-01T06:30");
    await dialog.getByLabel(/^Đóng đăng ký vào/).fill("2027-01-25");
    await dialog.getByLabel(/^Ghi chú/).fill("Ghi chú kiểm tra bố cục.");
    await page.screenshot({ path: `artifacts/term-editor-footer-${width}.png` });
    await footer.getByRole("button", { name: "Lưu kỳ học", exact: true }).click();
    await expect.poll(() => saved).toMatchObject({
      code: "KY_MOI_2027",
      name: "Kỳ mới 2027",
      startDate: "2027-01-31T17:00:00.000Z",
      registrationStartDate: "2026-12-31T23:30:00.000Z",
      facilityId: null,
    });
    await expect(dialog).toHaveCount(0);
  });
}

test.describe("manager term editor", () => {
  test.use({ timezoneId: "UTC" });

  test("keeps Vietnam registration time when reopening a term assigned by the server", async ({ page }) => {
    await setup(page, "MANAGER");
    let saved: Record<string, unknown> | undefined;
    let updated: Record<string, unknown> | undefined;
    let term: Record<string, unknown> | undefined;
    await page.route(/\/api\/v1\/terms(?:\?.*)?$/, (route) => {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        term = { ...saved, id: "new", facilityId: "facility-a" };
        return route.fulfill({ status: 201, json: { success: true, data: term } });
      }
      return route.fulfill({ json: { success: true, data: term ? [term] : [] } });
    });
    await page.route("**/api/v1/terms/new", (route) => {
      updated = route.request().postDataJSON();
      term = { ...term, ...updated };
      return route.fulfill({ json: { success: true, data: term } });
    });

    await page.goto("/manager/terms");
    await page.getByRole("button", { name: "Thêm kỳ học", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Mã kỳ học/).fill("KY_CO_SO");
    await dialog.getByLabel(/^Tên kỳ học/).fill("Kỳ cơ sở");
    await dialog.getByLabel(/^Ngày bắt đầu kỳ/).fill("2027-02-01");
    await dialog.getByLabel(/^Ngày kết thúc kỳ/).fill("2027-05-01");
    await dialog.getByLabel(/^Mở đăng ký từ/).fill("2027-01-15T06:30");
    await dialog.getByLabel(/^Đóng đăng ký vào/).fill("2027-01-15");
    await dialog.getByRole("button", { name: "Lưu kỳ học" }).click();

    await expect(dialog).toHaveCount(0);
    expect(saved).toMatchObject({
      registrationStartDate: "2027-01-14T23:30:00.000Z",
      registrationEndDate: "2027-01-15T16:59:59.000Z",
    });
    expect(saved).not.toHaveProperty("facilityId");
    await expect(page.getByText(/06:30.*15\/01\/2027/)).toBeVisible();
    await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
    await expect(dialog.getByLabel(/^Ngày bắt đầu kỳ/)).toHaveValue("2027-02-01");
    await expect(dialog.getByLabel(/^Mở đăng ký từ/)).toHaveValue("2027-01-15T06:30");
    await dialog.getByLabel(/^Mở đăng ký từ/).fill("2027-01-15T09:45");
    await dialog.getByRole("button", { name: "Lưu kỳ học" }).click();
    await expect(dialog).toHaveCount(0);
    expect(updated).toMatchObject({
      startDate: saved?.startDate,
      registrationStartDate: "2027-01-15T02:45:00.000Z",
      registrationEndDate: saved?.registrationEndDate,
    });
    expect(updated).not.toHaveProperty("facilityId");
  });
});
