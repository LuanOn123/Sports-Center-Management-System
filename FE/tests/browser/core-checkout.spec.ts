import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

const standard = {
  id: "standard",
  name: "Membership 30 ngày",
  tier: "MEMBERSHIP",
  price: 300_000,
  durationDays: 30,
  maxConcurrentClasses: 3,
};
const premium = {
  ...standard,
  id: "premium",
  name: "Premium 30 ngày",
  tier: "PREMIUM",
  price: 600_000,
  maxConcurrentClasses: 6,
};
const expiry = "2099-10-01T02:17:48.123Z";

function paidSubscription(plan = standard, status = "ACTIVE") {
  return {
    id: `subscription-${plan.id}`,
    planId: plan.id,
    tier: plan.tier,
    status,
    startDate: status === "SCHEDULED" ? expiry : "2020-01-01T00:00:00Z",
    endDate: status === "SCHEDULED" ? "2099-11-01T02:17:48.123Z" : expiry,
    plan,
  };
}

async function mockMembership(
  page: Page,
  subscriptions: ReturnType<typeof paidSubscription>[] = [],
) {
  await setup(page, "MEMBER");
  await page.route("**/api/v1/membership-plans?*", (route) =>
    route.fulfill({ json: { success: true, data: [standard, premium] } }),
  );
  await page.route("**/api/v1/subscriptions/member/*", (route) =>
    route.fulfill({ json: { success: true, data: subscriptions } }),
  );
}

function order(plan = standard, id = "order-a") {
  return {
    paymentId: id,
    orderCode: `SEVQR-${id}`,
    amount: 320_000,
    currency: "VND",
    status: "PENDING",
    gateway: "SEPAY",
    expiresAt: "2099-12-01T00:00:00Z",
    qrUrl: "https://qr.example.invalid/order.png",
    transferContent: `SEVQR-${id}`,
    bank: { id: "TESTBANK", accountNumber: "12345", accountHolder: "Fixture" },
    plan: { ...plan, name: "Tên gói đã chốt" },
  };
}

const qrName = "Mã VietQR thanh toán gói hội viên";
const checkoutPath = "**/api/v1/payments/sepay/checkout";
const statusPath = "**/api/v1/payments/sepay/order-a";
const checkoutDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Chuyển khoản VietQR qua SePay" });

async function buyStandard(page: Page) {
  await page
    .getByRole("button", { name: "Chuyển khoản VietQR", exact: true })
    .first()
    .click();
}

for (const scenario of [
  {
    title: "renewal lets the backend calculate exact continuation",
    current: standard,
    target: standard,
    action: "Gia hạn qua VietQR",
    heading: "Gia hạn gói tập",
  },
  {
    title: "an immediate upgrade omits a scheduled start",
    current: standard,
    target: premium,
    action: "Nâng cấp qua VietQR",
    heading: "Nâng cấp gói tập",
  },
  {
    title: "a future upgrade includes local midnight with the Vietnam offset",
    current: standard,
    target: premium,
    action: "Nâng cấp qua VietQR",
    heading: "Nâng cấp gói tập",
    chosenDate: "2098-09-05",
    expectedStart: "2098-09-05T00:00:00+07:00",
  },
  {
    title:
      "downgrade on the expiry date preserves the exact activation instant",
    current: premium,
    target: standard,
    action: "Lên lịch gói (Hạ cấp)",
    heading: "Lên lịch gói tập tiếp theo (Hạ cấp)",
    expectedStart: expiry,
  },
]) {
  test(scenario.title, async ({ page }) => {
    await mockMembership(page, [paidSubscription(scenario.current)]);
    const payment = order(scenario.target);
    const writes: unknown[] = [];
    await page.route(checkoutPath, (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        json: { success: true, data: payment },
      });
    });
    await page.route(statusPath, (route) =>
      route.fulfill({ json: { success: true, data: payment } }),
    );
    await page.goto("/member/membership");
    await page
      .getByRole("button", { name: scenario.action, exact: true })
      .click();
    const transition = page.getByRole("dialog", { name: scenario.heading });
    await expect(transition).toBeVisible();
    expect(writes).toEqual([]);
    if (scenario.chosenDate) {
      await transition
        .getByRole("radio", { name: /Chọn ngày kích hoạt/ })
        .check();
      await transition.locator('input[type="date"]').fill(scenario.chosenDate);
    }
    await transition
      .getByRole("button", { name: "Tiếp tục tạo VietQR" })
      .click();
    await expect(
      checkoutDialog(page).getByRole("img", { name: qrName }),
    ).toBeVisible();
    expect(writes).toEqual([
      {
        planId: scenario.target.id,
        ...(scenario.expectedStart
          ? { startDate: scenario.expectedStart }
          : {}),
      },
    ]);
  });
}

