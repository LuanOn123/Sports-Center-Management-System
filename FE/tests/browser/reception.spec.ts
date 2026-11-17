import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";
const memberId = "aecd9439-82e2-47da-90a2-2830bbe04dc4";
async function chooseMember(page: Page) {
  await page.getByRole("button", { name: "Chọn", exact: true }).first().click();
}
for (const [role, home, title] of [
  ["RECEPTIONIST", "/receptionist", "Tổng quan lễ tân"],
  ["COACH", "/coach", "Tổng quan huấn luyện viên"],
  ["MEMBER", "/member", "Tổng quan hội viên"],
]) {
  test(
    role + " lands in its own portal and cannot open manager",
    async ({ page }) => {
      await setup(page, role);
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(home + "/dashboard$"));
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await page.goto("/manager/users");
      await expect(
        page.getByRole("heading", { name: "Không có quyền truy cập" }),
      ).toBeVisible();
    },
  );
}
test("staff registers member through public registration without changing session", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/receptionist/members/create");
  await page.getByLabel("Email").fill("new@example.test");
  await page.getByLabel("Mật khẩu", { exact: false }).fill("test-password");
  await page.getByLabel("Họ và tên").fill("Hội viên mới");
  await page.getByLabel("Số điện thoại").fill("0901234567");
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/auth/register"),
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    email: "new@example.test",
    fullName: "Hội viên mới",
  });
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Đã tạo tài khoản",
  );
  expect(
    await page.evaluate(() => sessionStorage.getItem("pulse.access")),
  ).toBe("fixture-token");
});
test("membership registration and renewal use the selected profile and subscription", async ({
  page,
}) => {
  await setup(page);
  let firstAttempt = true;
  await page.route("**/api/v1/subscriptions", (route) => {
    if (route.request().method() !== "POST" || !firstAttempt) return route.fallback();
    firstAttempt = false;
    return route.fulfill({
      status: 503,
      json: { success: false, message: "Chưa nhận được phản hồi giao dịch." },
    });
  });
  await page.goto("/receptionist/membership");
  await chooseMember(page);
  await page.getByRole("button", { name: "Đăng ký gói", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Gói tập")
    .selectOption({ index: 1 });
  await page
    .getByRole("dialog")
    .getByLabel("Phương thức thanh toán")
    .selectOption("CASH");
  const sent = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/subscriptions"),
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  const initialSale = (await sent).postDataJSON();
  expect(initialSale).toMatchObject({
    memberId,
    paymentMethod: "CASH",
    requestId: expect.stringMatching(/^[\da-f-]{36}$/i),
  });
  await expect(page.getByRole("dialog").locator(".error-state")).toContainText(
    "Chưa nhận được phản hồi giao dịch.",
  );
  const retry = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/subscriptions"),
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await retry).postDataJSON().requestId).toBe(initialSale.requestId);
  await expect(page.getByRole("region", { name: "Thông báo thao tác" }).getByRole("status")).toContainText(
    "thành công",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Gia hạn", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Gói tập")
    .selectOption({ index: 1 });
  await page
    .getByRole("dialog")
    .getByLabel("Phương thức thanh toán")
    .selectOption("BANK_TRANSFER");
  const renewal = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/renew"),
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await renewal).postDataJSON()).toMatchObject({
    paymentMethod: "BANK_TRANSFER",
    requestId: expect.stringMatching(/^[\da-f-]{36}$/i),
  });
  expect((await renewal).postDataJSON().requestId).not.toBe(initialSale.requestId);
});
test("booking uses member profile and schedule; cancellation requires confirmation", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/receptionist/classes");
  await chooseMember(page);
  await page.getByRole("button", { name: "Xem đăng ký" }).first().click();
  await page.getByRole("button", { name: /^Đăng ký cho / }).click();
  const booking = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/enrollments"),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đăng ký", exact: true })
    .click();
  expect((await booking).postDataJSON()).toMatchObject({
    memberId,
    scheduleId: expect.any(String),
  });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Hủy đăng ký", exact: true })
    .first()
    .click();
  const cancel = page.waitForRequest(
    (r) => r.method() === "DELETE" && r.url().includes("/enrollments/"),
  );
  await page
    .getByRole("button", { name: "Xác nhận hủy đăng ký", exact: true })
    .click();
  expect((await cancel).url()).toContain(
    "6b6b6b6b-0000-4000-8000-000000000201",
  );
});
test("cashier records collection against an existing counter order once", async ({
  page,
}) => {
  await setup(page);
  let status = "PENDING";
  const confirmations: unknown[] = [];
  await page.route("**/api/v1/counter-orders", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: "order-1", name: "Gói hội viên tại quầy", amount: 300000, status }],
      },
    }),
  );
  await page.route("**/api/v1/counter-orders/order-1/confirm", (route) => {
    expect(route.request().method()).toBe("POST");
    confirmations.push(route.request().postDataJSON());
    status = "SUCCESS";
    return route.fulfill({ json: { success: true, data: { status } } });
  });

  await page.goto("/receptionist/orders");
  const confirm = page.getByRole("button", { name: "Xác nhận đã thu tiền" });
  await confirm.click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Lưu thay đổi" });
  await save.click();
  await expect(dialog.getByLabel("Lý do")).toBeFocused();
  expect(confirmations).toEqual([]);

  const reason = "Đã thu đủ 300000 VND tại quầy";
  await dialog.getByLabel("Lý do").fill(reason);
  await save.click();
  await expect(dialog).toBeHidden();
  await expect(confirm).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Gói hội viên tại quầy" })).toBeVisible();
  await expect(confirm).toHaveCount(0);
  expect(confirmations).toEqual([{ reason }]);
});

test("cashier can look up and print an existing invoice without a manual payment action", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/receptionist/payments");
  await page.getByRole("button", {
    name: "Tra cứu thanh toán & hóa đơn theo hội viên",
    exact: true,
  }).click();
  await chooseMember(page);
  await page.getByRole("button", { name: "Xem / In hóa đơn" }).first().click();
  await expect(page.getByRole("button", { name: "Ghi nhận thanh toán", exact: true })).toHaveCount(0);
  await expect(page.locator(".invoice-print")).toContainText("INV-");
  await page.emulateMedia({ media: "print" });
  expect(
    await page
      .locator(".invoice-print")
      .evaluate((e) => getComputedStyle(e).visibility),
  ).toBe("visible");
  expect(
    await page
      .locator(".invoice-print")
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThan(0);
});
test("reception mobile navigation and unavailable features never call invented endpoints", async ({
  page,
}) => {
  await setup(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1")) calls.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/receptionist/dashboard");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Lịch lớp học", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lịch hoạt động", exact: true }),
  ).toBeVisible();
  await page.goto("/receptionist/support");
  await expect(
    page.getByRole("heading", { name: "Yêu cầu hỗ trợ", exact: true }),
  ).toBeVisible();
  expect(calls.some((p) => /\/api\/v1\/(checkin|support)(\/|\?|$)/.test(p))).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/reception-mobile.png",
    fullPage: true,
  });
});
