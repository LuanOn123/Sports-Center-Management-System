import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

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