test("closing an upgrade preview leaves the current plan and creates no checkout", async ({
  page,
}) => {
  await mockMembership(page, [paidSubscription()]);
  let writes = 0;
  await page.route(checkoutPath, (route) => {
    writes++;
    return route.abort();
  });
  await page.goto("/member/membership");
  await page.getByRole("button", { name: "Nâng cấp qua VietQR" }).click();
  const dialog = page.getByRole("dialog", { name: "Nâng cấp gói tập" });
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: standard.name, exact: true }).first(),
  ).toBeVisible();
  expect(writes).toBe(0);
});

test("QR shows the authoritative transfer amount and sold plan details", async ({
  page,
}) => {
  await mockMembership(page);
  const payment = order();
  await page.route(checkoutPath, (route) =>
    route.fulfill({ status: 201, json: { success: true, data: payment } }),
  );
  await page.route(statusPath, (route) =>
    route.fulfill({ json: { success: true, data: payment } }),
  );
  await page.goto("/member/membership");
  await buyStandard(page);
  const dialog = checkoutDialog(page);
  await expect(
    dialog.getByText("Tên gói đã chốt", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("320.000 VND", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    dialog.getByText(payment.transferContent, { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/không chuyển lại/)).toBeVisible();
});

test("an upcoming paid package disables purchase controls for every plan", async ({
  page,
}) => {
  await mockMembership(page, [
    paidSubscription(),
    paidSubscription(premium, "SCHEDULED"),
  ]);
  await page.goto("/member/membership");
  const actions = page.getByRole("button", {
    name: /Gia hạn qua VietQR|Nâng cấp qua VietQR/,
  });
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) await expect(action).toBeDisabled();
});

test("a checkout in progress disables other package payments until the server replies", async ({
  page,
}) => {
  await mockMembership(page);
  const payment = order();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writes: unknown[] = [];
  await page.route(checkoutPath, async (route) => {
    writes.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({
      status: 201,
      json: { success: true, data: payment },
    });
  });
  await page.route(statusPath, (route) =>
    route.fulfill({ json: { success: true, data: payment } }),
  );
  await page.goto("/member/membership");
  try {
    await buyStandard(page);
    await expect(
      page.getByRole("button", { name: "Đang tạo mã...", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Chuyển khoản VietQR", exact: true }),
    ).toBeDisabled();
    await expect.poll(() => writes).toEqual([{ planId: standard.id }]);
  } finally {
    release();
  }
  await expect(checkoutDialog(page)).toBeVisible();
});

test("an expired QR is hidden and retry opens only the new checkout", async ({
  page,
}) => {
  await mockMembership(page);
  const old = { ...order(), expiresAt: "2020-01-01T00:00:00Z" };
  const fresh = order(standard, "order-b");
  const writes: unknown[] = [];
  await page.route(checkoutPath, (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: { success: true, data: writes.length === 1 ? old : fresh },
    });
  });
  await page.route(statusPath, (route) =>
    route.fulfill({ json: { success: true, data: old } }),
  );
  await page.route("**/api/v1/payments/sepay/order-b", (route) =>
    route.fulfill({ json: { success: true, data: fresh } }),
  );
  await page.goto("/member/membership");
  await buyStandard(page);
  const dialog = checkoutDialog(page);
  await expect(
    dialog.getByText("Đơn thanh toán đã hết thời gian", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("img", { name: qrName })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tạo đơn mới" }).click();
  await expect(
    dialog.getByText(fresh.transferContent, { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(old.transferContent, { exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([{ planId: standard.id }, { planId: standard.id }]);
});

test("a completed refund takes precedence over the original activation review", async ({
  page,
}) => {
  await mockMembership(page);
  const payment = order();
  await page.route(checkoutPath, (route) =>
    route.fulfill({ status: 201, json: { success: true, data: payment } }),
  );
  await page.route(statusPath, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...payment,
          status: "REFUNDED",
          activationStatus: "REQUIRES_REVIEW",
          requiresReview: true,
          reviewReason: "LATE_PAYMENT",
        },
      },
    }),
  );
  await page.goto("/member/membership");
  await buyStandard(page);
  const dialog = checkoutDialog(page);
  await expect(
    dialog.getByText("Giao dịch đã hoàn tiền", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Đã nhận thanh toán — đang đối soát", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: qrName })).toHaveCount(0);
});
