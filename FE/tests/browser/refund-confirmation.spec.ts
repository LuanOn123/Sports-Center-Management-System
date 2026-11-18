import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("Reception cancels a pending refund with a required reason and refreshes the queue", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  const requests: unknown[] = [];
  await page.route(/\/api\/v1\/payments\?/, (route) => route.fulfill({ json: {
    success: true, data: requests.length ? [] : [{ id: "refund-to-cancel", status: "SUCCESS", refundRequestedAmount: 90000 }],
  } }));
  await page.route("**/api/v1/payments/refund-to-cancel/refund/cancel", (route) => {
    expect(route.request().method()).toBe("POST");
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: { id: "refund-to-cancel" } } });
  });
  await page.goto("/receptionist/payments");
  await page.getByRole("button", { name: "Hủy yêu cầu hoàn", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Xác nhận hủy yêu cầu" })).toBeDisabled();
  await dialog.getByRole("textbox").fill("   ");
  await expect(dialog.getByRole("button", { name: "Xác nhận hủy yêu cầu" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Quay lại" }).click();
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "Hủy yêu cầu hoàn", exact: true }).click();
  await dialog.getByRole("textbox").fill("  Hội viên gửi nhầm yêu cầu  ");
  await dialog.getByRole("button", { name: "Xác nhận hủy yêu cầu" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Hiện không có yêu cầu hoàn tiền nào đang chờ xử lý.")).toBeVisible();
  expect(requests).toEqual([{ reason: "Hội viên gửi nhầm yêu cầu" }]);
});

test("Reception loads the pending refund queue with the documented filter", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  await page.route(/\/api\/v1\/payments\?/, (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("refundPending") !== "true") return route.fallback();
    return route.fulfill({
      json: {
        success: true,
        data: [{ id: "pending-refund-1", amount: 300000, refundRequestedAmount: 300000 }],
      },
    });
  });
  await page.goto("/receptionist/payments");
  await expect(page.getByText("pending-refund-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Xác nhận hoàn/ })).toBeEnabled();
});

test("Reception retains the cancellation reason when another user has already processed the refund", async ({ page }) => {
  await setup(page, "RECEPTIONIST");
  await page.route(/\/api\/v1\/payments\?/, (route) => route.fulfill({ json: {
    success: true, data: [{ id: "processed-refund", refundRequestedAmount: 90000 }],
  } }));
  await page.route("**/api/v1/payments/processed-refund/refund/cancel", (route) => route.fulfill({
    status: 409, json: { success: false, message: "Yêu cầu đã được xử lý. Vui lòng tải lại." },
  }));
  await page.goto("/receptionist/payments");
  await page.getByRole("button", { name: "Hủy yêu cầu hoàn", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Hội viên gửi nhầm yêu cầu");
  await dialog.getByRole("button", { name: "Xác nhận hủy yêu cầu" }).click();
  await expect(dialog.locator("fieldset").getByText("Yêu cầu đã được xử lý. Vui lòng tải lại.")).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue("Hội viên gửi nhầm yêu cầu");
});

for (const hasReceptionist of [true, false]) {
test(`member requests a refund with receptionist available: ${hasReceptionist}`, async ({ page }) => {
  await page.setViewportSize({ width: hasReceptionist ? 1280 : 375, height: 900 });
  await setup(page, "MEMBER");
  const receptionist = { id: "reception-a", fullName: "Lễ tân Mai", role: "RECEPTIONIST" };
  const requests: unknown[] = [];
  const payment = () => ({
    id: "paid-payment",
    amount: 300000,
    status: "SUCCESS",
    refundRequestedAt: requests.length ? "2026-11-17T08:00:00Z" : null,
  });

  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: "member-user",
          role: "MEMBER",
          fullName: "Nguyễn Lan",
          isActive: true,
          memberProfile: { id: "member-1" },
        },
      },
    }),
  );
  await page.route("**/api/v1/invoices/member/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "invoice-1",
            invoiceNumber: "INV-PAID",
            status: "ISSUED",
            total: 300000,
            paymentId: "paid-payment",
            payment: payment(),
          },
          {
            id: "invoice-2",
            invoiceNumber: "INV-PENDING",
            paymentId: "pending-payment",
            payment: { id: "pending-payment", status: "PENDING" },
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/payments/paid-payment", (route) =>
    route.fulfill({ json: { success: true, data: payment() } }),
  );
  await page.route("**/api/v1/payments/paid-payment/refund/request", (route) => {
    expect(route.request().method()).toBe("POST");
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, data: { refundReceptionist: hasReceptionist ? receptionist : null } } });
  });
  await page.route("**/api/v1/chat/contacts", (route) =>
    route.fulfill({ json: { success: true, data: [receptionist] } }),
  );
  await page.route(/\/api\/v1\/chat\/messages(?:\?|$)/, (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );

  await page.goto("/member/payments");
  const row = page.getByRole("row", { name: /INV-PAID/ });
  const refund = row.getByRole("button", { name: "Yêu cầu hoàn tiền" });
  await expect(refund).toBeVisible();
  const tops = await row.getByRole("button").evaluateAll(
    (buttons) => buttons.map((button) => button.getBoundingClientRect().top),
  );
  expect(tops).toHaveLength(3);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(
    page.getByRole("row", { name: /INV-PENDING/ }).getByRole("button", {
      name: "Yêu cầu hoàn tiền",
    }),
  ).toHaveCount(0);

  await row.getByRole("button", { name: "Chi tiết thanh toán" }).click();
  const details = page.getByRole("dialog", { name: "Chi tiết thanh toán" });
  await expect(details.getByText("300.000", { exact: false })).toBeVisible();
  await expect(details.getByRole("button", { name: /hoàn tiền/ })).toHaveCount(0);
  await details.getByRole("button", { name: "Đóng", exact: true }).click();

  await refund.click();
  const dialog = page.getByRole("dialog", { name: "Yêu cầu hoàn tiền" });
  await dialog
    .getByRole("textbox", { name: /Lý do yêu cầu hoàn tiền/ })
    .fill("Không tiếp tục tập");
  await dialog.getByRole("button", { name: "Gửi yêu cầu hoàn tiền" }).click();
  const chat = dialog.getByRole("link", { name: "Nhắn tin với lễ tân" });
  if (hasReceptionist) {
    await chat.click();
    await expect(page).toHaveURL(/\/member\/chat\?userId=reception-a/);
    await expect(page.getByRole("textbox", { name: "Nội dung", exact: true })).toHaveValue(/Chào Lễ tân Mai/);
    const send = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/chat/messages"));
    await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    expect((await send).postData()).toMatch(/name="receiverId"\r\n\r\nreception-a/);
  } else {
    await expect(dialog.getByText(/Không có lễ tân phụ trách hoàn tiền/)).toBeVisible();
    await expect(chat).toHaveCount(0);
    await dialog.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(refund).toHaveCount(0);
  }
  expect(requests).toEqual([{ reason: "Không tiếp tục tập" }]);
});
}

