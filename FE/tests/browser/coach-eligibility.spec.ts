import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function fixture(page: Page, sportIds = ["yoga"]) {
  await setup(page, "MANAGER");
  const state = {
    revoked: false,
    broken: false,
    writes: [] as { path: string; body: unknown }[],
  };
  const cls = {
    id: "class1",
    name: "Lớp chuyên môn",
    isActive: true,
    areaType: "INDOOR",
    capacity: 20,
    sports: sportIds.map((id) => ({ id, name: id })),
    coaches: [],
  };
  const coaches = [
    {
      id: "user1",
      fullName: "HLV Yoga",
      coachProfile: { id: "p1", specialization: "Bơi" },
    },
    {
      id: "user2",
      fullName: "HLV Bơi",
      coachProfile: { id: "p2", specialization: "Yoga" },
    },
    { id: "user3", fullName: "HLV Đa môn", coachProfile: { id: "p3" } },
    { id: "user4", fullName: "HLV Chưa gán", coachProfile: { id: "p4" } },
  ];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (
      request.method() === "POST" &&
      path.startsWith("/classes/class1/coaches")
    ) {
      state.writes.push({ path, body: request.postDataJSON() });
      data = {};
    } else if (path === "/classes") data = [cls];
    else if (path === "/classes/class1") data = cls;
    else if (path === "/coaches") data = coaches;
    else if (/^\/coaches\/p\d\/specializations$/.test(path)) {
      if (state.broken)
        return route.fulfill({
          status: 503,
          json: { success: false, message: "Không thể tải bộ môn" },
        });
      const id = path.split("/")[2];
      data = (
        id === "p1"
          ? state.revoked
            ? ["swim"]
            : ["yoga"]
          : id === "p2"
            ? ["swim"]
            : id === "p3"
              ? ["yoga", "swim"]
              : []
      ).map((sportId) => ({ sportId }));
    } else return route.fallback();
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

for (const support of [false, true]) {
  test(`filters ${support ? "support" : "main"} assignment by authorized sports and sends the profile ID`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.goto("/manager/classes");
    await page
      .getByRole("button", {
        name: support
          ? "Phân công huấn luyện viên hỗ trợ"
          : "Phân công huấn luyện viên",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    const select = dialog.getByRole("combobox", {
      name: "Huấn luyện viên",
      exact: true,
    });
    await expect(select.locator("option")).toHaveText([
      "Chọn HLV phù hợp",
      "HLV Yoga",
      "HLV Đa môn",
    ]);
    await select.selectOption("p1");
    await dialog
      .getByRole("button", { name: "Phân công", exact: true })
      .click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]).toEqual({
      path: `/classes/class1/coaches${support ? "/support" : ""}`,
      body: support ? { coachId: "p1" } : { coachId: "p1", isPrimary: true },
    });
  });
}

test("multi-sport classes require every sport to be assigned", async ({
  page,
}) => {
  await fixture(page, ["yoga", "swim"]);
  await page.goto("/manager/classes");
  await page
    .getByRole("button", { name: "Phân công huấn luyện viên", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("select option")).toHaveText([
    "Chọn HLV phù hợp",
    "HLV Đa môn",
  ]);
});

test("qualification revoked after opening the form prevents the assignment request", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/manager/classes");
  await page
    .getByRole("button", { name: "Phân công huấn luyện viên", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Huấn luyện viên", exact: true })
    .selectOption("p1");
  state.revoked = true;
  await dialog.getByRole("button", { name: "Phân công", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("HLV chỉ được dạy");
  expect(state.writes).toEqual([]);
});

test("unclassified classes cannot assign a coach", async ({ page }) => {
  await fixture(page, []);
  await page.goto("/manager/classes");
  await page
    .getByRole("button", { name: "Phân công huấn luyện viên", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Chưa xác định được bộ môn",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Phân công", exact: true }),
  ).toHaveCount(0);
});

test("qualification API failure shows an error instead of an unrestricted coach list", async ({
  page,
}) => {
  const state = await fixture(page);
  state.broken = true;
  await page.goto("/manager/classes");
  await page
    .getByRole("button", { name: "Phân công huấn luyện viên", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const revoke of [false, true]) {
  test(`replacement coach respects assigned sports${revoke ? " even after revocation" : ""}`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const writes: unknown[] = [];
    await page.route("**/api/v1/leave-requests**", async (route) => {
      const request = route.request();
      let data: unknown;
      if (request.method() === "PATCH") {
        writes.push(request.postDataJSON());
        data = {};
      } else if (request.url().endsWith("/affected"))
        data = [
          {
            id: "session1",
            classId: "class1",
            startTime: "2031-01-01T08:00:00Z",
            endTime: "2031-01-01T09:00:00Z",
          },
        ];
      else
        data = [
          {
            id: "leave1",
            coachId: "p3",
            requester: { fullName: "HLV Đa môn", role: "COACH" },
            reason: "Nghỉ phép",
            status: "PENDING",
            startTime: "2031-01-01T08:00:00Z",
            endTime: "2031-01-01T09:00:00Z",
          },
        ];
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto("/manager/leave");
    await page.getByRole("button", { name: "Xử lý đơn nghỉ" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Cách xử lý" })
      .selectOption("REPLACE");
    const replacement = dialog.getByRole("combobox", {
      name: "Huấn luyện viên thay thế",
    });
    await expect(replacement.locator("option")).toHaveText([
      "Chọn huấn luyện viên",
      "HLV Yoga",
    ]);
    await replacement.selectOption("p1");
    await dialog
      .getByRole("textbox", { name: "Lý do", exact: true })
      .fill("Đã bố trí HLV cùng bộ môn");
    state.revoked = revoke;
    await dialog.getByRole("button", { name: "Lưu quyết định" }).click();
    if (revoke) {
      await expect(dialog.getByRole("alert")).toContainText("HLV chỉ được dạy");
      expect(writes).toEqual([]);
    } else {
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0]).toMatchObject({
        resolutions: [
          { scheduleId: "session1", action: "REPLACE", coachId: "p1" },
        ],
      });
    }
  });
}

test("manager cannot remove a sport used by an assigned class but can remove an unused sport", async ({
  page,
}) => {
  await fixture(page);
  const writes: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (path === "/facilities/facility-a")
      data = {
        name: "Cơ sở A",
        staffs: [
          {
            userId: "user1",
            role: "COACH",
            isActive: true,
            user: {
              id: "user1",
              fullName: "HLV Yoga",
              role: "COACH",
              email: "coach@test.invalid",
            },
          },
        ],
      };
    else if (path === "/coaches/user1")
      data = { id: "user1", fullName: "HLV Yoga", coachProfile: { id: "p1" } };
    else if (path === "/coaches/p1/specializations") {
      if (request.method() === "PUT") writes.push(request.postDataJSON());
      data = [{ sportId: "yoga" }, { sportId: "swim" }];
    } else if (path === "/sports")
      data = [
        { id: "yoga", name: "Yoga" },
        { id: "swim", name: "Bơi" },
      ];
    else return route.fallback();
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/manager/users");
  await page.getByRole("button", { name: "Hồ sơ Coach", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Bộ môn giảng dạy", exact: true })
    .click();
  await dialog.getByRole("checkbox", { name: "Yoga", exact: true }).uncheck();
  await expect(dialog.getByRole("alert")).toContainText("Không thể gỡ bộ môn");
  await expect(
    dialog.getByRole("button", { name: "Lưu bộ môn" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Yoga", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Bơi", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Lưu bộ môn" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ sportIds: ["yoga"] });
});
