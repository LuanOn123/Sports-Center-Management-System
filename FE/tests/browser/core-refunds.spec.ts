import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function openRefund(page: Page) {
  await setup(page, "RECEPTIONIST");
  await page.route("**/api/v1/payments?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "refund-a",
            amount: 300_000,
            status: "SUCCESS",
            refundRequestedAt: "2027-01-01T00:00:00Z",
            refundRequestedAmount: 90_000,
          },
        ],
      },
    }),
  );
  await page.goto("/receptionist/payments");
  await page.getByRole("button", { name: /^Xác nhận hoàn/ }).click();
  return page.getByRole("dialog", { name: "Xác nhận đã hoàn tiền" });
}

for (const data of [
  {
    title: "spaces cannot serve as refund proof",
    reference: "   ",
    reason: "Đã trả tiền",
  },
  {
    title: "a short receipt code cannot confirm a return",
    reference: "AB",
    reason: "Đã trả tiền",
  },
  {
    title: "spaces cannot serve as a refund reason",
    reference: "RECEIPT-1",
    reason: "   ",
  },
]) {
  test(data.title, async ({ page }) => {
    const dialog = await openRefund(page);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") writes.push(request.url());
    });
    await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill(data.reference);
    await dialog
      .getByRole("textbox", { name: "Lý do", exact: true })
      .fill(data.reason);
    await expect(
      dialog.getByRole("button", { name: "Xác nhận đã trả tiền" }),
    ).toBeDisabled();
    await expect(dialog).toBeVisible();
    expect(writes).toEqual([]);
  });
}

test("cancelling refund confirmation leaves the receipt queue and makes no write", async ({
  page,
}) => {
  const dialog = await openRefund(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") writes.push(request.url());
  });
  await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill("RETURN-123");
  await dialog
    .getByRole("textbox", { name: "Lý do", exact: true })
    .fill("Chưa thực hiện trả tiền");
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Xác nhận hoàn/ }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("a concurrent refund conflict preserves the entered evidence for review", async ({
  page,
}) => {
  const dialog = await openRefund(page);
  const writes: unknown[] = [];
  await page.route("**/api/v1/payments/refund-a/refund/confirm", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 409,
      json: {
        success: false,
        message: "Giao dịch đã được xử lý bởi nhân viên khác.",
      },
    });
  });
  await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill("RETURN-123");
  await dialog
    .getByRole("textbox", { name: "Lý do", exact: true })
    .fill("Đã chuyển trả");
  await dialog.getByRole("button", { name: "Xác nhận đã trả tiền" }).click();
  await expect(dialog.locator(".error-state")).toContainText(
    "Giao dịch đã được xử lý bởi nhân viên khác.",
  );
  await expect(dialog.getByLabel("Mã biên nhận / chuyển khoản")).toHaveValue(
    "RETURN-123",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Lý do", exact: true }),
  ).toHaveValue("Đã chuyển trả");
  expect(writes).toEqual([
    { reference: "RETURN-123", reason: "Đã chuyển trả" },
  ]);
});

test("refund confirmation trims evidence and cannot be dismissed or submitted twice in flight", async ({
  page,
}) => {
  const dialog = await openRefund(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writes: unknown[] = [];
  await page.route(
    "**/api/v1/payments/refund-a/refund/confirm",
    async (route) => {
      writes.push(route.request().postDataJSON());
      await gate;
      await route.fulfill({
        json: { success: true, data: { id: "refund-a", status: "REFUNDED" } },
      });
    },
  );
  await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill("  RETURN-123  ");
  await dialog
    .getByRole("textbox", { name: "Lý do", exact: true })
    .fill("  Đã trả tiền mặt  ");
  try {
    await dialog.getByRole("button", { name: "Xác nhận đã trả tiền" }).click();
    await expect(
      dialog.getByRole("button", { name: "Đang xác nhận…" }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Hủy", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => writes)
      .toEqual([{ reference: "RETURN-123", reason: "Đã trả tiền mặt" }]);
  } finally {
    release();
  }
  await expect(dialog).toBeHidden();
  expect(writes).toHaveLength(1);
});
