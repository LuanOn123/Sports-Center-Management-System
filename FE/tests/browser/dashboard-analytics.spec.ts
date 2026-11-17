import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";
const day = "2026-10-09";
async function analyticsFixture(
  page: Page,
  role: string,
  state: "ready" | "empty" | "error" = "ready",
) {
  await setup(page, role);
  await page.clock.install({ time: new Date(`${day}T03:00:00Z`) });
  const calls: { path: string; facility?: string; query: URLSearchParams }[] =
    [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1", "");
    calls.push({
      path,
      facility: route.request().headers()["x-facility-id"],
      query: url.searchParams,
    });
    const empty = state === "empty";
    const cls = {
      id: "class-a",
      name: "Yoga cơ bản",
      capacity: 20,
      isActive: true,
      classType: "REGULAR",
    };
    const sessions = empty
      ? []
      : [
          {
            id: "s1",
            classId: cls.id,
            class: cls,
            room: { name: "Phòng 1" },
            status: "COMPLETED",
            startTime: `${day}T02:00:00Z`,
            endTime: `${day}T03:00:00Z`,
          },
          {
            id: "s2",
            classId: cls.id,
            class: cls,
            room: { name: "Phòng 2" },
            status: "SCHEDULED",
            startTime: `${day}T06:00:00Z`,
            endTime: `${day}T07:00:00Z`,
          },
        ];
    if (path === "/auth/me" && role === "COACH")
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: "coach-user",
            fullName: "Coach Test",
            email: "coach@test.local",
            role: "COACH",
            coachProfile: { id: "coach-a" },
            isActive: true,
          },
        },
      });
    if (path === "/classes")
      return route.fulfill({
        json: { success: true, data: empty ? [] : [cls] },
      });
    if (
      state === "error" &&
      [
        "/reports/revenue",
        "/reports/facilities",
        "/payments",
        "/class-schedules",
        "/attendance/monitoring",
      ].includes(path)
    )
      return route.fulfill({
        status: 503,
        json: { success: false, message: "Dịch vụ tạm ngừng" },
      });
    if (path === "/class-schedules")
      return route.fulfill({ json: { success: true, data: sessions } });
    if (path === "/reports/revenue")
      return route.fulfill({
        json: {
          success: true,
          data: {
            totalRevenue: empty ? 0 : 500000,
            netRevenue: empty ? 0 : 450000,
            refundedAmount: empty ? 0 : 50000,
            successPayments: empty ? 0 : 5,
            totalPayments: empty ? 0 : 6,
            revenueByMethod: {
              CASH: empty ? 0 : 300000,
              SEPAY: empty ? 0 : 200000,
            },
            recentPayments: [],
            netRevenueVerified: true,
          },
        },
      });
    if (path === "/reports/facilities")
      return route.fulfill({
        json: {
          success: true,
          data: {
            totalRevenue: 500000,
            netRevenue: 450000,
            refundedAmount: 50000,
            totalMembers: 8,
            totalBookings: 12,
            facilities: empty
              ? []
              : [
                  {
                    id: "facility-a",
                    name: "Cơ sở A",
                    code: "A",
                    isActive: true,
                    managers: ["Quản lý A"],
                    totalRevenue: 500000,
                    netRevenue: 450000,
                    refundedAmount: 50000,
                    members: 8,
                    bookings: 12,
                    cancelledBookings: 2,
                    sessions: 5,
                  },
                ],
          },
        },
      });
    if (path === "/payments")
      return route.fulfill({
        json: {
          success: true,
          data: empty
            ? []
            : [
                {
                  id: "p1",
                  createdAt: `${day}T02:00:00Z`,
                  method: "CASH",
                  status: "SUCCESS",
                  subscriptionId: "sub1",
                },
                {
                  id: "p2",
                  createdAt: `${day}T03:00:00Z`,
                  method: "SEPAY",
                  status: "PENDING",
                },
              ],
        },
      });
    if (path === "/attendance/monitoring")
      return route.fulfill({
        json: {
          success: true,
          data: empty
            ? []
            : [
                {
                  memberId: "m1",
                  classId: "c1",
                  status: "WARNING",
                  reportStatus: null,
                },
                {
                  memberId: "m1",
                  classId: "c2",
                  status: "VIOLATION",
                  reportStatus: "PENDING",
                },
              ],
        },
      });
    return route.fallback();
  });
  return calls;
}
for (const [role, path] of [
  ["MANAGER", "manager"],
  ["ADMIN", "admin"],
  ["RECEPTIONIST", "receptionist"],
  ["COACH", "coach"],
]) {
  test(`${role}: real data composition, responsive and scope`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const calls = await analyticsFixture(page, role);
    await page.goto(`/${path}/dashboard`);
    await expect(page.locator(".analytics-kpi").first()).toBeVisible();
    await expect(page.locator(".analytics-layout").first()).toBeVisible();
    await expect(page.locator(".analytics-ranking").first()).toBeVisible();
    if (role !== "ADMIN") {
      const point = page.locator(".analytics-point").last();
      await point.focus();
      await expect(page.locator(".analytics-readout").first()).toContainText(
        "2026-",
      );
    }
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        )
        .toBe(true);
      const overflow = await page
        .locator(".analytics-card, .analytics-kpi")
        .evaluateAll((els) =>
          els
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => ({
              title: el.querySelector("h2")?.textContent,
              width: el.clientWidth,
              scroll: el.scrollWidth,
            })),
        );
      expect(overflow, `${role} card overflow at ${width}`).toEqual([]);
      if (width === 1440) {
        const layout = page.locator(".analytics-layout").first();
        const kpis = layout.locator(
          ".analytics-main > .analytics-kpis > .analytics-kpi",
        );
        await expect(kpis).toHaveCount(4);
        const boxes = await kpis.evaluateAll((elements) =>
          elements.map((el) => ({
            top: el.getBoundingClientRect().top,
            left: el.getBoundingClientRect().left,
          })),
        );
        expect(boxes.every((box) => Math.abs(box.top - boxes[0].top) < 2)).toBe(
          true,
        );
        const side = await layout.locator(".analytics-side").boundingBox();
        expect(Math.abs(side!.y - boxes[0].top)).toBeLessThan(2);
        const analysts = layout.locator(
          ".analytics-analysts > .analytics-card",
        );
        await expect(analysts).toHaveCount(2);
        const first = await analysts.nth(0).boundingBox(),
          second = await analysts.nth(1).boundingBox();
        expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
        if (role !== "ADMIN")
          await expect(layout.locator(".analytics-radar svg")).toBeVisible();
      }

      if (width === 375 && role === "MANAGER")
        await page.screenshot({
          path: "test-results/manager-analytics-mobile.png",
          fullPage: true,
        });
    }
    if (role === "MANAGER") {
      expect(
        calls
          .filter((c) => c.path.startsWith("/reports/"))
          .every(
            (c) => c.path === "/reports/revenue" && c.facility === "facility-a",
          ),
      ).toBe(true);
      await page.getByRole("button", { name: "7 ngày", exact: true }).click();
      await expect
        .poll(() =>
          calls.some(
            (c) =>
              c.path === "/class-schedules" &&
              c.query.get("startAfter")?.startsWith("2026-10-02"),
          ),
        )
        .toBe(true);
      await page
        .getByRole("combobox", { name: "Cơ sở đang làm việc" })
        .selectOption("facility-b");
      await expect
        .poll(() =>
          calls.some(
            (c) => c.path === "/reports/revenue" && c.facility === "facility-b",
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: "test-results/manager-analytics.png",
        fullPage: true,
      });
    }
    if (role === "RECEPTIONIST") {
      expect(calls.some((c) => c.path.startsWith("/reports/"))).toBe(false);
      await expect(page.locator('a[href="/receptionist/checkin"]')).toHaveCount(
        0,
      );
    }
    if (role === "COACH")
      expect(
        calls
          .filter((c) => c.path === "/class-schedules")
          .every((c) => c.query.get("classId") === "class-a"),
      ).toBe(true);
    expect(errors).toEqual([]);
  });
}
for (const state of ["empty", "error"] as const)
  test(`manager ${state} state`, async ({ page }) => {
    await analyticsFixture(page, "MANAGER", state);
    await page.goto("/manager/dashboard");
    if (state === "empty")
      await expect(
        page.getByText("Chưa có dữ liệu trong kỳ", { exact: true }).first(),
      ).toBeVisible();
    else {
      await expect(page.getByRole("alert").first()).toBeVisible({
        timeout: 20000,
      });
      await expect(
        page.getByRole("button", { name: "Thử lại" }).first(),
      ).toBeVisible();
    }
    await expect(page.locator("main")).not.toContainText("NaN");
  });

