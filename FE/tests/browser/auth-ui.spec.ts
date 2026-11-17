import { expect, test } from "@playwright/test";
import { mockTurnstile } from "./fixtures";

test("login highlights only invalid fields for local and server validation", async ({
  page,
}) => {
  await mockTurnstile(page);
  let requests = 0;
  await page.route("**/api/v1/auth/login", (route) => {
    requests++;
    return route.fulfill({
      status: 401,
      json: { success: false, message: "Invalid email or password" },
    });
  });
  await page.goto("/login");
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Mật khẩu", { exact: true });
  const submit = page.getByRole("button", { name: "Đăng nhập", exact: true });
  await email.fill("email-sai");
  await password.fill("test-password");
  await submit.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveCSS("border-top-color", "rgb(255, 141, 154)");
  await expect(password).not.toHaveAttribute("aria-invalid", "true");
  expect(requests).toBe(0);
  await email.fill("member@example.test");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await submit.click();
  await expect(
    page.getByText("Email hoặc mật khẩu không chính xác."),
  ).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  expect(requests).toBe(1);
});

test("Google controls fit narrow screens and registration shows field-specific errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const profile = {
    name: "Nguyễn Minh Anh",
    email: "google-member-with-a-long-email@example.test",
  };
  const credential = `fixture.${Buffer.from(JSON.stringify(profile)).toString("base64url")}.test`;
  await page.route(/https:\/\/accounts\.google\.com\/gsi\/client/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
window.google = { accounts: { id: {
  initialize(options) { this.callback = options.callback; },
  renderButton(container, options) {
    const button = document.createElement("button");
    button.textContent = options.text === "signup_with" ? "Đăng ký bằng Google" : "Đăng nhập bằng Google";
    button.style.width = options.width + "px";
    button.style.height = "40px";
    button.dataset.theme = options.theme;
    button.dataset.locale = options.locale;
    button.onclick = () => this.callback({ credential: ${JSON.stringify(credential)} });
    container.replaceChildren(button);
  },
} } };`,
    }),
  );
  await mockTurnstile(page);
  await page.goto("/login");
  const googleLogin = page.getByRole("button", {
    name: "Đăng nhập bằng Google",
  });
  await expect(googleLogin).toHaveAttribute("data-theme", "filled_black");
  await expect(googleLogin).toHaveAttribute("data-locale", "vi");
  await page.goto("/register");
  const googleRegister = page.getByRole("button", {
    name: "Đăng ký bằng Google",
  });
  await expect(googleRegister).toBeVisible();
  const button = await googleRegister.boundingBox();
  expect(button!.x + button!.width).toBeLessThanOrEqual(320);
  await googleRegister.click();
  await expect(page.getByText(profile.email, { exact: true })).toBeVisible();
  const phone = page.getByRole("textbox", { name: /^Số điện thoại/ });
  await page.getByRole("button", { name: "Hoàn tất đăng ký" }).click();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveCSS("border-top-color", "rgb(255, 141, 154)");
  await phone.fill("0901234567");
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
