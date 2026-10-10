import { test, expect, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function workflow(page: Page, role = "MEMBER") {
  await setup(page, role);
  const calls: { path: string; method: string; body: string | null }[] = [];
  let read = false;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", "");
    if (path === "/facilities") return route.fulfill({ json: { success: true, data: [{ id: "facility-a", code: "A", name: "Cơ sở A", isActive: true }] } });
    calls.push({ path, method: req.method(), body: req.postData() });
    let data: unknown, pagination: unknown;
    if (path === "/auth/me")
      data = {
        id: "user-1",
        fullName: "Nguyễn Minh Anh",
        email: "user@example.test",
        role,
        isActive: true,
        memberProfile: { id: "member-1" },
        coachProfile: { id: "coach-1" },
      };
    else if (path === "/notifications") {
      data = [
        {
          id: "n1",
          title: "Lịch học đã cập nhật",
          body: "Lớp Yoga chuyển sang phòng B. ".repeat(20),
          isRead: read,
          createdAt: "2026-09-18T03:00:00Z",
        },
      ];
      pagination = { page: 1, totalPages: 1, total: 1, limit: 20 };
    } else if (path === "/notifications/unread-count")
      data = { unreadCount: read ? 0 : 1 };
    else if (
      path === "/notifications/n1/read" ||
      path === "/notifications/mark-all-read"
    ) {
      read = true;
      data = {};
    } else if (path === "/chat/contacts")
      data = [
        { id: "coach-user", fullName: "Huấn luyện viên An", role: "COACH" },
      ];
    else if (path === "/chat/conversations") data = [];
    else if (path === "/chat/messages" && req.method() === "GET")
      data = [
        {
          id: "m1",
          senderId: "coach-user",
          sender: { fullName: "Huấn luyện viên An" },
          content: "Hẹn gặp tại lớp Yoga",
          createdAt: "2026-09-18T03:00:00Z",
          fileUrl: "javascript:alert(1)",
        },
      ];
    else if (path === "/chat/messages") data = { id: "sent" };
    else if (path === "/enrollments/my")
      data = [
        {
          id: "e1",
          memberId: "member-1",
          scheduleId: "s1",
          status: "COMPLETED",
          schedule: {
            id: "s1",
            startTime: "2026-09-10T02:00:00Z",
            class: { name: "Yoga" },
          },
        },
      ];
    else if (path === "/attendance/my") data = [{ id: "a1", memberId: "member-1", scheduleId: "s1", status: "ABSENT", note: "Nghỉ học", schedule: { startTime: "2026-09-10T02:00:00Z", class: { name: "Yoga" } } }];
    else if (path === "/attendance/my/summary") data = { thresholds: {}, buckets: [], penalties: [] };
    else if (path === "/attendance")
      data = [
        {
          id: "a1",
          memberId: "member-1",
          scheduleId: "s1",
          status: "ABSENT",
          note: "Nghỉ học",
        },
        {
          id: "a2",
          memberId: "member-other",
          scheduleId: "s1",
          status: "PRESENT",
          note: "Thông tin riêng người khác",
        },
      ];
    else return route.fallback();
    return route.fulfill({
      json: { success: true, data, ...(pagination ? { pagination } : {}) },
    });
  });
  return calls;
}

for (const width of [375, 1440])
  test(`real notifications wrap and mark read at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const calls = await workflow(page);
    await page.goto("/member/notifications");
    await expect(
      page.getByRole("heading", { name: "Lịch học đã cập nhật" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
      .click();
    await expect(
      page.getByText("0 thông báo chưa đọc", { exact: true }),
    ).toBeVisible();
    expect(
      calls.some(
        (c) => c.path === "/notifications/n1/read" && c.method === "PATCH",
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/workflow-notifications-${width}.png`,
      fullPage: true,
    });
  });

test("completed booking does not imply presence; member sees own recorded attendance", async ({
  page,
}) => {
  await workflow(page);
  await page.goto("/member/attendance");
  await expect(page.getByText("Vắng mặt", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Thông tin riêng người khác", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lưu điểm danh" })).toHaveCount(
    0,
  );
});

