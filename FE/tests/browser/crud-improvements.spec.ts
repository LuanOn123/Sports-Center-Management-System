import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

test("Admin creates a coach with the same specialization fields as the manager", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/v1/sports?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [{ id: "gym", name: "Gym", isActive: true }],
      },
    }),
  );
  await page.route("**/api/v1/users", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    saved = route.request().postDataJSON();
    return route.fulfill({
      json: { success: true, data: { id: "new-coach" } },
    });
  });
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Vai trò/).selectOption("COACH");
  await dialog.getByLabel(/^Họ và tên/).fill("Nguyễn Văn A");
  await dialog.getByLabel(/^Email/).fill("coach@example.com");
  await dialog.getByLabel("Gym", { exact: true }).check();
  await dialog.getByLabel("Số năm kinh nghiệm").fill("3");
  await dialog.getByLabel("Giới thiệu / Tiểu sử").fill("HLV thể hình");
  await dialog
    .getByRole("button", { name: "Tạo Huấn luyện viên", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toMatchObject({
    role: "COACH",
    sportIds: ["gym"],
    experienceYears: 3,
    bio: "HLV thể hình",
  });
  await expect(page.locator(".toast-success")).toBeVisible();
});

test("room equipment is saved in the creation request and error toast stays above the dialog", async ({
  page,
}) => {
  await setup(page, "ADMIN");
  await page.setViewportSize({ width: 390, height: 900 });
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/v1/rooms", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    saved = route.request().postDataJSON();
    return route.fulfill({
      status: 409,
      json: { success: false, message: "Tên phòng đã tồn tại." },
    });
  });
  await page.goto("/admin/rooms");
  await page
    .getByRole("button", { name: "Thêm phòng tập", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Tên \*/).fill("Gym 01");
  await dialog.getByLabel(/^Sức chứa/).fill("20");
  await dialog.getByRole("radio", { name: "Có dụng cụ", exact: true }).check();
  await expect(dialog.getByLabel("Tên dụng cụ")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.locator(".toast-error")).toBeVisible();
  expect(saved?.capabilities).toEqual({ training_equipment: 1 });
  await page.screenshot({ path: "artifacts/crud/room-equipment-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("empty room equipment uses a readable dark surface", async ({ page }) => {
  await setup(page, "ADMIN");
  await page.route("**/api/v1/rooms?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "empty-room",
            name: "Phòng Gym",
            areaType: "INDOOR",
            capacity: 30,
            isActive: true,
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/rooms/empty-room", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: "empty-room",
          name: "Phòng Gym",
          areaType: "INDOOR",
          capacity: 30,
          isActive: true,
          capabilities: [],
        },
      },
    }),
  );
  await page.goto("/admin/rooms");
  await page
    .getByRole("button", { name: "Xem chi tiết", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Không có dụng cụ", { exact: true })).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .include(".room-detail-view")
    .withRules(["color-contrast"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/crud/room-detail-dark.png" });
});

test("member pricing cards are readable and fit narrow screens", async ({
  page,
}) => {
  await setup(page, "MEMBER");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/v1/membership-plans?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "monthly",
            name: "Gói tập tiêu chuẩn",
            tier: "MEMBERSHIP",
            price: 300000,
            durationDays: 30,
            maxConcurrentClasses: 3,
          },
          {
            id: "premium",
            name: "Gói tập Premium",
            tier: "PREMIUM",
            price: 600000,
            durationDays: 30,
            maxConcurrentClasses: 6,
          },
        ],
      },
    }),
  );
  await page.goto("/member/membership");
  await expect(page.locator(".membership-plan-card")).toHaveCount(2);
  const scan = await new AxeBuilder({ page })
    .include(".membership-plan-grid")
    .withRules(["color-contrast"])
    .analyze();
  expect(scan.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/crud/member-pricing-mobile.png",
    fullPage: true,
  });
});

test("creating several schedule shifts sends one batch request", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  const room = {
    id: "room-a",
    name: "Gym A",
    capacity: 30,
    areaType: "INDOOR",
    isActive: true,
    capabilities: [{ key: "Máy chạy bộ", quantity: 10 }],
  };
  await page.route("**/api/v1/classes?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "class-a",
            name: "Gym sáng",
            areaType: "INDOOR",
            isActive: true,
            capacity: 20,
            defaultRoomId: room.id,
            sports: [
              { id: "gym", requirements: [{ key: "Máy chạy bộ", minimum: 5 }] },
            ],
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/rooms?*", (route) =>
    route.fulfill({ json: { success: true, data: [room] } }),
  );
  await page.route("**/api/v1/terms", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route("**/api/v1/terms/current", (route) =>
    route.fulfill({ json: { success: true, data: null } }),
  );
  const requests: any[] = [];
  await page.route("**/api/v1/class-schedules/batch", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        success: true,
        data: { schedulesCreated: 2 },
        message: "Đã tạo 2 buổi học thành công.",
      },
    });
  });
  await page.goto("/manager/schedules");
  await page
    .getByRole("button", { name: "Thêm lịch hoạt động", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Lớp học", exact: true })
    .selectOption("class-a");
  await expect(
    dialog.getByRole("button", { name: "Phân công HLV phụ cho lớp" }),
  ).toBeVisible();
  await dialog.getByLabel("Ngày hoạt động", { exact: true }).fill("2099-01-01");
  await dialog.getByRole("checkbox", { name: /Ca 1/ }).click();
  await dialog.getByRole("checkbox", { name: /Ca 2/ }).click();
  await dialog.getByRole("button", { name: /Tạo.*2.*lịch|Lưu thay đổi/ }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ classId: "class-a", roomId: "room-a" });
  expect(requests[0].schedules).toHaveLength(2);
  await expect(page.locator(".toast-success")).toContainText(
    "Đã tạo 2 buổi học",
  );
});
