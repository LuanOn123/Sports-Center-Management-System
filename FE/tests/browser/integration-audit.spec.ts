import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

test("ADMIN dashboard shortcuts stay in the admin portal", async ({ page }) => {
  await setup(page, "ADMIN");
  await page.goto("/admin/dashboard");
  await expect(page.getByRole("link", { name: /Xem lịch hoạt động/ })).toHaveAttribute("href", "/admin/schedules");
  for (const link of await page.locator('main a[href^="/manager"]').all()) {
    expect(await link.getAttribute("href")).not.toMatch(/^\/manager/);
  }
  await page.getByRole("link", { name: /Xem lịch hoạt động/ }).click();
  await expect(page).toHaveURL(/\/admin\/schedules$/);
  await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toHaveCount(0);
});

test("MANAGER edits coach profile using User.id and cannot create accounts", async ({ page }) => {
  await setup(page, "MANAGER");
  const userId = "670123abc456def789012345";
  const profileId = "670123abc456def789012346";
  let updated = false;
  let payload: unknown;
  const coach = () => ({ id: userId, fullName: "Audit Coach", email: "audit@test.invalid", isActive: true, coachProfile: { id: profileId, specialization: "Yoga", experienceYears: updated ? 4 : 1 } });
  await page.route("**/api/v1/facilities/facility-a", route => route.fulfill({ json: { success: true, data: { name: "Cơ sở A", staffs: [{ userId, role: "COACH", isActive: true, user: coach() }] } } }));
  await page.route("**/api/v1/coaches**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "PATCH") {
      expect(path).toBe(`/api/v1/coaches/${userId}`);
      payload = route.request().postDataJSON();
      updated = true;
      return route.fulfill({ json: { success: true, data: coach() } });
    }
    return route.fulfill({ json: { success: true, data: path.endsWith(userId) ? coach() : [coach()] } });
  });
  await page.goto("/manager/coaches");
  await expect(page).toHaveURL(/\/manager\/users$/);
  await expect(page.getByRole("button", { name: "Hồ sơ Coach", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Thêm huấn luyện viên/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Hồ sơ Coach", exact: true }).first().click();
  await expect(page.getByRole("dialog").getByLabel("Họ và tên")).toHaveValue("Audit Coach");
  await page.getByRole("dialog").getByLabel("Số năm kinh nghiệm").fill("4");
  await page.getByRole("dialog").getByRole("button", { name: /Lưu thay đổi/ }).click();
  await expect.poll(() => updated).toBe(true);
  expect(payload).toMatchObject({ experienceYears: 4 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("MANAGER no longer exposes member registration through obsolete URLs", async ({ page }) => {
  await setup(page, "MANAGER");
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/v1/auth/register", async route => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { success: true, data: { id: "670123abc456def789012345", ...body } } });
  });
  await page.goto("/manager/members");
  await expect(page).toHaveURL(/\/manager\/users$/);
  await expect(page.getByRole("heading", { name: "Nhân sự cơ sở" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm hội viên", exact: true })).toHaveCount(0);
  expect(body).toBeUndefined();
});

test("COACH manual attendance offers allowed statuses and sends Mongo profile ID", async ({ page }) => {
  await setup(page, "COACH");
  const memberId = "670123abc456def789012345";
  const now = Date.now();
  const schedule = { id: "schedule-a", classId: "class-a", status: "SCHEDULED", startTime: new Date(now + 5 * 60000).toISOString(), endTime: new Date(now + 60 * 60000).toISOString(), class: { id: "class-a", name: "Audit Session", capacity: 10 }, room: { name: "Room A" } };
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (path === "/auth/me") data = { id: "user-coach", fullName: "Audit Coach", email: "coach@test.invalid", role: "COACH", isActive: true, coachProfile: { id: "coach-a" } };
    else if (path === "/classes") data = [{ id: "class-a", name: "Audit Session", capacity: 10, isActive: true }];
    else if (path === "/class-schedules") data = [schedule];
    else if (path === "/enrollments/schedule/schedule-a") data = [{ id: "e-a", memberId, status: "BOOKED", member: { id: memberId, user: { fullName: "Audit Student" } } }];
    else if (path === "/attendance") {
      if (route.request().method() === "POST") { body = route.request().postDataJSON(); data = { id: "a-a", ...body }; }
      else data = body ? [{ id: "a-a", ...body }] : [];
    } else return route.fallback();
    return route.fulfill({ status: route.request().method() === "POST" ? 201 : 200, json: { success: true, data } });
  });
  await page.goto("/coach/schedule");
  await page.getByRole("button", { name: /Audit Session.*Xem học viên/ }).click();
  await page.locator("summary").filter({ hasText: "Audit Student" }).click();
  const statuses = page.getByRole("combobox", { name: "Kết quả điểm danh" });
  await expect(statuses.locator('option[value="EXCUSED"]')).toHaveCount(0);
  await statuses.selectOption("PRESENT");
  await page.getByRole("button", { name: "Lưu điểm danh", exact: true }).click();
  await expect.poll(() => body).toMatchObject({ memberId, scheduleId: "schedule-a", status: "PRESENT" });
});
