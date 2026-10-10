import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";

async function manager(page: Page) {
  await setup(page, "MANAGER");
  let assigned = false;
  const coach = {
    id: "coach-user",
    fullName: "Coach An",
    email: "an@test.invalid",
    role: "COACH",
  };
  const writes: { path: string; body: unknown }[] = [];
  const calls: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    calls.push(path);
    let data: unknown;
    if (path === "/facilities")
      data = [{ id: "facility-a", name: "Cơ sở A", code: "A", isActive: true }];
    else if (path === "/facilities/facility-a")
      data = {
        name: "Cơ sở A",
        staffs: assigned
          ? [{ userId: coach.id, user: coach, role: "COACH", isActive: true }]
          : [],
      };
    else if (path === "/staff-candidates") data = assigned ? [] : [coach];
    else if (path === "/facilities/facility-a/staff") {
      writes.push({ path, body: req.postDataJSON() });
      assigned = true;
      data = { userId: coach.id };
    } else if (path === "/reports/revenue")
      data = {
        totalRevenue: 900000,
        netRevenue: 800000,
        refundedAmount: 100000,
        successPayments: 3,
        totalPayments: 3,
        netRevenueVerified: false,
        unreconciledRefunds: 1,
        recentPayments: [],
      };
    else if (path === "/rooms")
      data = [
        {
          id: "room-a",
          name: "Phòng Yoga A",
          capacity: 20,
          areaType: "INDOOR",
          isActive: true,
        },
      ];
    else if (path === "/rooms/room-a")
      data = {
        id: "room-a",
        name: "Phòng Yoga A",
        capabilities: [{ key: "mats", quantity: 12 }],
      };
    else if (path === "/rooms/room-a/capabilities") {
      writes.push({ path, body: req.postDataJSON() });
      data = {};
    } else if (path === "/class-schedules") {
      const from = new Date();
      from.setHours(10, 0, 0, 0);
      data = [
        {
          id: "session-a",
          classId: "class-a",
          roomId: "room-a",
          class: { name: "Yoga cùng Coach An", capacity: 10 },
          room: { name: "Phòng Yoga A" },
          status: "SCHEDULED",
          startTime: from.toISOString(),
          endTime: new Date(+from + 3600000).toISOString(),
        },
      ];
    } else if (path === "/coaches/coach-user")
      data = {
        ...coach,
        coachProfile: { id: "coach-profile", specialization: "Yoga" },
      };
    else if (path === "/coaches/coach-profile/specializations") {
      if (req.method() === "PUT")
        writes.push({ path, body: req.postDataJSON() });
      data = [{ sportId: "yoga" }];
    } else if (path === "/sports") data = [{ id: "yoga", name: "Yoga" }];
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  return { writes, calls };
}

