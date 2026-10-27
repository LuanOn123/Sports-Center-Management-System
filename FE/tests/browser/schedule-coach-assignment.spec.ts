import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function fixture(page: Page, status = "SCHEDULED", role = "MANAGER") {
  await setup(page, role);
  const state = {
    status,
    revoked: false,
    conflict: false,
    coachId: null as string | null,
    writes: [] as unknown[],
  };
  const date = new Date();
  date.setHours(18, 0, 0, 0);
  const coaches = [
    {
      id: "user-yoga",
      fullName: "HLV Yoga",
      isActive: true,
      coachProfile: { id: "profile-yoga" },
    },
    {
      id: "user-swim",
      fullName: "HLV Bơi",
      isActive: true,
      coachProfile: { id: "profile-swim" },
    },
    {
      id: "user-inactive",
      fullName: "HLV đã khóa",
      isActive: false,
      coachProfile: { id: "profile-inactive" },
    },
  ];
  const cls = {
    id: "class-yoga",
    name: "Yoga buổi tối",
    sports: [{ id: "yoga", name: "Yoga" }],
    coaches: [],
  };
  const schedule = () => ({
    id: "session-1",
    classId: cls.id,
    class: cls,
    room: { id: "room-1", name: "Phòng Yoga" },
    startTime: date.toISOString(),
    endTime: new Date(date.getTime() + 3600000).toISOString(),
    status: state.status,
    coachId: state.coachId,
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown;
    if (path === "/class-schedules/session-1" && request.method() === "PATCH") {
      const body = request.postDataJSON();
      state.writes.push(body);
      if (state.conflict)
        return route.fulfill({
          status: 409,
          json: { success: false, message: "HLV đã có lịch dạy trùng giờ" },
        });
      state.coachId = body.coachId;
      data = schedule();
    } else if (path === "/class-schedules") data = [schedule()];
    else if (path === "/class-schedules/under-capacity")
      data = { schedules: [] };
    else if (path === "/class-schedules/session-1") data = schedule();
    else if (path === "/classes/class-yoga") data = cls;
    else if (path === "/coaches") data = coaches;
    else if (/^\/coaches\/profile-[^/]+\/specializations$/.test(path))
      data = [
        {
          sportId:
            path.includes("profile-yoga") && !state.revoked ? "yoga" : "swim",
        },
      ];
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto(
    role === "MANAGER" ? "/manager/schedules" : "/admin/schedules",
  );
  return state;
}

test("assigns from calendar details, sends only the coach profile ID and shows the saved name", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: /Yoga buổi tối/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Gán HLV cho buổi học", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", {
    name: "Huấn luyện viên",
    exact: true,
  });
  await expect(select.locator("option")).toHaveText([
    "Chọn HLV phù hợp",
    "HLV Yoga",
  ]);
  await select.selectOption("profile-yoga");
  await dialog.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.writes).toEqual([{ coachId: "profile-yoga" }]);
  await expect(
    page.getByRole("button", { name: /Yoga buổi tối/ }),
  ).toContainText("HLV Yoga");
  await page.getByRole("button", { name: /Yoga buổi tối/ }).click();
  await expect(
    page.getByRole("dialog").getByText("HLV Yoga", { exact: true }),
  ).toBeVisible();
});

test("assigns from table actions and keeps conflict errors visible without closing the form", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Bảng", exact: true }).click();
  await page
    .getByRole("button", { name: "Gán HLV cho buổi học", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Huấn luyện viên", exact: true })
    .selectOption("profile-yoga");
  state.conflict = true;
  await dialog.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(dialog.getByRole("alert")).toContainText("trùng giờ");
  await expect(
    dialog.getByRole("combobox", { name: "Huấn luyện viên", exact: true }),
  ).toHaveValue("profile-yoga");
  expect(state.coachId).toBeNull();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/class-schedules/session-1") &&
        response.request().method() === "GET",
    ),
    dialog.getByRole("button", { name: "Tải lại danh sách HLV" }).click(),
  ]);
  expect(state.writes).toHaveLength(1);
  state.conflict = false;
  await dialog.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.coachId).toBe("profile-yoga");
});

for (const changed of ["status", "specialization"] as const) {
  test(`rechecks ${changed} before saving a previously opened form`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Bảng", exact: true }).click();
    await page
      .getByRole("button", { name: "Gán HLV cho buổi học", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Huấn luyện viên", exact: true })
      .selectOption("profile-yoga");
    if (changed === "status") state.status = "CANCELLED";
    else state.revoked = true;
    await dialog.getByRole("button", { name: "Lưu phân công" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      changed === "status" ? "đổi trạng thái" : "không còn phù hợp",
    );
    expect(state.writes).toEqual([]);
  });
}

for (const status of ["CANCELLED", "COMPLETED"]) {
  test(`disables coach assignment for ${status} sessions`, async ({ page }) => {
    await fixture(page, status);
    await page.getByRole("button", { name: "Bảng", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Gán HLV cho buổi học", exact: true }),
    ).toBeDisabled();
  });
}

test("does not expose manager-only assignment to admin", async ({ page }) => {
  await fixture(page, "SCHEDULED", "ADMIN");
  await page.getByRole("button", { name: "Bảng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gán HLV cho buổi học", exact: true }),
  ).toHaveCount(0);
});
