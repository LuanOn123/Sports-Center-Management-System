import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const [role, base] of [["MANAGER", "manager"], ["STAFF", "receptionist"], ["COACH", "coach"], ["MEMBER", "member"]]) {
  for (const width of [375, 1440]) {
    test(`${role} navbar stays at the top after scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 500 });
      await setup(page, role);
      await page.goto(`/${base}/dashboard`);
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await expect.poll(() => page.locator(".topbar").evaluate(node => node.getBoundingClientRect().top)).toBe(0);
      await page.locator(".notification-bell > button").click();
      await expect(page.getByRole("region", { name: "Thông báo gần đây" })).toBeInViewport();
      await page.keyboard.press("Escape");
      if (width < 768) {
        await page.getByRole("button", { name: "Mở menu", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Điều hướng chính" })).toBeVisible();
        await page.getByRole("button", { name: "Đóng menu", exact: true }).click();
      }
    });
  }
}

for (const width of [375, 1440]) {
  test(`member scroll boundaries keep the dark canvas at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await setup(page, "MEMBER");
    await page.goto("/member/classes");
    await expect(page.locator("main h1")).toBeVisible();
    await page.mouse.move(width - 30, 350);
    for (const edge of ["bottom", "top"]) {
      await page.evaluate(edge => window.scrollTo(0, edge === "top" ? 0 : document.documentElement.scrollHeight), edge);
      await page.mouse.wheel(0, edge === "top" ? -2000 : 2000);
      const canvas = await page.evaluate(() => ({
        root: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        theme: getComputedStyle(document.querySelector(".member-theme")!).backgroundColor,
        overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
      }));
      expect(canvas.root).toBe(canvas.theme);
      expect(canvas.body).toBe(canvas.theme);
      expect(canvas.overscroll).toBe("none");
    }
    await expect.poll(() => page.locator(".topbar").evaluate(node => node.getBoundingClientRect().top)).toBe(0);
    await page.screenshot({ path: `artifacts/scroll/member-top-${width}.png` });
  });

  test(`long chat stays readable while scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await setup(page, "MEMBER");
    for (const endpoint of ["contacts", "conversations"]) {
      await page.route(`**/api/v1/chat/${endpoint}`, route =>
        route.fulfill({ json: { success: true, data: [] } }),
      );
    }
    await page.route("**/api/v1/chat/messages", route => route.fulfill({
      json: { success: true, data: Array.from({ length: 40 }, (_, index) => ({
        id: `message-${index}`, senderId: "member",
        content: `Tin ${index}: ${"Nội dung lịch tập cần được hiển thị đầy đủ. ".repeat(8)}`,
        createdAt: "2026-10-02T08:00:00Z",
      })) },
    }));
    await page.goto("/member/membership");
    await page.getByRole("button", { name: "Mở tin nhắn", exact: true }).click();
    const log = page.getByRole("log", { name: "Lịch sử trò chuyện" });
    const messages = log.locator("article");
    await expect(messages).toHaveCount(40);
    expect(await messages.evaluateAll(nodes => nodes.every(node =>
      node.scrollHeight <= node.clientHeight + 1,
    ))).toBe(true);
    expect(await log.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await log.evaluate(node => { node.style.scrollBehavior = "auto"; node.scrollTop = 0; });
    await expect(messages.first()).toBeInViewport();
    await log.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect(messages.last()).toBeInViewport();
    await expect(page.getByRole("textbox", { name: "Nội dung", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
