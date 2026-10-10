import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";

// Test-only SDK stub. Production loads Cloudflare's unmodified SDK.
const sdk = `
window.__captchaRenders = 0;
window.turnstile = {
  ready: (callback) => callback(),
  render: (container, options) => {
    window.__captchaOptions = options;
    window.__captchaRenders++;
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Xác nhận thử nghiệm';
    button.onclick = () => options.callback('test-token-' + window.__captchaRenders);
    const widget = document.createElement('div');
    widget.style.width = options.size === 'compact' ? '150px' : '100%';
    widget.style.minWidth = options.size === 'compact' ? '150px' : '300px';
    widget.style.height = options.size === 'compact' ? '140px' : '65px';
    widget.append(button); container.append(widget);
    return 'widget-' + window.__captchaRenders;
  },
  remove: () => { document.querySelector('[aria-label="Xác minh bảo mật Cloudflare"]')?.replaceChildren(); }
};`;

async function fixture(page: Page, role = "MANAGER") {
  await setup(page, role);
  await page.addInitScript(() => {
    sessionStorage.removeItem("pulse.access");
    sessionStorage.removeItem("pulse.refresh");
  });
  const state = {
    failLogin: false,
    failScript: false,
    scripts: 0,
    attempts: [] as Record<string, unknown>[],
  };
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    async (route) => {
      state.scripts++;
      if (state.failScript) return route.abort();
      await route.fulfill({ contentType: "application/javascript", body: sdk });
    },
  );
  await page.route("**/api/v1/auth/login", async (route) => {
    state.attempts.push(route.request().postDataJSON());
    await route.fulfill({
      status: state.failLogin ? 401 : 200,
      json: state.failLogin
        ? { success: false, message: "Thông tin đăng nhập chưa đúng" }
        : {
            success: true,
            data: {
              accessToken: "fixture-token",
              refreshToken: "fixture-refresh",
            },
          },
    });
  });
  return state;
}

async function credentials(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("fixture-password");
}

for (const [role, home] of [
  ["ADMIN", "admin"],
  ["MANAGER", "manager"],
  ["COACH", "coach"],
  ["RECEPTIONIST", "receptionist"],
  ["MEMBER", "member"],
]) {
  test(`${role} must complete captcha before login`, async ({ page }) => {
    const state = await fixture(page, role);
    await page.goto("/login");
    await credentials(page);
    const submit = page.getByRole("button", { name: "Đăng nhập", exact: true });
    await expect(submit).toBeDisabled();
    expect(state.attempts).toEqual([]);
    await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/${home}/dashboard$`));
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({
      email: "test@example.invalid",
      turnstileToken: expect.stringMatching(/^test-token-/),
    });
    expect(state.scripts).toBe(1);
  });
}

test("expired tokens disable login and verification can be retried", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/login");
  await credentials(page);
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await page.evaluate("window.__captchaOptions['expired-callback']()");
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("hết hạn");
  await page.getByRole("button", { name: "Thử lại xác minh" }).click();
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
  expect(state.attempts).toEqual([]);
});

test("a failed login consumes the token and preserves entered credentials", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failLogin = true;
  await page.goto("/login");
  await credentials(page);
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("form")).toContainText(
    "Thông tin đăng nhập chưa đúng",
  );
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "test@example.invalid",
  );
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
  expect(state.attempts).toHaveLength(1);
});

test("SDK network errors fail closed and allow a fresh load", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failScript = true;
  await page.goto("/login");
  await expect(page.getByRole("alert")).toContainText("Không tải được");
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeDisabled();
  state.failScript = false;
  await page.getByRole("button", { name: "Thử lại xác minh" }).click();
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
  expect(state.attempts).toEqual([]);
});

test("unassigned coach logs in and sees the existing assignment state", async ({ page }) => {
  await fixture(page, "COACH");
  await page.route("**/api/v1/facilities", (route) => route.fulfill({
    json: { success: true, data: [] },
  }));
  await page.goto("/login");
  await credentials(page);
  await page.getByRole("button", { name: "Xác nhận thử nghiệm" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/coach\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Chưa được phân công cơ sở" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kiểm tra phân công" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("pulse.access"))).toBe("fixture-token");
});

for (const width of [320, 375, 430, 768, 1440]) {
test(`${width}px login keeps the widget inside the existing layout`, async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Xác nhận thử nghiệm" }),
  ).toBeVisible();
  expect(await page.evaluate("window.__captchaOptions.size")).toBe(width <= 380 ? "compact" : "flexible");
  expect(await page.evaluate("window.__captchaOptions.theme")).toBe("dark");
  if (width === 320 || width === 1440) await page.screenshot({ path: `artifacts/turnstile-login-${width}.png`, fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
}
