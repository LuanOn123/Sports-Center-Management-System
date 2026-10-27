import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("admin loads capacity for UUID and legacy facility IDs and can retry a failed request", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  const facilities = [
    { id: "119e6bd4-cbb1-492b-8036-377a16765a38", name: "Cơ sở Dĩ An" },
    { id: "legacy-main", name: "Cơ sở quận 9" },
  ];
  await page.route("**/api/v1/reports/facilities?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          totalMembers: 10,
          totalBookings: 0,
          totalRevenue: 0,
          refundedAmount: 0,
          netRevenue: 0,
          facilities: facilities.map((f) => ({
            ...f,
            code: f.id,
            isActive: true,
            managers: [],
            netRevenue: 0,
            totalRevenue: 0,
            refundedAmount: 0,
            members: 5,
            bookings: 0,
            cancelledBookings: 0,
            sessions: 0,
          })),
        },
      },
    }),
  );
  const calls: string[] = [];
  let failLegacy = true;
  await page.route("**/api/v1/facilities/*/limits", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!;
    calls.push(id);
    if (id === "legacy-main" && failLegacy)
      return route.fulfill({
        status: 503,
        json: { success: false, message: "Dịch vụ tạm ngừng" },
      });
    return route.fulfill({
      json: {
        success: true,
        data: {
          limits: {
            maxClasses: 10,
            maxRooms: 5,
            maxCoaches: 5,
            maxMembers: 100,
            maxSports: null,
          },
          usage: {
            activeClasses: 3,
            activeRooms: 2,
            activeCoaches: 1,
            activeMembers: 5,
            activeSports: 2,
            totalSubscriptions: 5,
            classUtilization: 30,
            roomUtilization: 40,
            coachUtilization: 20,
            memberUtilization: 5,
          },
        },
      },
    });
  });
  await page.goto("/admin/dashboard");
  const first = page
    .locator(".facility-capacity-card")
    .filter({ hasText: "Cơ sở Dĩ An" });
  await expect(first).toBeVisible();
  await expect(first).toContainText("30%");
  await expect(
    page.getByText("Dịch vụ tạm ngừng", { exact: false }),
  ).toBeVisible();
  failLegacy = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".facility-capacity-card")).toHaveCount(2);
  expect(calls).toContain(facilities[0].id);
  expect(calls.filter((id) => id === "legacy-main").length).toBeGreaterThan(1);
  await expect(page.getByText(/Undocumented operation/)).toHaveCount(0);
});
