import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function fixture(page: Page, existingCoach = false) {
  await setup(page, "MANAGER");
  const state = {
    assigned: existingCoach,
    failAssignment: false,
    failSecondSlot: false,
    revoked: false,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    successfulSlots: [] as string[],
  };
  const cls = () => ({
    id: "class-swim",
    name: "Bơi lội",
    isActive: true,
    areaType: "POOL",
    capacity: 10,
    sports: [{ id: "swim", name: "Bơi" }],
    coaches: state.assigned
      ? [
          {
            coachId: "profile-swim",
            isPrimary: true,
            coach: { id: "profile-swim", user: { fullName: "HLV Bơi" } },
          },
        ]
      : [],
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (path === "/classes/class-swim/coaches") {
        if (state.failAssignment)
          return route.fulfill({
            status: 409,
            json: { success: false, message: "HLV đang có lịch trùng giờ" },
          });
        expect(body).toEqual({ coachId: "profile-swim", isPrimary: true });
        state.assigned = true;
        data = cls();
      } else if (path === "/class-schedules") {
        // Reproduce the real error: schedules cannot be created before class assignment.
        if (!state.assigned)
          return route.fulfill({
            status: 400,
            json: { success: false, message: "COACH_REQUIRED" },
          });
        if (state.failSecondSlot && state.successfulSlots.length === 1)
          return route.fulfill({
            status: 409,
            json: { success: false, message: "Phòng tập bị trùng giờ" },
          });
        const start = String(body.startTime);
        expect(state.successfulSlots).not.toContain(start);
        state.successfulSlots.push(start);
        data = { id: `session-${state.successfulSlots.length}`, ...body };
      } else return route.fallback();
    } else if (path === "/classes") data = [cls()];
    else if (path === "/classes/class-swim") data = cls();
    else if (path === "/rooms")
      data = [
        {
          id: "pool",
          name: "Hồ bơi 1",
          capacity: 20,
          areaType: "POOL",
          isActive: true,
        },
      ];
    else if (path === "/coaches")
      data = [
        {
          id: "user-swim",
          fullName: "HLV Bơi",
          isActive: true,
          coachProfile: { id: "profile-swim" },
        },
        {
          id: "user-yoga",
          fullName: "HLV Yoga",
          isActive: true,
          coachProfile: { id: "profile-yoga" },
        },
      ];
    else if (path === "/coaches/profile-swim/specializations")
      data = state.revoked ? [] : [{ sportId: "swim" }];
    else if (path === "/coaches/profile-yoga/specializations")
      data = [{ sportId: "yoga" }];
    else if (path === "/terms") data = [];
    else if (path === "/terms/current") data = null;
    else if (path === "/class-schedules") data = [];
    else if (path === "/class-schedules/under-capacity")
      data = { schedules: [] };
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/manager/schedules");
  await page
    .getByRole("button", { name: "Thêm lịch hoạt động", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Lớp học", exact: true })
    .selectOption("class-swim");
  await dialog
    .getByRole("combobox", { name: "Phòng tập", exact: true })
    .selectOption("pool");
  await dialog
    .getByRole("textbox", { name: "Ngày hoạt động", exact: true })
    .fill("2099-11-02");
  await dialog.getByRole("checkbox", { name: /^Ca 5/ }).click();
  await dialog.getByRole("checkbox", { name: /^Ca 6/ }).click();
  return state;
}

test("requires an eligible coach and assigns the class before creating both shifts in the screenshot", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", {
    name: "HLV chính phụ trách lớp",
    exact: true,
  });
  await expect(select.locator("option")).toHaveText([
    "Chọn HLV đúng chuyên môn",
    "HLV Bơi",
  ]);
  await expect(
    dialog.getByRole("button", { name: "Lưu thay đổi" }),
  ).toBeDisabled();
  await select.selectOption("profile-swim");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes.map((row) => row.path)).toEqual([
    "/classes/class-swim/coaches",
    "/class-schedules",
    "/class-schedules",
  ]);
  expect(state.successfulSlots).toEqual([
    "2099-11-02T08:00:00.000Z",
    "2099-11-02T10:00:00.000Z",
  ]);
});

test("keeps an existing class coach without changing the class assignment", async ({
  page,
}) => {
  const state = await fixture(page, true);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("combobox", {
      name: "HLV chính phụ trách lớp",
      exact: true,
    }),
  ).toHaveValue("profile-swim");
  await expect(
    dialog.getByRole("combobox", {
      name: "HLV chính phụ trách lớp",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes.map((row) => row.path)).toEqual([
    "/class-schedules",
    "/class-schedules",
  ]);
});

test("stops before creating schedules if class assignment fails", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "HLV chính phụ trách lớp", exact: true })
    .selectOption("profile-swim");
  state.failAssignment = true;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("trùng giờ");
  expect(state.writes.map((row) => row.path)).toEqual([
    "/classes/class-swim/coaches",
  ]);
  expect(state.successfulSlots).toEqual([]);
});

test("retains a saved assignment and skips successful shifts when retrying a partial batch", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "HLV chính phụ trách lớp", exact: true })
    .selectOption("profile-swim");
  state.failSecondSlot = true;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("trùng giờ");
  await expect(dialog.getByText(/Đã gán HLV chính cho lớp/)).toBeVisible();
  await expect(dialog.getByText(/Đã tạo thành công 1 lịch/)).toBeVisible();
  state.failSecondSlot = false;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    state.writes.filter((row) => row.path === "/classes/class-swim/coaches"),
  ).toHaveLength(1);
  expect(state.successfulSlots).toHaveLength(2);
  expect(new Set(state.successfulSlots).size).toBe(2);
});

test("rechecks teaching permissions before creating any data", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "HLV chính phụ trách lớp", exact: true })
    .selectOption("profile-swim");
  state.revoked = true;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "không còn đủ chuyên môn",
  );
  await expect(dialog.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test("assigns once before creating recurring weekday schedules", async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "HLV chính phụ trách lớp", exact: true })
    .selectOption("profile-swim");
  await dialog.getByRole("button", { name: /Lịch cố định theo tuần/ }).click();
  await dialog.getByLabel("Từ ngày", { exact: true }).fill("2099-11-02");
  await dialog.getByLabel("Đến ngày", { exact: true }).fill("2099-11-08");
  await dialog
    .locator(".recurring-weekday-actions")
    .getByRole("button", { name: "Chọn tất cả" })
    .click();
  await dialog
    .getByRole("button", { name: "Tạo 14 lịch", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes[0].path).toBe("/classes/class-swim/coaches");
  expect(
    state.writes.filter((row) => row.path === "/classes/class-swim/coaches"),
  ).toHaveLength(1);
  expect(state.successfulSlots).toHaveLength(14);
});

test("shows the required coach selector without modal overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await fixture(page);
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", {
    name: "HLV chính phụ trách lớp",
    exact: true,
  });
  await select.scrollIntoViewIfNeeded();
  await expect(select).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("create-with-coach-mobile.png"),
  });
});
