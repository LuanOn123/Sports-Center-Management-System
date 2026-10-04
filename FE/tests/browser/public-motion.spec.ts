import { test, expect } from "@playwright/test";

test("auth motion keeps floating fields usable and transitions between forms", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await password.fill("test-password");
  await page.getByRole("heading", { level: 1 }).click();
  const label = page.locator('label[for="login-password"]');
  await expect
    .poll(() => label.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.locator(".auth-form-wrap")).toHaveCSS(
    "backdrop-filter",
    "blur(18px)",
  );
  await page.getByRole("button", { name: "Tạm dừng hiệu ứng" }).click();
  await expect(page.locator(".pulse-auth")).toHaveAttribute(
    "data-motion",
    "paused",
  );
  await expect(page.locator(".ambient-gradient")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "Bật hiệu ứng chuyển động" }).click();
  await page.getByRole("link", { name: "Đăng ký hội viên" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Họ và tên")).toBeEditable();
  await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email", { exact: true })).toBeEditable();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "artifacts/login-motion.png", fullPage: true });
});

test("landing reveals content, tracks navigation and pauses decoration", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#sports").scrollIntoViewIfNeeded();
  await expect(page.locator("#sports")).toHaveClass(/motion-visible/);
  await expect(page.locator(".lp-header")).toHaveCSS(
    "backdrop-filter",
    "blur(18px)",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Không gian hội viên" })
    .click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Không gian hội viên" }),
  ).toHaveAttribute("aria-current", "location");
  await page.getByRole("button", { name: "Tạm dừng hiệu ứng" }).click();
  await expect(page.locator(".ambient-particle").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("reduced motion disables background, image and page animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/register");
  await expect(page.locator(".ambient-gradient")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".auth-story")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".auth-story-photo")).toHaveCSS(
    "transform",
    "none",
  );
  await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
