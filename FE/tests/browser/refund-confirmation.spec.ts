import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("Admin approves an unactivated refund before the cashier records an actual return", async ({ page }) => {
  await setup(page, "ADMIN");
  let approved = false, refunded = false;
  const writes: unknown[] = [];
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (request.method() === "POST" && path.startsWith("/payments/review-1/refund/")) {
      writes.push({ path, body: request.postDataJSON() });
      if (path.endsWith("/request")) approved = true;
      else refunded = true;
      return route.fulfill({ json: { success: true, data: {} } });
    }
    if (path === "/members") return route.fulfill({ json: { success: true, data: [
      { id: "member-1", user: { fullName: "Nguyễn Lan", email: "lan@example.invalid" } },
    ] } });
    if (path === "/payments") return route.fulfill({ json: { success: true, data: [
      { id: "review-1", amount: 300000, status: refunded ? "REFUNDED" : "SUCCESS", gateway: "SEPAY",
        activationStatus: "REQUIRES_REVIEW", subscriptionId: null,
        refundRequestedAt: approved ? "2026-11-01T00:00:00Z" : null, refundRequestedAmount: approved ? 300000 : null },
    ] } });
    if (path.startsWith("/invoices/member/")) return route.fulfill({ json: { success: true, data: [] } });
    return route.fallback();
  });
  await page.goto("/admin/payments");
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Xác nhận hoàn/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Duyệt hoàn tiền chưa cấp gói", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Duyệt yêu cầu hoàn tiền", exact: true })).toBeDisabled();
  await dialog.getByLabel("Lý do hoàn ngoại lệ").fill("Không thể cấp gói cho giao dịch này");
  await dialog.getByRole("button", { name: "Duyệt yêu cầu hoàn tiền", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Thử kích hoạt lại", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Xác nhận hoàn/ }).click();
  await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill("REFUND-AUDIT-01");
  await dialog.getByLabel("Lý do", { exact: true }).fill("Đã chuyển trả tiền thực tế");
  await dialog.getByRole("button", { name: "Xác nhận đã trả tiền", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(writes).toEqual([
    { path: "/payments/review-1/refund/request", body: { reason: "Không thể cấp gói cho giao dịch này" } },
    { path: "/payments/review-1/refund/confirm", body: { reason: "Đã chuyển trả tiền thực tế", reference: "REFUND-AUDIT-01" } },
  ]);
});

test("Admin can retry paid SePay activation and payments page has no arbitrary receipt action", async ({ page }) => {
  await setup(page, "ADMIN");
  let retried = false;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/payments/review-1/retry-activation" && route.request().method() === "POST") {
      retried = true;
      return route.fulfill({ json: { success: true, data: {} } });
    }
    if (path === "/members") return route.fulfill({ json: { success: true, data: [
      { id: "member-1", user: { fullName: "Nguyễn Lan", email: "lan@example.invalid" } },
    ] } });
    if (path === "/payments") return route.fulfill({ json: { success: true, data: [
      { id: "review-1", amount: 300000, status: "SUCCESS", gateway: "SEPAY", activationStatus: retried ? "ACTIVATED" : "REQUIRES_REVIEW" },
    ] } });
    if (path.startsWith("/invoices/member/")) return route.fulfill({ json: { success: true, data: [] } });
    return route.fallback();
  });
  await page.goto("/admin/payments");
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ghi nhận thanh toán", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Thử kích hoạt lại", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử kích hoạt lại", exact: true })).toHaveCount(0);
  expect(retried).toBe(true);
});

test("Admin records an actual refund with receipt, and cannot submit without evidence", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  const writes: unknown[] = [];
  let refunded = false;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (
      request.method() === "POST" &&
      path === "/payments/payment-1/refund/confirm"
    ) {
      writes.push(request.postDataJSON());
      refunded = true;
      return route.fulfill({
        json: {
          success: true,
          data: { id: "payment-1", status: "REFUNDED" },
          message: "Đã xác nhận hoàn tiền thực tế",
        },
      });
    }
    let data: unknown;
    if (path === "/members")
      data = [
        {
          id: "member-1",
          user: { fullName: "Nguyễn Lan", email: "lan@example.invalid" },
        },
      ];
    else if (path === "/payments")
      data = [
        {
          id: "payment-1",
          amount: 300000,
          status: refunded ? "REFUNDED" : "SUCCESS",
          method: "CASH",
          refundRequestedAt: "2026-10-29T00:00:00Z",
          refundRequestedAmount: 90000,
        },
      ];
    else if (
      path.startsWith("/subscriptions/member/") ||
      path.startsWith("/invoices/member/")
    )
      data = [];
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/admin/payments");
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await page.getByRole("button", { name: /^Xác nhận hoàn/ }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", {
    name: "Xác nhận đã trả tiền",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await dialog
    .getByLabel("Mã biên nhận / chuyển khoản")
    .fill("CASH-20261029-001");
  await dialog.getByLabel("Lý do").fill("Đã trả tiền tại quầy cho hội viên");
  await submit.click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toEqual([
    {
      reference: "CASH-20261029-001",
      reason: "Đã trả tiền tại quầy cho hội viên",
    },
  ]);
  await expect(
    page.getByRole("button", { name: /^Xác nhận hoàn/ }),
  ).toHaveCount(0);
});