test("Admin can refund a late SePay transfer without being offered activation", async ({ page }) => {
  await setup(page, "ADMIN");
  let approved = false, refunded = false;
  const writes: unknown[] = [];
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    if (request.method() === "POST" && path.startsWith("/payments/review-1/refund/")) {
      writes.push({ path, body: request.postDataJSON() });
      if (path.endsWith("/request")) approved = true;
      else refunded = true;
      return route.fulfill({ json: { success: true, data: {} } });
    }
    if (path === "/members") return route.fulfill({ json: { success: true, data: [
      { id: "member-1", user: { fullName: "Nguyễn Lan", email: "lan@example.invalid" } },
    ] } });
    if (path === "/payments") {
      const pendingOnly = url.searchParams.get("refundPending") === "true";
      return route.fulfill({ json: { success: true, data: pendingOnly && (!approved || refunded) ? [] : [
      { id: "review-1", amount: 300000, status: refunded ? "REFUNDED" : "SUCCESS", gateway: "SEPAY",
        activationStatus: "REQUIRES_REVIEW", reviewReason: "LATE_PAYMENT", subscriptionId: null,
        refundRequestedAt: approved ? "2026-11-01T00:00:00Z" : null, refundRequestedAmount: approved ? 300000 : null },
      ] } });
    }
    if (path.startsWith("/invoices/member/")) return route.fulfill({ json: { success: true, data: [] } });
    return route.fallback();
  });
  await page.goto("/admin/payments");
  await expect(page.getByText("Hiện không có yêu cầu hoàn tiền nào đang chờ xử lý.")).toBeVisible();
  await page.getByRole("button", { name: "Tra cứu thanh toán & hóa đơn theo hội viên", exact: true }).click();
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cần đối soát — chưa kích hoạt gói" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử kích hoạt lại", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Xác nhận hoàn/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Duyệt hoàn tiền chưa cấp gói", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Duyệt yêu cầu hoàn tiền", exact: true })).toBeDisabled();
  await dialog.getByLabel("Lý do duyệt hoàn").fill("Không thể cấp gói cho giao dịch này");
  await dialog.getByRole("button", { name: "Duyệt yêu cầu hoàn tiền", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Thử kích hoạt lại", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Yêu cầu hoàn tiền cần xử lý/ }).click();
  await page.getByRole("button", { name: /^Xác nhận hoàn/ }).click();
  await dialog.getByLabel("Mã biên nhận / chuyển khoản").fill("REFUND-AUDIT-01");
  await dialog.getByLabel("Lý do", { exact: true }).fill("Đã chuyển trả tiền thực tế");
  await dialog.getByRole("button", { name: "Xác nhận đã trả tiền", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Hiện không có yêu cầu hoàn tiền nào đang chờ xử lý.")).toBeVisible();
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
  await page.getByRole("button", { name: "Tra cứu thanh toán & hóa đơn theo hội viên", exact: true }).click();
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
  await page.getByRole("button", { name: "Tra cứu thanh toán & hóa đơn theo hội viên", exact: true }).click();
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

test("Admin retains the local subscriptions navigation with the main cancellation flow", async ({ page }) => {
  await setup(page, "ADMIN");
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/members") return route.fulfill({ json: { success: true, data: [
      { id: "member-1", user: { fullName: "Nguyễn Lan", email: "lan@example.invalid" } },
    ] } });
    if (path === "/subscriptions/member/member-1") return route.fulfill({ json: { success: true, data: [
      { id: "sub-1", status: "ACTIVE", tier: "MEMBERSHIP", startDate: "2026-01-01T00:00:00Z", endDate: "2099-12-31T00:00:00Z",
        payments: [{ status: "SUCCESS", amount: 300000, durationDaysSnapshot: 30 }],
        plan: { name: "Gói demo", price: 800000, durationDays: 30 } },
    ] } });
    if (path === "/membership-plans") return route.fulfill({ json: { success: true, data: [] } });
    return route.fallback();
  });
  await page.goto("/admin/subscriptions");
  await expect(page.getByRole("link", { name: "Gói hội viên đã mua", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gói thành viên", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await page.getByRole("button", { name: "Hủy gói", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xác nhận hủy gói tập", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("300.000");
  await expect(page.getByRole("dialog")).not.toContainText("800.000");
});