test("chat sends private multipart messages, validates empty input and rejects unsafe links", async ({
  page,
}) => {
  const calls = await workflow(page);
  await page.goto("/member/chat");
  await page.getByLabel("Cuộc trò chuyện").selectOption("coach-user");
  await expect(
    page.getByRole("button", { name: "Gửi tin nhắn" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Mở tệp đính kèm" })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Nội dung", { exact: true })
    .fill("Em xin xác nhận lịch tập.");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByLabel("Nội dung", { exact: true })).toHaveValue("");
  const sent = calls.find(
    (c) => c.path === "/chat/messages" && c.method === "POST",
  );
  expect(sent?.body).toContain('name="receiverId"');
  expect(sent?.body).toContain("coach-user");
  expect(sent?.body).toContain("Em xin xác nhận lịch tập.");
});

test("dynamic role changes expire session without refreshing obsolete permissions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (sessionStorage.setItem("pulse.identity-version", "mongo-identities-v1"),
      sessionStorage.setItem("pulse.access", "old"));
    sessionStorage.setItem("pulse.refresh", "refresh");
  });
  const calls: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    calls.push(route.request().url());
    return route.fulfill({
      status: 401,
      json: {
        success: false,
        message: "Unauthorized: role has changed, please login again",
      },
    });
  });
  await page.goto("/member/dashboard");
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText("Vai trò tài khoản đã thay đổi. Vui lòng đăng nhập lại.", {
        exact: true,
      }),
  ).toBeVisible();
  expect(calls.some((c) => c.endsWith("/auth/refresh-token"))).toBe(false);
  expect(
    await page.evaluate(() => sessionStorage.getItem("pulse.access")),
  ).toBeNull();
});

test("manager has revenue reports only while staff has no refund action", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  await page.goto("/manager/payments");
  await expect(
    page.getByRole("heading", { name: "Báo cáo doanh thu", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/manager\/reports$/);
  await expect(
    page.getByRole("button", { name: "Hoàn tiền", exact: true }),
  ).toHaveCount(0);
  await setup(page, "RECEPTIONIST");
  await page.goto("/receptionist/payments");
  await page.getByRole("button", { name: "Chọn", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Hoàn tiền", exact: true }),
  ).toHaveCount(0);
});

test("reception views ended sessions without managing schedule or attendance", async ({
  page,
}) => {
  await setup(page, "RECEPTIONIST");
  const now = Date.now();
  const past = {
    id: "ended",
    status: "SCHEDULED",
    startTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now - 60 * 60 * 1000).toISOString(),
    class: { name: "Buổi đã kết thúc" },
    room: { name: "Phòng A" },
  };
  let completed = false;
  const mutations: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/facilities") return route.fulfill({ json: { success: true, data: [{ id: "facility-a", code: "A", name: "Cơ sở A", isActive: true }] } });
    if (req.method() !== "GET") mutations.push(req.method() + " " + path);
    let data: unknown;
    if (path === "/class-schedules")
      data = [
        { ...past, status: completed ? "COMPLETED" : "SCHEDULED" },
        {
          ...past,
          id: "future",
          startTime: new Date(now + 60 * 60 * 1000).toISOString(),
          endTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
          class: { name: "Buổi chưa kết thúc" },
        },
      ];
    else if (path === "/class-schedules/ended/complete") {
      completed = true;
      data = { ...past, status: "COMPLETED" };
    } else if (path === "/class-schedules/ended")
      data = { ...past, status: completed ? "COMPLETED" : "SCHEDULED" };
    else if (path === "/class-schedules/future")
      data = {
        ...past,
        id: "future",
        startTime: new Date(now + 60 * 60 * 1000).toISOString(),
        endTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        class: { name: "Buổi chưa kết thúc" },
      };
    else if (path === "/enrollments/schedule/ended")
      data = [
        {
          id: "e1",
          memberId: "m1",
          status: "COMPLETED",
          member: { user: { fullName: "Hội viên An" } },
        },
      ];
    else if (path === "/attendance") data = [];
    else return route.fallback();
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/receptionist/schedules");
  await page.getByRole("button", { name: /Buổi chưa kết thúc/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Hoàn tất" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Buổi đã kết thúc/ }).click();
  for (const name of ["Hoàn tất", "Chỉnh sửa", "Hủy lịch"]) await expect(page.getByRole("dialog").getByRole("button", { name, exact: true })).toHaveCount(0);
  expect(mutations).toEqual([]);
  await page.getByRole("button", { name: "Học viên & điểm danh" }).click();
  await expect(
    page.locator("summary").filter({ hasText: "Chưa điểm danh" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu điểm danh" })).toHaveCount(
    0,
  );
});

test("manager edit schedule does not offer lifecycle status bypass", async ({
  page,
}) => {
  await setup(page, "MANAGER");
  const schedule = {
    id: "editable-schedule",
    status: "SCHEDULED",
    startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    class: { id: "class-1", name: "Lớp chỉnh sửa" },
    room: { id: "room-1", name: "Phòng A" },
  };
  await page.route("**/api/v1/class-schedules**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/facilities") return route.fulfill({ json: { success: true, data: [{ id: "facility-a", code: "A", name: "Cơ sở A", isActive: true }] } });
    return route.fulfill({
      json: {
        success: true,
        data: path === "/class-schedules" ? [schedule] : schedule,
      },
    });
  });
  await page.goto("/manager/schedules");
  await page.locator(".calendar-event").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Chỉnh sửa", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Trạng thái")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("dialog").getByLabel("Bắt đầu", { exact: true }),
  ).toBeVisible();
});
