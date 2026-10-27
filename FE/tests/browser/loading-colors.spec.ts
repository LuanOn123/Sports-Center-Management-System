import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("first session load uses dark background and dark skeleton before portal mounts", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/admin/facilities");
  const fullscreen = page.locator(".fullscreen");
  await expect(fullscreen).toBeVisible();
  await expect(fullscreen).toHaveCSS("background-color", "rgb(11, 16, 24)");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(11, 16, 24)",
  );
  await expect(fullscreen.locator(".skeleton-block").first()).toHaveCSS(
    "background-color",
    "rgb(37, 48, 68)",
  );
  await page.screenshot({ path: "artifacts/loading-initial-dark.png" });
  release();
  await expect(page.locator(".portal-theme")).toBeVisible();
});

test("login fields retain readable dark colors while disabled during submit", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.addInitScript(() => sessionStorage.clear());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/login");
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await email.fill("admin@example.test");
  await password.fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(email).toBeDisabled();
  await expect(password).toBeDisabled();
  await expect(email).toHaveCSS("background-color", "rgb(19, 26, 38)");
  await expect(password).toHaveCSS("background-color", "rgb(19, 26, 38)");
  await expect(email).toHaveCSS(
    "-webkit-text-fill-color",
    "rgb(189, 200, 216)",
  );
  await expect(
    page.getByRole("button", { name: "Đang đăng nhập…" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/login-pending-dark.png" });
  release();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
});
