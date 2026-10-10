import { test, expect } from "@playwright/test";
import fs from "node:fs";
const doc = JSON.parse(fs.readFileSync("docs/openapi.json", "utf8"));
// Fixtures exist only inside tests; production never loads Swagger example data.
async function fixtureApi(page: any, role = "MANAGER") {
  await page.route(
    "https://sports-center-management-system.onrender.com/api/v1/**",
    async (route: any) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/v1", "");
    if (path === "/facilities") return route.fulfill({ json: { success: true, data: [{ id: "facility-a", code: "A", name: "Cơ sở A", isActive: true }] } });
    if (path === "/facilities/facility-a") return route.fulfill({ json: { success: true, data: { name: "Cơ sở A", staffs: [] } } });
      const method = route.request().method().toLowerCase();
      const operation = doc.paths[path]?.[method];
      if (!operation) {
        await route.fulfill({
          status: 404,
          json: { success: false, message: "No test fixture for " + path },
        });
        return;
      }
      if (
        path === "/notifications/unread-count" ||
        path === "/chat/messages/unread-count"
      ) {
        await route.fulfill({
          json: { success: true, message: "", data: { unreadCount: 0 } },
        });
        return;
      }
      if (
        path === "/notifications" ||
        path === "/chat/contacts" ||
        path === "/chat/conversations" ||
        path === "/chat/messages"
      ) {
        await route.fulfill({
          json: { success: true, message: "", data: [] },
        });
        return;
      }
      const response: any = Object.entries(operation.responses).find(([code]) =>
        code.startsWith("2"),
      )?.[1];
      if (!response?.$ref) return route.fulfill({ json: { success: true, data: [] } });
      const schema = doc.components.responses[response.$ref.split("/").pop()];
      const payload = structuredClone(
        schema.content["application/json"].schema.example,
      );
      if (path === "/auth/me") payload.data.role = role;
      await route.fulfill({ json: payload });
    },
  );
}
test("real login screen is responsive and password visibility works", async ({
  page,
}) => {
  await page.goto("/manager/dashboard");
  await expect(
    page.getByRole("heading", { name: "Sẵn sàng giữ nhịp?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(page.getByPlaceholder("Nhập mật khẩu")).toHaveAttribute(
    "type",
    "text",
  );
  await page.screenshot({
    path: "artifacts/login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: "artifacts/login-mobile.png", fullPage: true });
});
test("manager routes, real-schema forms and mobile navigation render", async ({
  page,
}) => {
  test.setTimeout(120000);
  await fixtureApi(page);
  await page.goto("/login");
  await page.getByPlaceholder("Email của bạn").fill("manager@example.test");
  await page.getByPlaceholder("Nhập mật khẩu").fill("test-only-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tổng quan cơ sở" }),
  ).toBeVisible();
  await expect(
    page.getByText("900.000", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Thông báo gần đây" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await page.getByRole("button", { name: "Mở tin nhắn" }).click();
  await expect(
    page.getByRole("region", { name: "Cửa sổ tin nhắn" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng tin nhắn" }).first().click();
  await page.screenshot({
    path: "artifacts/dashboard-test-fixtures.png",
    fullPage: true,
  });
  for (const slug of [
    "members",
    "coaches",
    "staff",
    "membership-plans",
    "sports",
    "rooms",
    "classes",
    "schedules",
    "activity-planner",
    "reports",
    "roles",
    "audit-logs",
    "profile",
  ]) {
    await page.goto("/manager/" + slug);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Không tìm thấy trang")).toHaveCount(0);
  }
  await page.goto("/manager/activity-planner");
  await expect(page).toHaveURL(/\/manager\/schedules$/);
  await expect(page.getByRole("heading", { name: "Lịch hoạt động", exact: true })).toBeVisible();
  await page.goto("/manager/rooms");
  await page
    .getByRole("button", { name: "Thêm phòng tập", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Tên").fill("Test Room");
  await page.getByRole("dialog").getByLabel("Sức chứa").fill("12");
  const sent = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/rooms"),
  );
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  expect((await sent).postDataJSON()).toEqual({
    name: "Test Room",
    capacity: 12,
    areaType: "INDOOR",
  });
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Đã lưu thay đổi",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Lịch hoạt động", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Lịch hoạt động");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
test("member cannot enter manager routes", async ({ page }) => {
  await fixtureApi(page, "MEMBER");
  await page.goto("/manager/dashboard");
  await page.getByPlaceholder("Email của bạn").fill("member@example.test");
  await page.getByPlaceholder("Nhập mật khẩu").fill("test-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/member\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Tổng quan hội viên", exact: true }),
  ).toBeVisible();
  await page.goto("/manager/dashboard");
  await expect(
    page.getByRole("heading", { name: "Không có quyền truy cập" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tổng quan", exact: true }),
  ).toHaveCount(0);
});
test("API errors are visible and retry restores the list", async ({ page }) => {
  await fixtureApi(page);
  await page.addInitScript(() => {
    (sessionStorage.setItem("pulse.identity-version", "mongo-identities-v1"),
      sessionStorage.setItem("pulse.access", "test-only"));
  });
  let fail = true;
  await page.route("**/api/v1/rooms?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 500,
        json: { success: false, message: "Test server error" },
      });
    else await route.fallback();
  });
  await page.goto("/manager/rooms");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Test server error",
  );
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("button", { name: "Xem chi tiết", exact: true }).first()).toBeVisible();
});