test("Manager has eight main features and obsolete URLs redirect safely", async ({
  page,
}) => {
  await manager(page);
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/manager\/dashboard$/);
  const nav = page.locator(".sidebar nav");
  for (const name of [
    "Tổng quan",
    "Người dùng",
    "Phòng tập",
    "Lớp học",
    "Lịch hoạt động",
    "Nghỉ phép",
    "Yêu cầu hỗ trợ",
    "Báo cáo doanh thu",
  ])
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  for (const [old, next] of Object.entries({
    members: "users",
    coaches: "users",
    staff: "users",
    sports: "classes",
    bookings: "classes",
    checkin: "dashboard",
    "audit-logs": "dashboard",
    requirements: "rooms",
    slots: "schedules",
    patterns: "schedules",
    roles: "users",
    "membership-plans": "reports",
    membership: "reports",
    payments: "reports",
    "activity-planner": "schedules",
    "attendance-rules": "classes",
  })) {
    await page.goto(`/manager/${old}`);
    await expect(page).toHaveURL(new RegExp(`/manager/${next}$`));
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("Coach assignment confirms own facility and refreshes both pools", async ({
  page,
}) => {
  const { writes } = await manager(page);
  await page.goto("/manager/users");
  await page
    .getByRole("button", { name: "Coach chưa phân công", exact: true })
    .click();
  await page.getByRole("button", { name: "Phân công vào cơ sở" }).click();
  await expect(page.getByRole("dialog")).toContainText("Cơ sở A");
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Xác nhận phân công", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Không có nhân sự phù hợp")).toBeVisible();
  expect(writes).toEqual([
    {
      path: "/facilities/facility-a/staff",
      body: { userId: "coach-user", role: "COACH" },
    },
  ]);
  await page
    .getByRole("button", { name: "Nhân sự cơ sở", exact: true })
    .click();
  await expect(page.getByText("Coach An", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hồ sơ Coach", exact: true }).click();
  await page
    .getByRole("button", { name: "Bộ môn giảng dạy", exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: "Yoga" })).toBeChecked();
  await page.setViewportSize({ width: 375, height: 960 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Lưu bộ môn" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[1]).toEqual({
    path: "/coaches/coach-profile/specializations",
    body: { sportIds: ["yoga"] },
  });
});

test("room coordination and activity calendar use the same sessions", async ({
  page,
}) => {
  const { writes } = await manager(page);
  await page.goto("/manager/rooms");
  await page.getByRole("button", { name: "Sử dụng & cấu hình phòng" }).click();
  await page
    .getByRole("combobox", { name: "Phòng tập", exact: true })
    .selectOption("room-a");
  await expect(page.getByText("Yoga cùng Coach An").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Cấu hình phòng", exact: true })
    .click();
  await expect(page.getByLabel("Mã cấu hình 1")).toHaveValue("mats");
  await page.getByLabel("Số lượng").fill("15");
  await page.getByRole("button", { name: "Lưu cấu hình" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[0]).toEqual({
    path: "/rooms/room-a/capabilities",
    body: { values: { mats: 15 } },
  });
  await page.goto("/manager/schedules");
  await expect(page.getByText("Yoga cùng Coach An").first()).toBeVisible();
});

test("revenue is read-only and surfaces incomplete reconciliation", async ({
  page,
}) => {
  const { calls } = await manager(page);
  await page.goto("/manager/reports");
  await expect(page.getByText(/khoản hoàn chưa đối soát/)).toBeVisible();
  await expect(page.getByText("Chưa có giao dịch trong kỳ")).toBeVisible();
  expect(
    calls
      .filter((path) => path.startsWith("/reports/"))
      .every((path) => path === "/reports/revenue"),
  ).toBe(true);
  expect(calls).not.toContain("/payments");
  await page.getByLabel("Từ ngày").fill("2099-01-01");
  await expect(page.getByText("Chọn khoảng ngày hợp lệ.")).toBeVisible();
});

test("unassigned Coach can refresh assignment without logging out", async ({
  page,
}) => {
  await setup(page, "COACH");
  let assigned = false;
  await page.route("**/api/v1/facilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: assigned
          ? [{ id: "facility-a", name: "Cơ sở A", code: "A", isActive: true }]
          : [],
      },
    }),
  );
  await page.goto("/coach/dashboard");
  await expect(
    page.getByRole("heading", { name: "Chưa được phân công cơ sở" }),
  ).toBeVisible();
  assigned = true;
  await page.getByRole("button", { name: "Kiểm tra phân công" }).click();
  await expect(page.locator("main h1")).toBeVisible();
});

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`Manager pages are usable at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await manager(page);
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["dashboard", "users", "rooms", "reports"]) {
      await page.goto(`/manager/${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);
      if (path === "dashboard" && (width === 375 || width === 1440))
        await page.screenshot({
          path: `artifacts/manager-audit-${width}.png`,
          fullPage: true,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (width === 375 || width === 1440) {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(result.violations, path).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Manager reviews Reception leave and filters staff support", async ({
  page,
}) => {
  const state = await manager(page);
  const receptionist = {
    id: "reception-a",
    fullName: "Lễ tân Mai",
    role: "RECEPTIONIST",
  };
  const leave = {
    id: "staff-leave",
    coachId: null,
    status: "PENDING",
    requester: receptionist,
    user: receptionist,
    reason: "Nghỉ việc gia đình",
    startTime: "2031-01-02T08:00:00Z",
    endTime: "2031-01-02T12:00:00Z",
  };
  let decision: unknown;
  await page.route("**/api/v1/leave-requests**", async (route) => {
    const req = route.request();
    if (req.method() === "PATCH") {
      decision = req.postDataJSON();
      leave.status = "APPROVED";
    }
    const data = req.url().endsWith("/affected")
      ? []
      : req.method() === "PATCH"
        ? leave
        : [leave];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/manager/leave");
  await expect(page.getByRole("heading", { name: "Lễ tân Mai" })).toBeVisible();
  await page.getByLabel("Vai trò người gửi").selectOption("COACH");
  await expect(
    page.getByText("Không có yêu cầu phù hợp với bộ lọc."),
  ).toBeVisible();
  await page.getByLabel("Vai trò người gửi").selectOption("RECEPTIONIST");
  await page.screenshot({
    path: "artifacts/manager-staff-leave-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Xử lý đơn nghỉ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Lý do", { exact: true })
    .fill("Đã bố trí nhân sự trực thay");
  await dialog
    .getByRole("button", { name: "Lưu quyết định", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(decision).toEqual({
    status: "APPROVED",
    reason: "Đã bố trí nhân sự trực thay",
    resolutions: [],
  });
  expect(state.calls).not.toContain("/coaches");
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("PENDING");
  await expect(
    page.getByText("Không có yêu cầu phù hợp với bộ lọc."),
  ).toBeVisible();
  await page.route("**/api/v1/issues", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "i1",
            title: "Thiết bị quầy",
            status: "OPEN",
            requester: receptionist,
          },
          {
            id: "i2",
            title: "Dụng cụ lớp học",
            status: "RESOLVED",
            requester: { id: "coach-a", fullName: "Coach An", role: "COACH" },
          },
        ],
      },
    }),
  );
  await page.goto("/manager/issues");
  await page.getByLabel("Vai trò người gửi").selectOption("RECEPTIONIST");
  await expect(
    page.getByRole("heading", { name: "Thiết bị quầy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dụng cụ lớp học" }),
  ).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: "artifacts/manager-staff-support-375.png",
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
});
