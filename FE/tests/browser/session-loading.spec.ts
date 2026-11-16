import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { setup } from "./fixtures";

for (const [role, home] of [
  ["MEMBER", "member"],
  ["MANAGER", "manager"],
  ["STAFF", "receptionist"],
  ["RECEPTIONIST", "receptionist"],
  ["COACH", "coach"],
]) {
  test(`shared login sends ${role} away from a stale portal URL`, async ({
    page,
  }) => {
    await setup(page, role);
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/manager/users");
    await page.getByPlaceholder("Email của bạn").fill("account@example.test");
    await page.getByPlaceholder("Nhập mật khẩu").fill("password123");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${home}/dashboard$`));
    await expect(
      page.getByRole("heading", { name: "Không có quyền truy cập" }),
    ).toHaveCount(0);
  });
}

test("legacy member URLs reach the integrated portal and data loads", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto("/user/classes");
  await expect(page).toHaveURL(/\/member\/classes$/);
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(
    page.getByText("Morning Yoga", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Chưa có lớp học");
  expect(failures).toEqual([]);
});

test("table skeleton stays visible until data arrives and respects reduced motion", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/users?**", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/admin/users");
  await expect(page.locator(".skeleton-table")).toBeVisible();
  expect(
    await page
      .locator(".skeleton-block")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
  await page.screenshot({ path: "artifacts/loading-skeleton.png" });
  release();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xem chi tiết", exact: true }).first(),
  ).toBeVisible();
});

test("staff details scroll below the header and label facility assignments", async ({ page }) => {
  await setup(page, "ADMIN");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 480 });
  const staff = {
    id: "test-receptionist",
    fullName: "Nguyễn Tân",
    email: "letan@example.invalid",
    role: "RECEPTIONIST",
    isActive: true,
    assignmentStatus: "ASSIGNED",
    facilityAssignments: [
      { role: "RECEPTIONIST", facility: { name: "Cơ sở quận 9" } },
    ],
  };
  await page.route("**/api/v1/users?*", (route) =>
    route.fulfill({ json: { success: true, data: [staff] } }),
  );
  await page.route("**/api/v1/users/test-receptionist", (route) =>
    route.fulfill({ json: { success: true, data: staff } }),
  );
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết người dùng" });
  const heading = dialog.getByRole("heading", { name: "Chi tiết người dùng" });
  await dialog.locator("summary").filter({ hasText: /^Phân công cơ sở/ }).click();
  await dialog.locator("summary").filter({ hasText: /^Cơ sở$/ }).click();
  const body = dialog.locator(".modal-scroll-body");
  await body.evaluate((el) => { el.scrollTop = 0; });
  await expect(heading).toBeInViewport();
  const headerBeforeScroll = await heading.boundingBox();
  const facility = dialog.getByText("Cơ sở quận 9", { exact: true });
  await facility.scrollIntoViewIfNeeded();
  await expect(facility).toBeInViewport();
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await heading.boundingBox()).toEqual(headerBeforeScroll);
});

for (const width of [375, 1440]) {
  test(`nested details remain readable at ${width}px`, async ({ page }) => {
    await setup(page, "ADMIN", true);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/users");
    await page
      .getByRole("button", { name: "Xem chi tiết", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".details").first()).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/details-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

for (const width of [375, 1440]) {
  test(
    "member pages are accessible and responsive at " + width,
    async ({ page }) => {
      test.setTimeout(90000);
      await setup(page, "MEMBER");
      await page.setViewportSize({ width, height: 960 });
      const failures: unknown[] = [];
      for (const path of [
        "dashboard",
        "membership",
        "classes",
        "my-classes",
        "schedule",
        "profile",
        "attendance",
        "notifications",
      ]) {
        await page.goto("/member/" + path);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator(".skeleton")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        failures.push(
          ...result.violations.map((v) => ({
            path,
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        );
        if (path === "dashboard")
          await page.screenshot({
            path: "artifacts/member-" + width + ".png",
            fullPage: true,
          });
      }
      fs.writeFileSync(
        "artifacts/member-accessibility-" + width + ".json",
        JSON.stringify(failures, null, 2),
      );
      expect(failures).toEqual([]);
    },
  );
}

test("whole-course enrollment dialog wraps long content and blocks dismissal during submission", async ({
  page,
}) => {
  await setup(page, "MEMBER", true);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/member/classes");
  await page
    .getByRole("button", { name: "Xem chi tiết khóa học" })
    .first()
    .click();
  const open = page
    .getByRole("button", { name: "Đăng ký trọn khóa", exact: true })
    .first();
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await open.click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/enrollments/bulk", async (route) => {
    await gate;
    await route.fallback();
  });
  await dialog.getByRole("button", { name: "Xác nhận đăng ký" }).click();
  await expect(
    dialog.getByRole("button", { name: "Đang xử lý…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "artifacts/member-booking-modal.png" });
  release();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Bạn đã đăng ký 4 buổi", { exact: false }),
  ).toBeVisible();
});

for (const profile of [
  { role: "MEMBER", isActive: false },
  { role: "UNKNOWN", isActive: true },
]) {
  test(`access guard rejects ${profile.role} with active=${profile.isActive}`, async ({
    page,
  }) => {
    await setup(page, "MEMBER");
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { id: "disabled", fullName: "Test", ...profile },
        },
      }),
    );
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Không có quyền truy cập" }),
    ).toBeVisible();
    await expect(page.locator(".member-content")).toHaveCount(0);
  });
}
