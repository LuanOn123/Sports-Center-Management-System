import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./fixtures";
async function adminFixture(page: Page) {
  await setup(page, "ADMIN");
  const calls: {
    path: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  const facilities = [
    {
      id: "facility-a",
      code: "A",
      name: "Cơ sở A",
      address: "12 Nguyễn Văn A",
      isActive: true,
      staffs: [
        {
          userId: "old-manager",
          user: { fullName: "Quản lý cũ", email: "old@example.test" },
        },
      ],
    },
    {
      id: "facility-b",
      code: "B",
      name: "Cơ sở B",
      address: "34 Nguyễn Văn B",
      isActive: true,
      staffs: [],
    },
  ];
  const cls = {
    id: "c1",
    name: "Yoga sáng",
    capacity: 10,
    areaType: "INDOOR",
    classType: "REGULAR",
    attendancePolicy: "RECURRING",
    sports: [{ id: "yoga", name: "Yoga" }],
    _count: { enrollments: 3 },
    isActive: true,
  };
  const session = {
    id: "s1",
    classId: "c1",
    roomId: "indoor",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    status: "SCHEDULED",
    class: cls,
    room: { name: "Phòng Yoga" },
    _count: { enrollments: 3 },
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/v1", ""),
      method = request.method();
    if (method !== "GET") {
      calls.push({ path, method, body: request.postDataJSON() ?? {} });
      return route.fulfill({ json: { success: true, data: {} } });
    }
    let data: unknown;
    if (path === "/facilities") data = facilities;
    else if (path === "/staff-candidates")
      data = [
        {
          id: "new-manager",
          fullName: "Quản lý mới",
          email: "new@example.test",
          role: "MANAGER",
        },
      ];
    else if (path === "/classes") data = [cls];
    else if (path === "/classes/c1") data = cls;
    else if (path === "/sports")
      data = [
        { id: "yoga", name: "Yoga", areaTypes: ["INDOOR"], isActive: true },
        { id: "swim", name: "Bơi", areaTypes: ["POOL"], isActive: true },
      ];
    else if (path === "/rooms")
      data = [
        {
          id: "indoor",
          name: "Phòng Yoga",
          areaType: "INDOOR",
          capacity: 20,
          isActive: true,
        },
        {
          id: "pool",
          name: "Hồ bơi",
          areaType: "POOL",
          capacity: 50,
          isActive: true,
        },
        {
          id: "closed",
          name: "Phòng đóng",
          areaType: "INDOOR",
          capacity: 40,
          isActive: false,
        },
      ];
    else if (path === "/class-schedules") data = [session];
    else if (path === "/class-schedules/s1") data = session;
    else if (path === "/classes/c1/registrations")
      data = {
        totalMembers: 1,
        totalEnrollments: 3,
        members: [
          {
            memberId: "m1",
            fullName: "Hội viên Lan",
            email: "lan@example.test",
            bookedSessions: 2,
            completedSessions: 1,
          },
        ],
        sessions: [session],
      };
    else if (path === "/reports/facilities")
      data = {
        totalMembers: 8,
        totalBookings: 17,
        totalRevenue: 1500000,
        refundedAmount: 100000,
        netRevenue: 1400000,
        facilities: facilities.map((f, i) => ({
          ...f,
          managers: i ? [] : ["Quản lý cũ"],
          netRevenue: i ? 400000 : 1000000,
          members: i ? 3 : 6,
          bookings: i ? 5 : 12,
          sessions: 10,
          cancelledBookings: 2,
        })),
      };
    else if (path === "/audit-logs")
      data = [
        {
          id: "a1",
          entity: "Enrollment",
          action: "create",
          createdAt: "2026-10-08T03:00:00Z",
          actor: { fullName: "Lễ tân Mai" },
          facility: { name: "Cơ sở A" },
          subject: "Hội viên Lan · Yoga sáng",
          sessionStart: session.startTime,
          after: { status: "BOOKED" },
        },
      ];
    else if (path === "/users")
      data = [
        {
          id: "member-user",
          fullName: "Hội viên Lan",
          role: "MEMBER",
          email: "lan@example.test",
          isActive: true,
        },
      ];
    else if (path === "/users/member-user")
      data = { id: "member-user", fullName: "Hội viên Lan", role: "MEMBER" };
    else if (path === "/members/member-user")
      data = {
        id: "m1",
        trainingLevel: "BEGINNER",
        fitnessGoal: "Tăng sức bền",
        user: { fullName: "Hội viên Lan" },
      };
    else if (path === "/members/member-user/membership-status")
      data = { effectiveTier: "MEMBERSHIP", daysRemaining: 25 };
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  return calls;
}

test("admin facilities hide timezone and replace only a manager", async ({
  page,
}) => {
  const calls = await adminFixture(page);
  await page.goto("/admin/facilities");
  await page.getByRole("button", { name: "Thêm cơ sở", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Múi giờ|Timezone/i)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: "Thay quản lý" }).click();
  await dialog.getByRole("combobox").selectOption("new-manager");
  await expect(dialog.getByText("Vai trò", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Lưu phân công" }).click();
  await expect
    .poll(() => calls.find((c) => c.path.endsWith("/manager"))?.body)
    .toEqual({ userId: "new-manager", replacedUserId: "old-manager" });
});

test("sport picker filters rooms and persists capacity and area", async ({
  page,
}) => {
  const calls = await adminFixture(page);
  await page.goto("/admin/classes");
  await page.getByRole("button", { name: "Thêm lớp học" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên lớp học").fill("Yoga thư giãn");
  await dialog.getByText("Chọn bộ môn cho lớp", { exact: true }).click();
  await dialog.getByRole("checkbox", { name: /Yoga/ }).check();
  const rooms = dialog.getByRole("combobox", { name: "Phòng tập cho lớp" });
  await expect(rooms.locator("option")).toHaveCount(2);
  await expect(rooms).toContainText("Phòng Yoga · 20 chỗ · Trong nhà");
  await rooms.selectOption("indoor");
  await dialog.getByRole("button", { name: "Lưu lớp học" }).click();
  await expect
    .poll(() => calls.find((c) => c.path === "/classes")?.body)
    .toMatchObject({
      defaultRoomId: "indoor",
      areaType: "INDOOR",
      capacity: 20,
      sportIds: ["yoga"],
    });
});

test("admin sees registration totals and all session details", async ({
  page,
}) => {
  await adminFixture(page);
  await page.goto("/admin/classes");
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await page.getByRole("button", { name: "Khóa học & đăng ký" }).click();
  await expect(page.getByText("1 hội viên", { exact: true })).toBeVisible();
  await expect(page.getByText("Hội viên Lan", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lịch của khóa học" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Phân công huấn luyện viên",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("admin schedule stays read only in list and details", async ({ page }) => {
  await adminFixture(page);
  await page.goto("/admin/schedules");
  await page.getByRole("button", { name: "Bảng", exact: true }).click();
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  for (const name of [
    "Chỉnh sửa",
    "Hoàn tất",
    "Hủy lịch",
    "Thêm lịch hoạt động",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
});

test("overview compares all facilities and simplified navigation", async ({
  page,
}) => {
  await adminFixture(page);
  await page.goto("/admin/dashboard");
  for (const title of [
    "Doanh thu theo cơ sở",
    "Hội viên theo cơ sở",
    "Lượt đăng ký theo cơ sở",
  ])
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.locator(".analytics-card").first().getByText("Cơ sở B", { exact: true }),
  ).toBeVisible();
  for (const title of [
    "Bán gói tại quầy",
    "Huấn luyện viên",
    "Sinh lịch định kỳ",
    "Điều kiện giảng dạy",
    "Phân công nhân sự",
    "Hội viên",
  ])
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Người dùng", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-overview.png",
    fullPage: true,
  });
});

test("member profile is managed from users", async ({ page }) => {
  await adminFixture(page);
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/admin\/users\?role=MEMBER/);
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await page.getByRole("button", { name: "Gói & tập luyện" }).click();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ hội viên", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Tăng sức bền", { exact: true })).toBeVisible();
});

test("audit feed presents actor, booking and facility", async ({ page }) => {
  await adminFixture(page);
  await page.goto("/admin/audit");
  await expect(
    page.getByText("Hội viên Lan · Yoga sáng", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lễ tân Mai", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Tạo mới · Đăng ký lớp", { exact: true }),
  ).toBeVisible();
});

for (const width of [375, 1440])
  test(`new admin screens accessible at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await adminFixture(page);
    await page.setViewportSize({ width, height: 960 });
    for (const path of ["dashboard", "facilities", "audit"]) {
      await page.goto(`/admin/${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".loading, .skeleton")).toHaveCount(0);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
        path,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true);
    }
  });