test("dashboard keeps the existing report page theme", async ({ page }) => {
  await analyticsFixture(page, "MANAGER");
  const colors = () =>
    page.evaluate(() => {
      const portal = getComputedStyle(document.querySelector(".portal-theme")!);
      return {
        tokens: [
          "--color-primary",
          "--color-secondary",
          "--color-background",
          "--color-text",
          "--member-border",
          "--chart-1",
          "--chart-2",
          "--chart-3",
          "--chart-4",
        ].map((key) => portal.getPropertyValue(key)),
        font: portal.fontFamily,
        sidebar: getComputedStyle(document.querySelector(".sidebar")!)
          .backgroundColor,
        header: getComputedStyle(document.querySelector(".topbar")!)
          .backgroundColor,
        surface: getComputedStyle(document.querySelector(".panel")!)
          .backgroundColor,
      };
    });
  await page.goto("/manager/reports");
  await expect(page.locator(".panel").first()).toBeVisible();
  const before = await colors();
  await page.goto("/manager/dashboard");
  await expect(page.locator(".analytics-kpi").first()).toBeVisible();
  expect(await colors()).toEqual(before);
});

test("manager analytics fits a single desktop viewport", async ({ page }) => {
  await analyticsFixture(page, "MANAGER");
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/manager/dashboard");
    await expect(page.locator(".analytics-plot")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    const board = await page.locator(".analytics-workbench").boundingBox();
    expect(board!.y + board!.height).toBeLessThanOrEqual(size.height);
    for (const element of await page
      .locator(
        ".analytics-analysts > .analytics-card, .analytics-side > .analytics-card",
      )
      .all()) {
      const box = await element.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        board!.y + board!.height,
      );
    }
    const clipped = await page
      .locator(".analytics-layout .analytics-card")
      .evaluateAll((els) =>
        els
          .filter((el) => el.scrollHeight > el.clientHeight + 2)
          .map((el) => ({
            title: el.querySelector("h2")?.textContent,
            height: el.clientHeight,
            content: el.scrollHeight,
          })),
      );
    expect(clipped).toEqual([]);
    await page.screenshot({
      path: `test-results/dashboard-one-page-${size.width}.png`,
      fullPage: false,
    });
  }
});
