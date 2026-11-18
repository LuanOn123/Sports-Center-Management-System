import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const width of [375, 1440]) {
  test(`Admin creates a missing sport and assigns it to the coach at ${width}px`, async ({
    page,
  }) => {
    await setup(page, "ADMIN");
    await page.setViewportSize({ width, height: 1000 });
    const sports = [{ id: "yoga", name: "Yoga", isActive: true }];
    const sportWrites: unknown[] = [];
    await page.route(/\/api\/v1\/sports(?:\?|$)/, (route) => {
      if (route.request().method() === "POST") {
        sportWrites.push(route.request().postDataJSON());
        const sport = { id: "pickleball", name: "Pickleball", isActive: true };
        sports.push(sport);
        return route.fulfill({
          status: 201,
          json: { success: true, data: sport },
        });
      }
      return route.fulfill({ json: { success: true, data: sports } });
    });
    await page.goto("/admin/users");
    await page
      .getByRole("button", { name: "Thêm người dùng", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Email/).fill("sport-coach@example.test");
    await dialog.getByLabel(/^Họ và tên/).fill("HLV Bộ Môn Mới");
    await dialog.getByLabel(/^Vai trò/).selectOption("COACH");
    await dialog
      .getByRole("button", { name: "+ Tạo bộ môn mới", exact: true })
      .click();
    const editor = dialog.getByRole("region", { name: "Tạo bộ môn mới" });
    await editor.getByLabel("Tên bộ môn", { exact: true }).fill("Yoga");
    await editor
      .getByRole("button", { name: "Lưu bộ môn", exact: true })
      .click();
    await expect(editor.getByRole("alert")).toContainText(
      "Bộ môn đã có trong hệ thống",
    );
    expect(sportWrites).toEqual([]);
    await editor.getByLabel("Tên bộ môn", { exact: true }).fill("Pickleball");
    await editor.getByRole("radio", { name: /Ngoài trời/ }).check();
    await editor
      .getByRole("button", { name: "Lưu bộ môn", exact: true })
      .click();
    await expect(
      dialog.getByRole("checkbox", { name: "Pickleball", exact: true }),
    ).toBeChecked();
    expect(sportWrites).toEqual([
      { name: "Pickleball", areaTypes: ["OUTDOOR"] },
    ]);
    await expect(dialog.getByLabel(/^Email/)).toHaveValue(
      "sport-coach@example.test",
    );
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    const checkboxWidth = await dialog
      .getByRole("checkbox", { name: "Pickleball" })
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(checkboxWidth).toBe(18);
    const request = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname.endsWith("/users"),
    );
    await dialog
      .getByRole("button", { name: "Tạo Huấn luyện viên", exact: true })
      .click();
    expect((await request).postDataJSON()).toMatchObject({
      fullName: "HLV Bộ Môn Mới",
      role: "COACH",
      sportIds: ["pickleball"],
    });
  });
}

test("User creation preserves common fields and coach details across role changes", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.route(/\/api\/v1\/sports(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: "yoga", name: "Yoga", isActive: true }],
      },
    }),
  );
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Email/).fill("coach-draft@example.test");
  await dialog.getByLabel(/^Mật khẩu/).fill("CoachDraft@123");
  await dialog.getByLabel(/^Họ và tên/).fill("Nguyễn HLV");
  await dialog.getByLabel(/^Vai trò/).selectOption("COACH");
  await expect(dialog.getByLabel(/^Email/)).toHaveValue(
    "coach-draft@example.test",
  );
  await expect(dialog.getByLabel(/^Mật khẩu/)).toHaveValue("CoachDraft@123");
  await expect(dialog.getByLabel(/^Họ và tên/)).toHaveValue("Nguyễn HLV");
  await dialog.getByLabel("Số năm kinh nghiệm").fill("5");
  await dialog.getByLabel("Yoga", { exact: true }).check();
  await dialog.getByLabel(/^Họ và tên/).fill("Nguyễn HLV cập nhật");
  await dialog.getByLabel(/^Vai trò/).selectOption("MEMBER");
  await expect(dialog.getByLabel(/^Họ và tên/)).toHaveValue(
    "Nguyễn HLV cập nhật",
  );
  await dialog.getByLabel(/^Vai trò/).selectOption("COACH");
  await expect(dialog.getByLabel("Số năm kinh nghiệm")).toHaveValue("5");
  await expect(dialog.getByLabel("Yoga", { exact: true })).toBeChecked();
  const request = page.waitForRequest(
    (req) =>
      req.method() === "POST" && new URL(req.url()).pathname.endsWith("/users"),
  );
  await dialog
    .getByRole("button", { name: /Tạo.*HLV|Tạo.*Huấn luyện viên/i })
    .click();
  expect((await request).postDataJSON()).toMatchObject({
    fullName: "Nguyễn HLV cập nhật",
    email: "coach-draft@example.test",
    password: "CoachDraft@123",
    role: "COACH",
    experienceYears: 5,
    sportIds: ["yoga"],
  });
});
