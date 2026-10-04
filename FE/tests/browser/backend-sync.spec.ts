import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";
const userId = "670123abc456def789012345";
const memberId = "670123abc456def789012346";

test("Mongo member IDs support login/profile and removed modules make no requests", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  await page.addInitScript(() => sessionStorage.removeItem("pulse.access"));
  const removed: string[] = [];
  page.on("request", (request) => {
    if (/\/training-plans|\/ai\/generate-training-plan/.test(request.url()))
      removed.push(request.url());
  });
  await page.route("**/api/v1/auth/login", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      email: "member@example.test",
      password: "password123",
    });
    return route.fulfill({
      json: {
        success: true,
        data: { accessToken: "mongo-access", refreshToken: "mongo-refresh" },
      },
    });
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer mongo-access");
    return route.fulfill({
      json: {
        success: true,
        data: {
          id: userId,
          role: "MEMBER",
          email: "member@example.test",
          fullName: "Mongo Member",
          isActive: true,
          memberProfile: { id: memberId, userId, status: "ACTIVE" },
        },
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("member@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/member\/dashboard$/);
  await expect(
    page.getByRole("link", { name: "Mục tiêu tập luyện", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Tạo Lịch Tập Thông Minh/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(page.getByLabel("Họ và tên", { exact: false })).toHaveValue(
    "Mongo Member",
  );
  expect(removed).toEqual([]);
});

test("deployment clears old identities before any authenticated request and keeps new sessions after reload", async ({
  page,
}) => {
  const meRequests: string[] = [];
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("test-seeded")) {
      sessionStorage.setItem("test-seeded", "true");
      sessionStorage.setItem("pulse.access", "uuid-access");
      sessionStorage.setItem("pulse.refresh", "uuid-refresh");
      localStorage.setItem("pulse.user", '{"id":"old-uuid"}');
    }
  });
  await page.route("**/api/v1/auth/me", (route) => {
    meRequests.push(route.request().url());
    return route.fulfill({
      status: 401,
      json: { success: false, message: "Unauthorized" },
    });
  });
  await page.goto("/member/dashboard");
  await expect(
    page.getByRole("heading", { name: "Sẵn sàng giữ nhịp?" }),
  ).toBeVisible();
  expect(meRequests).toEqual([]);
  expect(
    await page.evaluate(() => [
      sessionStorage.getItem("pulse.access"),
      sessionStorage.getItem("pulse.refresh"),
      localStorage.getItem("pulse.user"),
    ]),
  ).toEqual([null, null, null]);
  await page.evaluate(() =>
    sessionStorage.setItem("pulse.access", "new-mongo-token"),
  );
  await page.reload();
  await expect.poll(() => meRequests.length).toBe(1);
});
