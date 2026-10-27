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
    await dialog.getByLabel(/^Mở đăng ký từ/).fill("2027-01-01");
    await dialog.getByLabel(/^Đóng đăng ký vào/).fill("2027-01-25");
    await dialog.getByLabel(/^Ghi chú/).fill("Ghi chú kiểm tra bố cục.");
    await page.screenshot({ path: `artifacts/term-editor-footer-${width}.png` });
    await footer.getByRole("button", { name: "Lưu kỳ học", exact: true }).click();
    await expect.poll(() => saved).toMatchObject({ code: "KY_MOI_2027", name: "Kỳ mới 2027", startDate: "2027-01-31T17:00:00.000Z", facilityId: null });
    await expect(dialog).toHaveCount(0);
  });
}
