import { expect, test } from "@playwright/test";
import { setup } from "./fixtures";

for (const role of ["RECEPTIONIST", "STAFF"]) {
  test(`${role} has no attendance feature and old URL redirects`, async ({
    page,
  }) => {
    await setup(page, role);
    const attendanceCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/attendance"))
        attendanceCalls.push(request.url());
    });
    await page.goto("/receptionist/attendance");
    await expect(page).toHaveURL(/\/receptionist\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Tổng quan lễ tân", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".sidebar nav")
        .getByRole("link", { name: "Chuyên cần", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Theo dõi chuyên cần" }),
    ).toHaveCount(0);
    await page.goto("/receptionist/members");
    await page
      .getByRole("button", { name: "Chọn", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Thông tin hội viên" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xem điểm danh" }),
    ).toHaveCount(0);
    await page.goto("/receptionist/classes");
    await page.getByRole("button", { name: "Xem đăng ký" }).first().click();
    await expect(
      page.getByRole("columnheader", { name: "Trạng thái đặt chỗ" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Chuyên cần" }),
    ).toHaveCount(0);
    expect(attendanceCalls).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`reception profile edits explicitly, cancels and saves at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let profile = {
      id: "reception-a",
      fullName: "Lễ tân Mai",
      email: "mai@example.test",
      phone: "0901234567",
      role: "RECEPTIONIST",
      isActive: true,
      dateOfBirth: "1995-03-01",
      gender: "FEMALE",
    };
    const writes: Record<string, unknown>[] = [];
    await page.route("**/api/v1/auth/me", async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        writes.push(body);
        profile = { ...profile, ...body };
      }
      await route.fulfill({ json: { success: true, data: profile } });
    });
    await page.goto("/receptionist/profile");
    await page.getByRole("button", { name: /Menu hồ sơ của/ }).click();
    const menu = page.getByRole("navigation", {
      name: "Menu hồ sơ",
      exact: true,
    });
    await expect(
      menu.getByRole("button", { name: "Đăng xuất", exact: true }),
    ).toBeVisible();
    await expect(menu.getByRole("link")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Cập nhật ảnh đại diện" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Chỉnh sửa thông tin" }).click();
    await page.getByLabel("Họ và tên", { exact: true }).fill("Tên chưa lưu");
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    expect(writes).toHaveLength(0);
    await expect(page.locator(".member-profile-overview h2")).toHaveText(
      "Lễ tân Mai",
    );
    await page.getByRole("button", { name: "Chỉnh sửa thông tin" }).click();
    await page.getByLabel("Họ và tên", { exact: true }).fill("Lễ tân Mai mới");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("region", { name: "Thông báo thao tác" })).toContainText(
      "Đã lưu thay đổi thành công.",
    );
    await expect(page.locator(".member-profile-overview h2")).toHaveText(
      "Lễ tân Mai mới",
    );
    expect(writes[0]).toMatchObject({ fullName: "Lễ tân Mai mới" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `artifacts/reception-profile-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    await expect(
      page.getByLabel(/^Mật khẩu hiện tại/),
    ).toBeVisible();
    await expect(
      page.getByLabel(/^Mật khẩu mới/),
    ).toBeVisible();
  });
}
