import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

for (const width of [390, 1440]) {
  test(`under-capacity warning uses readable theme colors at ${width}px`, async ({
    page,
  }) => {
    await setup(page, "MANAGER");
    await page.setViewportSize({ width, height: 960 });
    await page.route("**/api/v1/class-schedules/under-capacity?*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            schedules: [
              {
                id: "s1",
                className: "Lớp Gym tăng cơ giảm mỡ",
                roomName: "Gym 01",
                startTime: "2099-01-01T02:00:00Z",
                bookedCount: 0,
                minCapacity: 5,
                shortfall: 5,
              },
            ],
          },
        },
      }),
    );
    await page.goto("/manager/schedules");
    await expect(page.locator(".under-capacity-notice")).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .include(".under-capacity-notice")
      .withRules(["color-contrast"])
      .analyze();
    expect(scan.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/insights/warning-${width}.png` });
  });
}

test("equipment is only a two-option choice for indoor rooms, and is cleared for other areas", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  let saved: any;
  await page.route("**/api/v1/rooms", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { id: "new-room" } } });
  });
  await page.goto("/admin/rooms");
  await page
    .getByRole("button", { name: "Thêm phòng tập", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator(".equipment-options").getByRole("radio"),
  ).toHaveCount(2);
  await dialog.getByRole("radio", { name: "Có dụng cụ", exact: true }).check();
  await expect(dialog.getByLabel("Tên dụng cụ")).toHaveCount(0);
  await dialog.getByRole("radio", { name: /Ngoài trời/ }).check();
  await expect(dialog.locator(".equipment-options")).toHaveCount(0);
  await dialog.getByLabel(/^Tên/).fill("Sân tập A");
  await dialog.getByLabel(/^Sức chứa/).fill("25");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(() => saved?.areaType).toBe("OUTDOOR");
  expect(saved.capabilities).toEqual({});
});

for (const role of ["ADMIN", "MANAGER"]) {
  test(`${role} can inspect exact package usage by class, member and term`, async ({
    page,
  }) => {
    await setup(page, role);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route("**/api/v1/terms?*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "term-a",
              name: "Kỳ 1",
              registrationStartDate: "2026-10-01T00:00:00+07:00",
              registrationEndDate: "2026-10-20T23:59:59+07:00",
            },
          ],
        },
      }),
    );
    const queries: URLSearchParams[] = [];
    await page.route("**/api/v1/reports/memberships?*", (route) => {
      queries.push(new URL(route.request().url()).searchParams);
      return route.fulfill({
        json: {
          success: true,
          data: {
            unattributedEnrollments: 4,
            attributedEnrollments: 12,
            plansBreakdown: [
              {
                planId: "premium",
                planName: "Premium tháng",
                tier: "PREMIUM",
                soldCount: 8,
                uniqueMembersCount: 6,
                activeSubscribers: 6,
                revenue: 4800000,
                enrollmentStats: {
                  totalClassEnrollments: 12,
                  enrolledMembersCount: 3,
                  classRegistrationCount: 4,
                  topClasses: [
                    {
                      classId: "gym",
                      className: "Gym sáng",
                      sports: ["Gym"],
                      enrollmentsCount: 12,
                      uniqueMembersCount: 3,
                    },
                  ],
                  memberUsage: [
                    {
                      memberId: "lan",
                      memberName: "Nguyễn Thị Lan",
                      totalBookings: 5,
                      classes: [
                        { classId: "gym", className: "Gym sáng", bookings: 5 },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });
    await page.goto(
      `/${role === "ADMIN" ? "admin" : "manager"}/membership-insights`,
    );
    await expect(
      page.getByRole("heading", { name: "Gói tập và nhu cầu lớp học" }),
    ).toBeVisible();
    await expect(page.locator(".usage-data-note")).toContainText(
      "4 lượt đặt cũ",
    );
    await expect(
      page.getByRole("cell", { name: "Gym sáng", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Kỳ học", exact: true })
      .selectOption("term-a");
    await expect.poll(() => queries.at(-1)?.get("termId")).toBe("term-a");
    expect(queries.at(-1)?.get("startDate")).toBe("2026-10-01");
    if (role === "ADMIN") expect(queries.at(-1)?.has("facilityId")).toBe(false);
    else expect(queries.at(-1)?.has("facilityId")).toBe(false);
    await page
      .getByText("Hội viên sử dụng gói này để học lớp nào", { exact: true })
      .click();
    await page.getByRole("textbox", { name: "Tìm hội viên" }).fill("Lan");
    await expect(
      page.getByRole("cell", { name: "Nguyễn Thị Lan", exact: true }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .include(".membership-usage-report")
      .withRules(["color-contrast"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page
      .getByRole("heading", { name: "Nhu cầu gói & lớp", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/insights/${role.toLowerCase()}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/insights/${role.toLowerCase()}-mobile.png`,
      fullPage: true,
    });
  });
}
