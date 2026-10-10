import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const [role, base] of [
  ["MANAGER", "manager"],
  ["RECEPTIONIST", "receptionist"],
  ["MEMBER", "member"],
  ["COACH", "coach"],
]) {
  for (const width of [375, 1440]) {
    test(`notification popover follows ${role} theme at ${width}`, async ({
      page,
    }) => {
      await setup(page, role);
      await page.setViewportSize({ width, height: 900 });
      let isRead = false;
      await page.route("**/api/v1/notifications**", async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() === "PATCH") {
          isRead = true;
          return route.fulfill({ json: { success: true, data: null } });
        }
        return route.fulfill({
          json: {
            success: true,
            data: url.pathname.endsWith("unread-count")
              ? { unreadCount: isRead ? 0 : 1 }
              : [
                  {
                    id: "notice-1",
                    title: "Cập nhật lịch học",
                    body:
                      "Thông tin buổi tập. ".repeat(20) +
                      "Vui lòng đến phòng B.",
                    isRead,
                    createdAt: new Date().toISOString(),
                  },
                ],
          },
        });
      });
      await page.goto(`/${base}/dashboard`);
      const trigger = page.getByRole("button", {
        name: "1 thông báo chưa đọc",
        exact: true,
      });
      await trigger.click();
      const panel = page.getByRole("region", { name: "Thông báo gần đây" });
      await expect(panel).toBeFocused();
      const item = panel.getByRole("button", { name: /Cập nhật lịch học/ });
      await item.click();
      await expect(item).toHaveAttribute("aria-expanded", "true");
      await expect(
        panel.getByText("0 chưa đọc", { exact: true }),
      ).toBeVisible();
      const colors = await item.evaluate((el) => ({
        text: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
      expect(colors.text).not.toBe(colors.background);
      if (role === "MEMBER")
        expect(colors.background).not.toBe("rgb(255, 255, 255)");
      expect(
        await panel.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.left >= 0 &&
            box.right <= innerWidth &&
            el.scrollWidth <= el.clientWidth + 1
          );
        }),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .include(".notification-popover")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/heuristics/notifications-${role}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(panel).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Thông báo", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Thông báo", exact: true })
        .click();
      await panel.getByRole("link", { name: "Xem tất cả thông báo" }).click();
      await expect(page).toHaveURL(new RegExp(`/${base}/notifications$`));
    });
  }
  test(`help is searchable and opens permitted ${role} tasks`, async ({
    page,
  }) => {
    await setup(page, role);
    await page.goto(`/${base}/dashboard`);
    await page
      .getByRole("button", { name: "Hướng dẫn sử dụng", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Hướng dẫn sử dụng" });
    await dialog
      .getByRole("searchbox", { name: "Tìm hướng dẫn" })
      .fill("xyznotfound");
    await expect(dialog.getByRole("status")).toContainText("Không tìm thấy");
    await dialog.getByRole("searchbox", { name: "Tìm hướng dẫn" }).fill("");
    await dialog.locator("summary").first().click();
    await expect(
      dialog.getByRole("link", { name: "Mở chức năng" }),
    ).toHaveAttribute("href", new RegExp(`^/${base}/`));
    await dialog.getByRole("link", { name: "Mở chức năng" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("main h1").first()).toBeVisible();
  });
}

test("staff confirms bulk reminders and can cancel without sending", async ({
  page,
}) => {
  await setup(page, "RECEPTIONIST");
  let writes = 0;
  await page.route(
    "**/api/v1/notifications/trigger-upcoming-reminders",
    async (route) => {
      writes++;
      return route.fulfill({ json: { success: true, data: { sent: 3 } } });
    },
  );
  await page.goto("/receptionist/notifications");
  await page
    .getByRole("button", { name: "Gửi nhắc lịch", exact: true })
    .click();
  expect(writes).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  expect(writes).toBe(0);
  await page
    .getByRole("button", { name: "Gửi nhắc lịch", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận gửi" })
    .click();
  await expect(
    page.getByText("Đã gửi 3 thông báo.", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
});

test("manager clears filters and sees browser offline state", async ({
  page,
  context,
}) => {
  await setup(page, "MANAGER");
  await page.goto("/manager/classes");
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.getByLabel("Tìm kiếm", { exact: true })).toHaveValue("");
  await context.setOffline(true);
  await expect(page.locator(".connection-status")).toContainText(
    "Bạn đang ngoại tuyến",
  );
  await context.setOffline(false);
  await expect(page.locator(".connection-status")).toHaveCount(0);
});
