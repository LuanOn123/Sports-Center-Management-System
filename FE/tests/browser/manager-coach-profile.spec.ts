import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function coachFixture(page: Page, assigned: string[] = []) {
  await setup(page, "MANAGER");
  const state = {
    assigned,
    required: [] as string[],
    failProfile: false,
    failSports: false,
    writes: [] as { path: string; body: Record<string, unknown> }[],
  };
  const coach = {
    id: "coach-user",
    fullName: "Nguyễn Văn An",
    email: "hlv@example.com",
    role: "COACH",
    coachProfile: {
      id: "coach-profile",
      specialization: "Huấn luyện cơ bản",
      experienceYears: null as number | null,
      bio: "",
    },
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    if (request.method() !== "GET") {
      state.writes.push({ path, body: request.postDataJSON() });
      if (path === "/coaches/coach-profile/specializations") {
        state.assigned = request.postDataJSON().sportIds;
      } else if (path === "/coaches/coach-user") {
        if (state.failProfile) {
          return route.fulfill({
            status: 500,
            json: { success: false, message: "Không lưu được hồ sơ" },
          });
        }
        coach.coachProfile.experienceYears =
          request.postDataJSON().experienceYears;
      } else return route.fallback();
      return route.fulfill({ json: { success: true, data: coach } });
    }
    let data: unknown;
    if (path === "/facilities/facility-a") {
      data = {
        id: "facility-a",
        name: "Cơ sở A",
        staffs: [
          { userId: coach.id, user: coach, role: "COACH", isActive: true },
        ],
      };
    } else if (path === "/coaches/coach-user") {
      data = coach;
    } else if (path === "/sports") {
      if (state.failSports)
        return route.fulfill({
          status: 503,
          json: { success: false, message: "Không tải được bộ môn" },
        });
      data = [
        { id: "yoga", name: "Yoga", isActive: true },
        { id: "swim", name: "Bơi", isActive: true },
        { id: "inactive", name: "Môn đã đóng", isActive: false },
      ];
    } else if (path === "/coaches/coach-profile/specializations") {
      data = state.assigned.map((sportId) => ({ sportId }));
    } else if (
      path === "/classes" &&
      url.searchParams.get("coachId") === "coach-profile"
    ) {
      data = state.required.length
        ? [
            {
              id: "class-1",
              isActive: true,
              sports: state.required.map((id) => ({ id, name: id })),
            },
          ]
        : [];
    } else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/manager/users");
  await page.getByRole("button", { name: "Xem hồ sơ", exact: true }).click();
  return state;
}

test("updates an old coach's experience and authorized sports from the profile", async ({
  page,
}) => {
  const state = await coachFixture(page);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("checkbox", { name: "Môn đã đóng" }),
  ).toHaveCount(0);
  await dialog.getByLabel("Số năm kinh nghiệm").fill("5");
  await dialog.getByRole("checkbox", { name: "Yoga", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Bơi", exact: true }).check();
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toEqual([
    {
      path: "/coaches/coach-profile/specializations",
      body: { sportIds: ["yoga", "swim"] },
    },
    {
      path: "/coaches/coach-user",
      body: {
        fullName: "Nguyễn Văn An",
        phone: "",
        specialization: "Huấn luyện cơ bản",
        experienceYears: 5,
        bio: "",
      },
    },
  ]);
  await page.getByRole("button", { name: "Xem hồ sơ", exact: true }).click();
  await expect(dialog.getByLabel("Số năm kinh nghiệm")).toHaveValue("5");
  await expect(
    dialog.getByRole("checkbox", { name: "Yoga", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Bơi", exact: true }),
  ).toBeChecked();
});

test("keeps the sports required by assigned classes and validates experience", async ({
  page,
}) => {
  const state = await coachFixture(page, ["yoga", "swim"]);
  state.required = ["yoga"];
  // The tab refetch also exercises the existing sports-only workflow.
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Bộ môn giảng dạy", exact: true })
    .click();
  await dialog.getByRole("checkbox", { name: "Yoga", exact: true }).uncheck();
  await expect(
    dialog.getByRole("button", { name: "Lưu bộ môn" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("Không thể gỡ bộ môn");
  await dialog.getByRole("button", { name: "Thông tin", exact: true }).click();
  const years = dialog.getByLabel("Số năm kinh nghiệm");
  for (const value of ["-1", "1.5"]) {
    await years.fill(value);
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    expect(
      await years.evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false);
  }
  expect(state.writes).toEqual([]);
});

test("rechecks class assignments before changing sports", async ({ page }) => {
  const state = await coachFixture(page, ["yoga", "swim"]);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("checkbox", { name: "Bơi", exact: true }),
  ).toBeChecked();
  state.required = ["swim"];
  await dialog.getByRole("checkbox", { name: "Bơi", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Phân công lớp của HLV vừa thay đổi",
  );
  expect(state.writes).toEqual([]);
});

test("retains a partially saved form and retries without rewriting sports", async ({
  page,
}) => {
  const state = await coachFixture(page, ["yoga"]);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Số năm kinh nghiệm").fill("0");
  await dialog.getByRole("checkbox", { name: "Bơi", exact: true }).check();
  state.failProfile = true;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog.getByRole("status")).toContainText("Bộ môn đã được lưu");
  await expect(dialog.getByLabel("Số năm kinh nghiệm")).toHaveValue("0");
  await expect(
    dialog.getByRole("checkbox", { name: "Bơi", exact: true }),
  ).toBeChecked();
  state.failProfile = false;
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes.map((write) => write.path)).toEqual([
    "/coaches/coach-profile/specializations",
    "/coaches/coach-user",
    "/coaches/coach-user",
  ]);
  expect(state.writes[2].body.experienceYears).toBe(0);
});

for (const width of [375, 1280]) {
  test(`profile and create form share accessible fields without overflowing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await coachFixture(page, ["yoga"]);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Số năm kinh nghiệm")).toBeVisible();
    await expect(
      dialog.getByRole("checkbox", { name: "Yoga", exact: true }),
    ).toBeChecked();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Tạo Huấn luyện viên", exact: true })
      .click();
    await expect(dialog.getByLabel("Số năm kinh nghiệm")).toBeVisible();
    await expect(
      dialog.getByRole("checkbox", { name: "Yoga", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("checkbox", { name: "Môn đã đóng" }),
    ).toHaveCount(0);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    expect(state.writes).toEqual([]);
  });
}
