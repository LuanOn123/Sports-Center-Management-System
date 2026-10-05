import { test, expect } from "@playwright/test";

test("reset flow handles invalid OTP, resend and success on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let sends = 0;
  let resets = 0;
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().postDataJSON()).toEqual({
      email: "member@example.com",
    });
    sends++;
    await route.fulfill({
      json: {
        success: true,
        data: null,
        message: "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi.",
      },
    });
  });
  await page.route("**/api/v1/auth/reset-password", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().postDataJSON()).toEqual({
      email: "member@example.com",
      otp: resets ? "012345" : "111111",
      newPassword: "NewPass@123",
    });
    resets++;
    await route.fulfill({
      status: resets === 1 ? 400 : 200,
      json: {
        success: resets > 1,
        data: null,
        message:
          resets === 1
            ? "OTP không hợp lệ hoặc đã hết hạn."
            : "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.",
      },
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Quên mật khẩu?" }),
  ).toBeVisible();
<<<<<<< HEAD
>>>>>>> develop
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
  await page.getByLabel("Email", { exact: true }).fill("Member@example.com");
  await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).click();
  await expect(page.getByRole("timer")).toContainText(/(?:5:00|4:\d{2})/);
  await page.getByLabel("Mã OTP", { exact: true }).fill("111111");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewPass@123");
  await page
    .getByLabel("Xác nhận mật khẩu mới", { exact: true })
    .fill("different");
  await page
    .getByRole("button", { name: "Đặt lại mật khẩu", exact: true })
    .click();
  await expect(
    page.getByText("Mật khẩu xác nhận chưa khớp.", { exact: true }),
  ).toBeVisible();
  expect(resets).toBe(0);
  await page
    .getByLabel("Xác nhận mật khẩu mới", { exact: true })
    .fill("NewPass@123");
  await page
    .getByRole("button", { name: "Đặt lại mật khẩu", exact: true })
    .click();
  await expect(
    page
      .getByText("OTP không hợp lệ hoặc đã hết hạn.", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gửi lại OTP", exact: true }).click();
  await expect(page.getByLabel("Mã OTP", { exact: true })).toHaveValue("");
  expect(sends).toBe(2);
  await page.getByLabel("Mã OTP", { exact: true }).fill("012345");
  await page
    .getByRole("button", { name: "Đặt lại mật khẩu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText(
      "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("unknown email advances, countdown expires and resend restarts it", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/v1/auth/forgot-password", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: null,
        message: "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi.",
      },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("unknown@example.com");
  await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).click();
  await expect(page.getByLabel("Mã OTP", { exact: true })).toBeVisible();
  await page.clock.fastForward(301000);
  await expect(page.getByRole("timer")).toContainText("đã hết hạn");
  await page.getByRole("button", { name: "Gửi lại OTP", exact: true }).click();
  await expect(page.getByRole("timer")).toContainText("5:00");
  await page.getByRole("button", { name: "Đổi email", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeEditable();
});

test("send failure stays on email step and supports retry", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/forgot-password", (route) =>
    route.fulfill({
      status: 400,
      json: {
        success: false,
        message: "Validation failed",
        errors: [{ field: "email", message: "Invalid email address" }],
      },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("user@example.com");
  await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeEditable();
  await expect(page.getByLabel("Mã OTP", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Gửi mã OTP", exact: true }),
  ).toBeEnabled();
});
